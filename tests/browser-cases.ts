/** Real Canvas/Worker regression cases. Used by Playwright and the offline Chromium runner. */
import { stitchImages, loadBitmap, closeBitmap, canvasBlob } from '../src/lib/stitch-pipeline';
import { runStitch } from '../src/lib/stitch-client';
import { renderExport, SOLID_COLOR } from '../src/lib/render';
import { createExport } from '../src/lib/export-client';
import { importScreenshots } from '../src/lib/files';
import type { Redaction, StitchedImage } from '../src/types';
export type BrowserCase = {
    name: string;
    run: () => Promise<void>;
    requiresModuleWorker?: boolean;
};
export const browserCases: BrowserCase[] = [];
const test = (name: string, run: BrowserCase['run'], requiresModuleWorker = false) => browserCases.push({ name, run, requiresModuleWorker });
function assert(value: unknown, message = 'Assertion failed'): asserts value { if (!value)
    throw new Error(message); }
function equal(actual: unknown, expected: unknown) { assert(JSON.stringify(actual) === JSON.stringify(expected), `Expected ${JSON.stringify(expected)}; got ${JSON.stringify(actual)}`); }
async function rejects(run: () => Promise<unknown>, pattern?: RegExp) { try {
    await run();
}
catch (error) {
    if (pattern)
        assert(pattern.test(String(error)), String(error));
    return;
} throw new Error('Expected rejection'); }
function makeCanvas(width = 240, height = 1200): HTMLCanvasElement { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas; }
function noiseCanvas(width = 240, height = 1200): HTMLCanvasElement {
    const canvas = makeCanvas(width, height), ctx = canvas.getContext('2d')!, image = ctx.createImageData(width, height);
    let state = 29;
    for (let i = 0; i < image.data.length; i += 4) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        image.data[i] = state >>> 24;
        image.data[i + 1] = (state >>> 16) & 255;
        image.data[i + 2] = state & 255;
        image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
}
function pageCanvas(width = 640, height = 2000): HTMLCanvasElement {
    const canvas = makeCanvas(width, height), ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f2f4ef';
    ctx.fillRect(0, 0, width, height);
    for (let row = 0; row < height / 70; row++) {
        const x = row % 2 ? 130 : 35, y = row * 70 + 10;
        ctx.fillStyle = row % 2 ? '#d8f0c4' : '#ffffff';
        ctx.fillRect(x, y, 450, 55);
        ctx.fillStyle = '#243329';
        ctx.font = '20px Arial';
        ctx.fillText(`Message ${row + 1}: ${['An interesting detail', 'The next part of the story', 'A different thing to remember', 'Our order is ready'][row % 4]}`, x + 14, y + 33);
    }
    return canvas;
}
async function crop(source: HTMLCanvasElement, start: number, height: number, header = 0, footer = 0): Promise<Blob> {
    const canvas = makeCanvas(source.width, height + header + footer), ctx = canvas.getContext('2d')!;
    if (header) {
        ctx.fillStyle = '#17281f';
        ctx.fillRect(0, 0, source.width, header);
        ctx.fillStyle = '#b8f27d';
        ctx.font = '21px Arial';
        ctx.fillText('PRIVATE CONVERSATION', 22, 28);
    }
    ctx.drawImage(source, 0, start, source.width, height, 0, header, source.width, height);
    if (footer) {
        ctx.fillStyle = '#203c2b';
        ctx.fillRect(0, height + header, source.width, footer);
        ctx.fillStyle = '#f1f4ee';
        ctx.font = '18px Arial';
        ctx.fillText('Message…      +', 22, height + header + 25);
    }
    return canvasBlob(canvas);
}
async function pixels(blob: Blob): Promise<{
    data: Uint8ClampedArray;
    width: number;
    height: number;
}> {
    const image = await loadBitmap(blob), canvas = makeCanvas(image.width, image.height);
    try {
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(image, 0, 0);
        return { data: ctx.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height };
    }
    finally {
        closeBitmap(image);
        canvas.width = canvas.height = 1;
    }
}
// WebKit's PNG → canvas → PNG round-trip can change an RGB channel by one
// quantization level. Pixel positions and alpha must still match exactly;
// opaque redaction colors are checked separately with exact equality below.
const RGB_ROUNDTRIP_TOLERANCE = 1;
function comparePixels(a: Uint8ClampedArray, b: Uint8ClampedArray): void {
    equal(a.length, b.length);
    let outsideTolerance = 0, maximumDifference = 0;
    for (let i = 0; i < a.length; i++) {
        const difference = Math.abs(a[i] - b[i]);
        maximumDifference = Math.max(maximumDifference, difference);
        if (difference > (i % 4 === 3 ? 0 : RGB_ROUNDTRIP_TOLERANCE))
            outsideTolerance++;
    }
    assert(outsideTolerance === 0, `${outsideTolerance} channels exceed RGB ±1 / exact alpha; maximum difference ${maximumDifference}`);
}
const options = { maxWidth: 1200, trimChrome: false };
const mask = (patch: Partial<Redaction> = {}): Redaction => ({ id: 'mask', x: 20, y: 20, width: 100, height: 40, category: 'manual', confidence: 1, enabled: true, style: 'solid', source: 'manual', text: 'private', ...patch });
const asImage = (blob: Blob, width: number, height: number): StitchedImage => ({ blob, width, height, url: '', seams: [], cropTop: 0, cropBottom: 0, warnings: [] });
const color = SOLID_COLOR.slice(1).match(/../g)!.map(hex => parseInt(hex, 16)).concat(255);
for (const overlap of [25, 253, 400])
    test(`pixels: ${overlap}px stitch preserves every row at the seam`, async () => {
        const source = noiseCanvas(), first = await crop(source, 0, 500), second = await crop(source, 500 - overlap, 500);
        const result = await stitchImages([first, second], options);
        equal(result.seams[0].overlap, overlap);
        equal(result.height, 1000 - overlap);
        comparePixels((await pixels(result.blob)).data, (await pixels(await crop(source, 0, 1000 - overlap))).data);
    });
