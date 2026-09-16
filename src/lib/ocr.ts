import { createWorker, OEM, PSM, type Worker as TesseractWorker } from 'tesseract.js';
import type { OcrLine, OcrWord, Preset, Redaction, ScanResult, StitchedImage } from '../types';
import { detectSensitive, deduplicateRedactions } from './detection';
import { assetUrl } from './utils';
import { throwIfAborted, withDeadline, workerRequest } from './async';
import { loadBitmap, closeBitmap } from './stitch-pipeline';
import { expandRect } from './geometry';
type OcrBlock = {
    paragraphs?: {
        lines?: {
            text: string;
            confidence: number;
            words: OcrWord[];
        }[];
    }[];
};
export function extractLines(blocks: OcrBlock[] | null, offset: number, scale: number): OcrLine[] {
    const lines: OcrLine[] = [];
    for (const block of blocks ?? [])
        for (const paragraph of block.paragraphs ?? [])
            for (const line of paragraph.lines ?? []) {
                const words = (line.words ?? []).filter(word => word.text.trim() && word.bbox && Object.values(word.bbox).every(Number.isFinite)).map(word => ({
                    ...word, bbox: { x0: word.bbox.x0 / scale, y0: word.bbox.y0 / scale + offset, x1: word.bbox.x1 / scale, y1: word.bbox.y1 / scale + offset },
                }));
                if (words.length)
                    lines.push({ text: words.map(word => word.text).join(' '), confidence: line.confidence ?? 70, words });
            }
    return lines;
}
function detectorRequest(payload: unknown, signal: AbortSignal, progress?: (value: number) => void): Promise<Redaction[]> {
    return workerRequest<Redaction[]>(() => new Worker(new URL('../workers/detect.worker.ts', import.meta.url), { type: 'module' }), payload, signal, progress);
}
export async function scanImage(image: StitchedImage, preset: Preset, signal: AbortSignal, onProgress: (value: number, message: string, stage?: 'ocr' | 'codes') => void, onFindings: (items: Redaction[]) => void): Promise<ScanResult> {
    const warnings: string[] = [], allLines: OcrLine[] = [];
    let worker: TesseractWorker | undefined, bitmap: ImageBitmap | HTMLImageElement | undefined;
    let textRedactions: Redaction[] = [], codeRedactions: Redaction[] = [], faceRedactions: Redaction[] = [];
    let tile = 0, tileCount = 1, readerStopped = false;
    const report: typeof onProgress = (...args) => { if (!signal.aborted)
        onProgress(...args); };
    const emit = (items: Redaction[]) => { if (!signal.aborted)
        onFindings(items); };
    const cancel = () => { readerStopped = true; void worker?.terminate().catch(() => { }); };
    signal.addEventListener('abort', cancel, { once: true });
    try {
        throwIfAborted(signal);
        report(0, 'Loading the on-device reading engine');
        // No CDN defaults: engine, WASM and English model are built into the same site.
        const loading = createWorker('eng', OEM.LSTM_ONLY, {
            workerPath: assetUrl('ocr/worker.min.js'), corePath: assetUrl('ocr/core/'), langPath: assetUrl('ocr/lang/'),
            workerBlobURL: false, cacheMethod: 'none', gzip: true,
            errorHandler: () => { },
            logger: message => {
                if (readerStopped || signal.aborted)
                    return;
                if (message.status === 'recognizing text')
                    report(.1 + .7 * (tile + (message.progress ?? 0)) / tileCount, `Reading your screenshot · section ${tile + 1} of ${tileCount}`);
                else if (message.status === 'loading language traineddata')
                    report(.04, 'Loading English OCR from this website’s local assets');
            },
        });
        // Tesseract exposes the worker only after initialization. Dispose it even if
        // cancellation or a timeout happened while the model was still loading.
        void loading.then(engine => { if (readerStopped || signal.aborted)
            void engine.terminate().catch(() => { }); }).catch(() => { });
        worker = await withDeadline(loading, 90000, signal, 'The local OCR model could not load. Check the connection to this site, then retry.');
        throwIfAborted(signal);
        await withDeadline(worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1' }), 10000, signal);
        bitmap = await loadBitmap(image.blob);
        const tileHeight = 1800, overlap = 100, scale = Math.min(1.5, 1800 / image.width);
        tileCount = Math.max(1, Math.ceil((image.height - overlap) / (tileHeight - overlap)));
        for (let y = 0; y < image.height; y += tileHeight - overlap, tile++) {
            throwIfAborted(signal);
            const height = Math.min(tileHeight, image.height - y), canvas = document.createElement('canvas');
            canvas.width = Math.round(image.width * scale);
            canvas.height = Math.round(height * scale);
            try {
                const ctx = canvas.getContext('2d');
                if (!ctx)
                    throw new Error('Could not allocate the OCR canvas. Try the compact resolution.');
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(bitmap, 0, y, image.width, height, 0, 0, canvas.width, canvas.height);
                const result = await withDeadline(worker.recognize(canvas, {}, { text: true, blocks: true }), 90000, signal, 'OCR stopped responding on a section of this image.');
                throwIfAborted(signal);
                allLines.push(...extractLines(result.data.blocks as OcrBlock[] | null, y, scale));
                textRedactions = detectSensitive(allLines, image.width, image.height, preset);
                emit(textRedactions);
            }
            finally {
                canvas.width = canvas.height = 1;
            }
            if (y + height >= image.height)
                break;
        }
        report(.82, 'Finding contextual names and personal details');
        try {
            textRedactions = await detectorRequest({ type: 'text', lines: allLines, width: image.width, height: image.height, preset }, signal);
            emit(textRedactions);
        }
        catch (error) {
            if (signal.aborted)
                throw error;
            warnings.push('Contextual name detection was unavailable. Pattern detection still ran; inspect names manually.');
        }
    }
    catch (error) {
        throwIfAborted(signal);
        warnings.push(`OCR did not finish: ${error instanceof Error ? error.message : 'unknown error'}. Inspect the whole image and add manual masks.`);
    }
    finally {
        readerStopped = true;
        signal.removeEventListener('abort', cancel);
        if (worker)
            await worker.terminate().catch(() => { });
        if (bitmap)
            closeBitmap(bitmap);
    }
    throwIfAborted(signal);
    try {
        report(.86, 'Checking QR codes and barcodes', 'codes');
        const progress = (value: number) => report(.86 + value * .12, 'Checking QR codes and barcodes', 'codes');
        try {
            codeRedactions = await detectorRequest({ type: 'codes', blob: image.blob, width: image.width, height: image.height }, signal, progress);
        }
        catch (error) {
            throwIfAborted(signal);
            // Some browsers can decode and draw images only on the main thread.
            // Load the identical decoder lazily and keep the manual-review warning
            // below if this compatibility path also fails.
            const { detectCodes } = await import('./codes');
            codeRedactions = await detectCodes(image, signal, progress);
        }
    }
    catch (error) {
        throwIfAborted(signal);
        warnings.push('Code detection was unavailable. Inspect QR codes and barcodes manually.');
    }
    type FaceResult = {
        boundingBox: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
    };
    type FaceDetectorConstructor = new (options: {
        fastMode: boolean;
        maxDetectedFaces: number;
    }) => {
        detect: (image: ImageBitmap | HTMLImageElement) => Promise<FaceResult[]>;
    };
    const FaceDetectorClass = (globalThis as unknown as {
        FaceDetector?: FaceDetectorConstructor;
    }).FaceDetector;
    let faceSupported = false;
    if (FaceDetectorClass) {
        let faceImage: ImageBitmap | HTMLImageElement | undefined;
        try {
            faceImage = await loadBitmap(image.blob);
            throwIfAborted(signal);
            const faces = await withDeadline(new FaceDetectorClass({ fastMode: true, maxDetectedFaces: 30 }).detect(faceImage), 12000, signal);
            faceSupported = true;
            faceRedactions = faces.map((face, index) => ({
                ...expandRect(face.boundingBox, Math.max(face.boundingBox.width, face.boundingBox.height) * .25, image.width, image.height),
                id: `face-${index}`, category: 'face', confidence: .77, text: 'Possible face — check the whole profile photo', enabled: true, style: 'solid', source: 'face',
            }));
        }
        catch (error) {
            throwIfAborted(signal);
            warnings.push('Face detection failed in this browser. Cover profile photos manually.');
        }
        finally {
            if (faceImage)
                closeBitmap(faceImage);
        }
    }
    throwIfAborted(signal);
    const redactions = deduplicateRedactions([...textRedactions, ...codeRedactions, ...faceRedactions]);
    if (!faceSupported)
        warnings.push('This browser has no available local face detector. Check profile photos, avatars, and image-embedded personal details manually.');
    if (!allLines.length)
        warnings.push('No readable text was found. This does not mean there is no sensitive information.');
    emit(redactions);
    report(1, 'Your privacy review is ready');
    return { redactions, warnings, faceSupported };
}
