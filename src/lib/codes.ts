import jsQR from 'jsqr';
import { BinaryBitmap, HybridBinarizer, RGBLuminanceSource, MultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';
import { deduplicateRedactions } from './detection';
import { surface, context, loadBitmap, closeBitmap } from './stitch-pipeline';
import { expandRect } from './geometry';
import { throwIfAborted } from './async';
import type { Redaction } from '../types';

/** The same bounded decoder runs in a worker or on a browser canvas. */
export async function detectCodes(data: { blob: Blob; width: number; height: number }, signal?: AbortSignal, progress: (value: number) => void = () => { }): Promise<Redaction[]> {
    throwIfAborted(signal);
    const image = await loadBitmap(data.blob), results: Redaction[] = [];
    try {
        throwIfAborted(signal);
        const scale = Math.min(1, 1000 / data.width), tileHeight = 1200, overlap = 120;
        const width = Math.round(data.width * scale), scaledHeight = Math.round(data.height * scale);
        const reader = new MultiFormatReader();
        const hints = new Map();
        hints.set(DecodeHintType.TRY_HARDER, true);
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.ITF, BarcodeFormat.DATA_MATRIX, BarcodeFormat.PDF_417]);
        for (let y = 0; y < scaledHeight; y += tileHeight - overlap) {
            // Let paint and cancellation run between tiles in the compatibility path.
            await new Promise(resolve => setTimeout(resolve, 0));
            throwIfAborted(signal);
            const height = Math.min(tileHeight, scaledHeight - y), canvas = surface(width, height);
            try {
                const ctx = context(canvas);
                ctx.drawImage(image, 0, y / scale, data.width, height / scale, 0, 0, width, height);
                const rgba = ctx.getImageData(0, 0, width, height);
                // Blank each decoded QR code so another in this tile can be found.
                for (let attempt = 0; attempt < 6; attempt++) {
                    throwIfAborted(signal);
                    const code = jsQR(rgba.data, width, height, { inversionAttempts: 'attemptBoth' });
                    if (!code)
                        break;
                    const corners = [code.location.topLeftCorner, code.location.topRightCorner, code.location.bottomLeftCorner, code.location.bottomRightCorner];
                    const left = Math.min(...corners.map(p => p.x)), top = Math.min(...corners.map(p => p.y));
                    const right = Math.max(...corners.map(p => p.x)), bottom = Math.max(...corners.map(p => p.y));
                    const box = expandRect({ x: left / scale, y: (y + top) / scale, width: (right - left) / scale, height: (bottom - top) / scale }, 12, data.width, data.height);
                    results.push({ ...box, id: `code-${results.length}`, category: 'code', confidence: .99, text: 'QR code', enabled: true, style: 'solid', source: 'code' });
                    for (let py = Math.max(0, Math.floor(top) - 8); py < Math.min(height, Math.ceil(bottom) + 8); py++)
                        for (let px = Math.max(0, Math.floor(left) - 8); px < Math.min(width, Math.ceil(right) + 8); px++) {
                            const i = (py * width + px) * 4;
                            rgba.data[i] = rgba.data[i + 1] = rgba.data[i + 2] = 255;
                        }
                }
                throwIfAborted(signal);
                // Barcode decoding is best-effort. A miss never means "safe".
                try {
                    const luminance = new Uint8ClampedArray(width * height);
                    for (let i = 0; i < luminance.length; i++)
                        luminance[i] = Math.round(.299 * rgba.data[i * 4] + .587 * rgba.data[i * 4 + 1] + .114 * rgba.data[i * 4 + 2]);
                    const decoded = reader.decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luminance, width, height))), hints);
                    const points = decoded.getResultPoints();
                    if (points.length >= 2) {
                        const left = Math.min(...points.map(p => p.getX())), right = Math.max(...points.map(p => p.getX()));
                        const top = Math.min(...points.map(p => p.getY())), bottom = Math.max(...points.map(p => p.getY()));
                        const box = expandRect({ x: left / scale, y: (y + top - 45) / scale, width: (right - left) / scale, height: Math.max(90, bottom - top + 90) / scale }, 14, data.width, data.height);
                        results.push({ ...box, id: `barcode-${results.length}`, category: 'code', confidence: .76, text: 'Barcode — check the box covers its entire height', enabled: true, style: 'solid', source: 'code' });
                    }
                }
                catch { /* NotFoundException is an ordinary negative result. */ }
                finally { reader.reset(); }
            }
            finally {
                canvas.width = canvas.height = 1;
            }
            throwIfAborted(signal);
            progress(Math.min(1, (y + height) / scaledHeight));
            if (y + height >= scaledHeight)
                break;
        }
        throwIfAborted(signal);
        return deduplicateRedactions(results);
    }
    finally {
        closeBitmap(image);
    }
}