test('pixels: realistic conversation stitches without missing or repeated rows', async () => {
    const source = pageCanvas(), first = await crop(source, 0, 900), second = await crop(source, 627, 900);
    const result = await stitchImages([first, second], options);
    equal(result.seams[0].overlap, 273);
    equal(result.height, 1527);
    comparePixels((await pixels(result.blob)).data, (await pixels(await crop(source, 0, 1527))).data);
});
test('pixels: repeated navigation retains only the first header and last footer', async () => {
    const source = noiseCanvas(640, 1600), first = await crop(source, 0, 750, 50, 40), second = await crop(source, 500, 750, 50, 40);
    const result = await stitchImages([first, second], { ...options, trimChrome: true });
    assert(result.cropTop > 0 && result.cropBottom > 0);
    equal(result.height, 1340);
    comparePixels((await pixels(result.blob)).data, (await pixels(await crop(source, 0, 1250, 50, 40))).data);
});
test('pixels: a duplicate does not create a repeated copy', async () => { const source = noiseCanvas(), blob = await crop(source, 0, 500); const result = await stitchImages([blob, blob], options); equal(result.height, 500); assert(result.seams[0].duplicate); comparePixels((await pixels(result.blob)).data, (await pixels(blob)).data); });
test('pixels: duplicates between useful images do not break later seams', async () => { const source = noiseCanvas(), first = await crop(source, 0, 500), second = await crop(source, 247, 500); const result = await stitchImages([first, first, second], options); equal(result.height, 747); comparePixels((await pixels(result.blob)).data, (await pixels(await crop(source, 0, 747))).data); });
test('pixels: manual seam values are applied exactly', async () => { const source = noiseCanvas(), first = await crop(source, 0, 500), second = await crop(source, 247, 500); const result = await stitchImages([first, second], { ...options, manualOverlaps: { 0: 253 } }); equal(result.height, 747); assert(result.seams[0].manual); equal(result.seams[0].autoOverlap, 253); });
test('pixels: no-overlap manual join preserves every row', async () => { const source = noiseCanvas(), first = await crop(source, 0, 500), second = await crop(source, 500, 500); const result = await stitchImages([first, second], { ...options, manualOverlaps: { 0: 0 } }); equal(result.height, 1000); comparePixels((await pixels(result.blob)).data, (await pixels(await crop(source, 0, 1000))).data); });
test('pixels: single screenshots can be redacted without stitching', async () => { const source = noiseCanvas(), blob = await crop(source, 0, 500); const result = await stitchImages([blob], { ...options, trimChrome: true }); equal(result.seams.length, 0); comparePixels((await pixels(result.blob)).data, (await pixels(blob)).data); });
test('worker: stitching runs in a real module worker', async () => { const source = noiseCanvas(), first = await crop(source, 0, 500), second = await crop(source, 247, 500); const controller = new AbortController(); const messages: string[] = []; const result = await runStitch([first, second], options, controller.signal, (_, text) => messages.push(text)); equal(result.height, 747); assert(!messages.some(text => text.includes('compatibility')), 'Module worker failed; main-thread fallback is not proof of worker execution'); }, true);
test('worker: an aborted stitch does not return an image', async () => { const source = noiseCanvas(), blob = await crop(source, 0, 500); const controller = new AbortController(); const job = runStitch([blob, blob], options, controller.signal, () => { }); controller.abort(); await rejects(() => job, /AbortError/); });
test('fallback: browsers without OffscreenCanvas still export real pixels', async () => {
    const original = globalThis.OffscreenCanvas;
    try {
        Object.defineProperty(globalThis, 'OffscreenCanvas', { value: undefined, configurable: true });
        const source = noiseCanvas(), blob = await crop(source, 0, 500);
        const result = await stitchImages([blob], options);
        const output = await renderExport(result.blob, result.width, result.height, [mask()]);
        const decoded = await pixels(output);
        equal(Array.from(decoded.data.slice((25 * decoded.width + 25) * 4, (25 * decoded.width + 25) * 4 + 4)), color);
    }
    finally {
        Object.defineProperty(globalThis, 'OffscreenCanvas', { value: original, configurable: true });
    }
});
test('fallback: blocked worker construction uses the canvas renderer', async () => {
    const original = globalThis.Worker;
    try {
        Object.defineProperty(globalThis, 'Worker', { value: class {
                constructor() { throw new Error('blocked'); }
            }, configurable: true });
        const blob = await crop(noiseCanvas(), 0, 500), messages: string[] = [];
        const result = await runStitch([blob], options, new AbortController().signal, (_, message) => messages.push(message));
        equal(result.height, 500);
        assert(messages.some(message => message.includes('compatibility')));
    }
    finally {
        Object.defineProperty(globalThis, 'Worker', { value: original, configurable: true });
    }
}, true);
test('export: solid masks replace every covered pixel and preserve the rest', async () => {
    const source = noiseCanvas(240, 200), original = await canvasBlob(source);
    const redaction = mask();
    const output = await pixels(await renderExport(original, 240, 200, [redaction]));
    const before = (await pixels(original)).data;
    for (let y = 0; y < 200; y++)
        for (let x = 0; x < 240; x++) {
            const index = (y * 240 + x) * 4;
            if (x >= 20 && x < 121 && y >= 20 && y < 61)
                equal(Array.from(output.data.slice(index, index + 4)), color);
            else
                for (let c = 0; c < 4; c++)
                    assert(Math.abs(output.data[index + c] - before[index + c]) <= (c === 3 ? 0 : RGB_ROUNDTRIP_TOLERANCE), `Unmasked pixel ${x},${y} channel ${c} changed beyond round-trip rounding`);
        }
});
test('export: disabled masks leave original pixels untouched', async () => { const blob = await canvasBlob(noiseCanvas(240, 200)); comparePixels((await pixels(await renderExport(blob, 240, 200, [mask({ enabled: false })]))).data, (await pixels(blob)).data); });
test('export: selected-style overlaps cannot repaint a solid mask', async () => {
    const blob = await canvasBlob(noiseCanvas(240, 200));
    const redactions = [mask(), mask({ id: 'blur', x: 30, y: 30, style: 'blur' }), mask({ id: 'pixel', x: 35, y: 35, style: 'pixelate' })];
    const output = await pixels(await renderExport(blob, 240, 200, redactions));
    for (let y = 35; y < 60; y++)
        for (let x = 35; x < 120; x++)
            equal(Array.from(output.data.slice((y * 240 + x) * 4, (y * 240 + x) * 4 + 4)), color);
});
test('export: all supported scales cover fractional mask edges', async () => {
    const blob = await canvasBlob(noiseCanvas(240, 200));
    for (const scale of [1, .75, .5]) {
        const output = await pixels(await renderExport(blob, 240, 200, [mask({ x: 20.7, y: 21.3, width: 100.2, height: 39.8 })], scale));
        equal(output.width, Math.round(240 * scale));
        for (let y = Math.ceil(22 * scale); y < Math.floor(60 * scale); y++)
            for (let x = Math.ceil(22 * scale); x < Math.floor(120 * scale); x++)
                equal(Array.from(output.data.slice((y * output.width + x) * 4, (y * output.width + x) * 4 + 4)), color);
    }
});
test('export: malformed rectangles are rejected rather than silently exposing data', async () => { const blob = await canvasBlob(noiseCanvas(240, 200)); await rejects(() => renderExport(blob, 240, 200, [mask({ width: NaN })]), /invalid coordinates/); await rejects(() => renderExport(blob, 240, 200, [mask({ height: -5 })]), /invalid coordinates/); });
test('export: source dimension mismatches are rejected', async () => { const blob = await canvasBlob(noiseCanvas(240, 200)); await rejects(() => renderExport(blob, 200, 200, [mask()]), /dimensions changed/); });
test('export: a real module worker creates a flattened PNG', async () => {
    const blob = await canvasBlob(noiseCanvas(240, 200));
    const OriginalWorker = globalThis.Worker;
    let workerReturned = false;
    try {
        // Observe the actual result, so a successful main-thread fallback cannot pass this test.
        globalThis.Worker = class extends OriginalWorker {
            constructor(url: string | URL, options?: WorkerOptions) {
                super(url, options);
                this.addEventListener('message', event => { if (event.data?.type === 'result')
                    workerReturned = true; });
            }
        };
        const result = await createExport(asImage(blob, 240, 200), [mask()], 1);
        equal(result.type, 'image/png');
        equal((await pixels(result)).width, 240);
        assert(workerReturned, 'Module worker did not return an image; fallback is not proof of worker execution');
    }
    finally {
        globalThis.Worker = OriginalWorker;
    }
}, true);
test('export: transparent inputs become an opaque share image', async () => { const source = makeCanvas(240, 200); const result = await pixels(await renderExport(await canvasBlob(source), 240, 200, [mask()])); equal(Array.from(result.data.slice(0, 4)), [255, 255, 255, 255]); for (let i = 3; i < result.data.length; i += 4)
    equal(result.data[i], 255); });
