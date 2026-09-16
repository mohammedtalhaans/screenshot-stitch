import type { StitchOptions, StitchOutput, Seam } from '../types';
import { LIMITS, validateImageDimensions } from './limits';
import { findOverlap, estimateRepeatedChrome, sliceGray, type GrayImage } from './stitch-algorithm';
export type Surface = OffscreenCanvas | HTMLCanvasElement;
export type SurfaceContext = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
export function surface(width: number, height: number): Surface {
    if (typeof OffscreenCanvas !== 'undefined')
        return new OffscreenCanvas(width, height);
    if (typeof document === 'undefined')
        throw new Error('OFFSCREEN_UNAVAILABLE');
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}
export function context(canvas: Surface): SurfaceContext {
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as SurfaceContext | null;
    if (!ctx)
        throw new Error('The browser could not allocate an image canvas. Try fewer or smaller screenshots.');
    return ctx;
}
export async function canvasBlob(canvas: Surface, type = 'image/png'): Promise<Blob> {
    if ('convertToBlob' in canvas)
        return canvas.convertToBlob({ type });
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The image is too large for this browser to export.')), type));
}
export async function loadBitmap(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
    if (typeof createImageBitmap === 'function')
        return createImageBitmap(blob);
    if (typeof document === 'undefined')
        throw new Error('OFFSCREEN_UNAVAILABLE');
    const url = URL.createObjectURL(blob);
    try {
        const img = new Image();
        img.src = url;
        await img.decode();
        return img;
    }
    finally {
        URL.revokeObjectURL(url);
    }
}
export function closeBitmap(image: ImageBitmap | HTMLImageElement) { if ('close' in image)
    image.close(); }
function grayOf(canvas: Surface): GrayImage {
    const width = 144, mini = surface(width, canvas.height), ctx = context(mini);
    ctx.drawImage(canvas, 0, 0, width, canvas.height);
    const rgba = ctx.getImageData(0, 0, width, canvas.height).data, pixels = new Uint8Array(width * canvas.height);
    for (let i = 0; i < pixels.length; i++)
        pixels[i] = Math.round(.299 * rgba[i * 4] + .587 * rgba[i * 4 + 1] + .114 * rgba[i * 4 + 2]);
    mini.width = 1;
    mini.height = 1;
    return { width, height: canvas.height, pixels };
}
export async function stitchImages(blobs: Blob[], options: StitchOptions, report: (value: number, message: string) => void = () => { }, signal?: AbortSignal): Promise<StitchOutput> {
    if (!blobs.length)
        throw new Error('Add at least one screenshot to begin.');
    if (blobs.length > LIMITS.files)
        throw new Error('Use no more than 12 screenshots per batch.');
    if (!Number.isFinite(options.maxWidth) || options.maxWidth < 32 || options.maxWidth > 2400)
        throw new Error('Choose a working width from 32 to 2400 pixels.');
    const canvases: Surface[] = [], warnings: string[] = [];
    const check = () => { if (signal?.aborted)
        throw new DOMException('Cancelled', 'AbortError'); };
    try {
        let width = 0, normalizedPixels = 0;
        for (let i = 0; i < blobs.length; i++) {
            check();
            report(.05 + i / blobs.length * .24, `Preparing screenshot ${i + 1} of ${blobs.length}`);
            const image = await loadBitmap(blobs[i]);
            try {
                validateImageDimensions(image.width, image.height);
                if (!width)
                    width = Math.min(image.width, Math.floor(options.maxWidth));
                if (Math.abs(image.width - width) / width > .12 && image.width < options.maxWidth)
                    warnings.push(`Screenshot ${i + 1} was resized to the shared ${width}px width. Check its seam.`);
                const height = Math.round(image.height * width / image.width);
                if (height > 24000)
                    throw new Error('One screenshot is too tall. Keep each image below 24,000 normalized pixels.');
                normalizedPixels += width * height;
                if (normalizedPixels > LIMITS.normalizedPixels)
                    throw new Error('This batch requires too much image memory. Choose Compact resolution or remove a few screenshots.');
                const canvas = surface(width, height), ctx = context(canvas);
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(image, 0, 0, width, height);
                canvases.push(canvas);
            }
            finally {
                closeBitmap(image);
            }
            // In the fallback path, give touch and paint a turn between images.
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        const grays = canvases.map(grayOf);
        const chrome = options.trimChrome ? estimateRepeatedChrome(grays) : { top: 0, bottom: 0 };
        const seams: Seam[] = [];
        let height = canvases[0].height - (canvases.length > 1 ? chrome.bottom : 0);
        const pieces = [{ canvas: canvases[0], sourceY: 0, height, destY: 0 }];
        for (let i = 1; i < canvases.length; i++) {
            check();
            report(.3 + (i - 1) / Math.max(1, canvases.length - 1) * .52, `Matching shared pixels · ${i} / ${canvases.length - 1}`);
            const a = sliceGray(grays[i - 1], chrome.top, grays[i - 1].height - chrome.bottom);
            const b = sliceGray(grays[i], chrome.top, grays[i].height - chrome.bottom);
            const match = findOverlap(a, b);
            const manual = options.manualOverlaps?.[i - 1] !== undefined;
            const maxOverlap = Math.max(0, Math.min(a.height, b.height));
            const overlap = manual ? Math.max(0, Math.min(maxOverlap, Math.round(Number.isFinite(options.manualOverlaps![i - 1]) ? options.manualOverlaps![i - 1] : 0))) : match.overlap;
            const duplicate = !manual && match.duplicate;
            let sourceY = chrome.top + overlap;
            let take = canvases[i].height - sourceY - (i < canvases.length - 1 ? chrome.bottom : 0);
            if (duplicate) {
                // A final duplicate contributes only the retained bottom chrome.
                sourceY = canvases[i].height - (i === canvases.length - 1 ? chrome.bottom : 0);
                take = i === canvases.length - 1 ? chrome.bottom : 0;
            }
            seams.push({ index: i - 1, overlap, autoOverlap: match.overlap, autoConfidence: match.confidence, confidence: manual ? 1 : match.confidence, error: match.error, duplicate, manual, position: height, maxOverlap });
            if (match.confidence < .72 && !manual && !duplicate)
                warnings.push(`Seam ${i} needs a look. Use Adjust seams to fine-tune the overlap.`);
            pieces.push({ canvas: canvases[i], sourceY, height: Math.max(0, take), destY: height });
            height += Math.max(0, take);
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        if (height > 24000 || width * height > 24000000)
            throw new Error('This stitch exceeds the 24 megapixel / 24,000px safety limit. Remove a few screenshots or choose the compact resolution.');
        check();
        report(.9, 'Locking the seams into one image');
        const output = surface(width, height);
        let blob: Blob;
        try {
            const ctx = context(output);
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, width, height);
            for (const piece of pieces)
                if (piece.height > 0)
                    ctx.drawImage(piece.canvas, 0, piece.sourceY, width, piece.height, 0, piece.destY, width, piece.height);
            check();
            blob = await canvasBlob(output);
            check();
        }
        finally {
            output.width = 1;
            output.height = 1;
        }
        report(1, 'Stitch complete');
        return { blob, width, height, seams, cropTop: chrome.top, cropBottom: chrome.bottom, warnings: [...new Set(warnings)] };
    }
    finally {
        for (const canvas of canvases) {
            canvas.width = 1;
            canvas.height = 1;
        }
    }
}
