import { imageHeaderDimensions } from './image-header';
import { uid } from './identity';
import type { Screenshot } from '../types';
import { loadBitmap, closeBitmap } from './stitch-pipeline';
import { throwIfAborted } from './async';
import { LIMITS, validateImageDimensions } from './limits';
export const MAX_FILES = LIMITS.files, MAX_FILE_BYTES = LIMITS.fileBytes, MAX_TOTAL_BYTES = LIMITS.totalBytes;
/** Check actual signatures, not a user-controlled MIME type or file extension. */
export async function imageFormat(file: Blob): Promise<'png' | 'jpeg' | 'webp' | null> {
    const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (b.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v))
        return 'png';
    if (b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255)
        return 'jpeg';
    if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP')
        return 'webp';
    return null;
}
export async function isAnimatedImage(file: Blob, format: 'png' | 'jpeg' | 'webp'): Promise<boolean> {
    if (format === 'jpeg')
        return false;
    // Inspect chunk headers in the compressed file; never decode to test animation.
    const bytes = new Uint8Array(await file.arrayBuffer());
    const view = new DataView(bytes.buffer);
    if (format === 'webp') {
        for (let offset = 12; offset + 8 <= bytes.length;) {
            const kind = String.fromCharCode(...bytes.slice(offset, offset + 4));
            const size = view.getUint32(offset + 4, true);
            if (kind === 'ANIM' || kind === 'ANMF')
                return true;
            if (kind === 'VP8X' && size > 0 && offset + 8 < bytes.length && (bytes[offset + 8] & 2) !== 0)
                return true;
            offset += 8 + size + (size % 2);
        }
    }
    else {
        for (let offset = 8; offset + 12 <= bytes.length;) {
            const size = view.getUint32(offset);
            const kind = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
            if (kind === 'acTL')
                return true;
            // acTL must precede the first IDAT in a valid APNG.
            if (kind === 'IDAT' || kind === 'IEND')
                return false;
            offset += size + 12;
        }
    }
    return false;
}
export function releaseScreenshots(images: Screenshot[]): void { images.forEach(image => URL.revokeObjectURL(image.url)); }
export async function importScreenshots(files: File[], existing: Screenshot[] = [], signal?: AbortSignal): Promise<{
    images: Screenshot[];
    errors: string[];
}> {
    const images: Screenshot[] = [], errors: string[] = [];
    let total = existing.reduce((n, s) => n + s.blob.size, 0);
    try {
        for (const file of files) {
            throwIfAborted(signal);
            if (existing.length + images.length >= MAX_FILES) {
                errors.push(`Keep a batch to ${MAX_FILES} images or fewer.`);
                break;
            }
            if (file.size > MAX_FILE_BYTES) {
                errors.push(`${file.name}: each image must be under 20 MB.`);
                continue;
            }
            if (total + file.size > MAX_TOTAL_BYTES) {
                errors.push('This batch exceeds the 100 MB input limit.');
                break;
            }
            let bitmap: ImageBitmap | HTMLImageElement | undefined;
            try {
                const format = await imageFormat(file);
                if (!format)
                    throw new Error('Use a real PNG, JPEG, or WebP image. HEIC, SVG, and animated files are not supported.');
                if (await isAnimatedImage(file, format))
                    throw new Error('Animated images are not supported. Export a still screenshot first.');
                throwIfAborted(signal);
                const declared = imageHeaderDimensions(new Uint8Array(await file.arrayBuffer()), format);
                validateImageDimensions(declared.width, declared.height);
                throwIfAborted(signal);
                bitmap = await loadBitmap(file);
                throwIfAborted(signal);
                validateImageDimensions(bitmap.width, bitmap.height);
                images.push({ id: uid(), name: file.name, url: URL.createObjectURL(file), blob: file, width: bitmap.width, height: bitmap.height });
                total += file.size;
            }
            catch (error) {
                if (signal?.aborted)
                    throw error;
                errors.push(`${file.name}: ${error instanceof Error ? error.message : 'The image could not be decoded.'}`);
            }
            finally {
                if (bitmap)
                    closeBitmap(bitmap);
            }
        }
        throwIfAborted(signal);
        return { images, errors };
    }
    catch (error) {
        releaseScreenshots(images);
        throw error;
    }
}