test('import: actual screenshots decode and keep their filenames', async () => { const blob = await canvasBlob(noiseCanvas(240, 200)); const result = await importScreenshots([new File([blob], 'sample.png', { type: 'image/png' })]); equal(result.errors, []); equal(result.images[0].name, 'sample.png'); equal(result.images[0].width, 240); result.images.forEach(image => URL.revokeObjectURL(image.url)); });
test('import: invalid content is rejected without corrupting valid uploads', async () => { const blob = await canvasBlob(noiseCanvas(240, 200)); const result = await importScreenshots([new File(['<svg onload="alert(1)"></svg>'], 'fake.png', { type: 'image/png' }), new File([blob], 'valid.png', { type: 'image/png' })]); equal(result.images.length, 1); equal(result.errors.length, 1); result.images.forEach(image => URL.revokeObjectURL(image.url)); });
test('import: cancelling a read rejects and discards the session', async () => { const blob = await canvasBlob(noiseCanvas(240, 200)), controller = new AbortController(); controller.abort(); await rejects(() => importScreenshots([new File([blob], 'test.png')], [], controller.signal), /AbortError/); });
function crc32(bytes: Uint8Array): number {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++)
            crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
}
function textChunk(text: string): Uint8Array<ArrayBuffer> {
    const payload = new TextEncoder().encode('Comment\0' + text);
    const chunk = new Uint8Array(payload.length + 12), view = new DataView(chunk.buffer);
    view.setUint32(0, payload.length);
    chunk.set(new TextEncoder().encode('tEXt'), 4);
    chunk.set(payload, 8);
    view.setUint32(chunk.length - 4, crc32(chunk.subarray(4, chunk.length - 4)));
    return chunk;
}
test('export: embedded private PNG metadata is not copied into the export', async () => {
    const original = new Uint8Array(await (await canvasBlob(noiseCanvas(240, 200))).arrayBuffer());
    const secret = 'private-metadata-sentinel@example.com';
    const withMetadata = new Blob([original.subarray(0, 33), textChunk(secret), original.subarray(33)], { type: 'image/png' });
    const result = await renderExport(withMetadata, 240, 200, [mask()]);
    const bytes = new Uint8Array(await result.arrayBuffer());
    assert(!new TextDecoder().decode(bytes).includes(secret), 'Source metadata leaked into PNG output');
    equal((await pixels(result)).width, 240);
});
test('import: native JPEG and WebP still images pass header preflight', async () => {
    const source = noiseCanvas(240, 200);
    for (const type of ['image/jpeg', 'image/webp']) {
        const blob = await canvasBlob(source, type);
        const result = await importScreenshots([new File([blob], type === 'image/jpeg' ? 'photo.jpg' : 'photo.webp', { type })]);
        equal(result.errors, []);
        equal(result.images.length, 1);
        equal(result.images[0].width, 240);
        result.images.forEach(image => URL.revokeObjectURL(image.url));
    }
});
test('import: oversized PNG headers are rejected without invoking a pixel decoder', async () => {
    const bytes = new Uint8Array(33), view = new DataView(bytes.buffer);
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
    view.setUint32(8, 13);
    bytes.set(new TextEncoder().encode('IHDR'), 12);
    view.setUint32(16, 50000);
    view.setUint32(20, 50000);
    const original = globalThis.createImageBitmap;
    let decoderCalled = false;
    try {
        globalThis.createImageBitmap = (async () => { decoderCalled = true; throw new Error('Do not allocate this image'); }) as typeof createImageBitmap;
        const result = await importScreenshots([new File([bytes], 'oversized.png', { type: 'image/png' })]);
        equal(result.images.length, 0);
        equal(result.errors.length, 1);
        assert(!decoderCalled, 'Unsafe header reached the image decoder');
    }
    finally {
        globalThis.createImageBitmap = original;
    }
});
