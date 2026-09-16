/** Conservative allocation limits shared by the UI, workers and exporters. */
export const LIMITS = Object.freeze({
    files: 12,
    fileBytes: 20 * 1024 * 1024,
    totalBytes: 100 * 1024 * 1024,
    inputPixels: 48000000,
    normalizedPixels: 40000000,
    outputPixels: 24000000,
    outputHeight: 24000,
    minimumDimension: 32,
});
export function validateImageDimensions(width: number, height: number): void {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < LIMITS.minimumDimension || height < LIMITS.minimumDimension) {
        throw new Error('The image is too small or has invalid dimensions. Use an image at least 32 × 32 pixels.');
    }
    if (width * height > LIMITS.inputPixels)
        throw new Error('Each input must be below 48 megapixels.');
}
export function validateExportDimensions(width: number, height: number, scale: number): void {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
        throw new Error('The export has invalid image dimensions.');
    }
    if (!Number.isFinite(scale) || scale <= 0 || scale > 1) {
        throw new Error('Choose an export scale greater than zero and no larger than the original.');
    }
    if (width * height > LIMITS.outputPixels || height > LIMITS.outputHeight) {
        throw new Error('The image exceeds the 24 megapixel / 24,000px export limit.');
    }
}
