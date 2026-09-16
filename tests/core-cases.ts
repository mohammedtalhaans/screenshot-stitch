import { imageHeaderDimensions } from '../src/lib/image-header';
import { findOverlap, sliceGray, estimateRepeatedChrome, type GrayImage } from '../src/lib/stitch-algorithm';
import { clamp, clampRect, expandRect, intersection, intersectionOverUnion, unionRect } from '../src/lib/geometry';
import { detectSensitive, deduplicateRedactions, enabledForPreset, luhnValid, ibanValid } from '../src/lib/detection';
import { historyReducer, initialHistory } from '../src/lib/history';
import { safeFilename } from '../src/lib/filename';
import { validateExportDimensions, validateImageDimensions } from '../src/lib/limits';
import { imageFormat, isAnimatedImage } from '../src/lib/files';
import { uid } from '../src/lib/identity';
import { withDeadline, workerRequest, WorkerUnavailableError } from '../src/lib/async';
import type { OcrLine, Redaction } from '../src/types';
export type TestCase = {
    name: string;
    run: () => void | Promise<void>;
};
export const cases: TestCase[] = [];
function test(name: string, run: TestCase['run']) { cases.push({ name, run }); }
function assert(value: unknown, message = 'Assertion failed'): asserts value { if (!value)
    throw new Error(message); }
function equal(actual: unknown, expected: unknown) { assert(JSON.stringify(actual) === JSON.stringify(expected), `Expected ${JSON.stringify(expected)}; got ${JSON.stringify(actual)}`); }
function throws(run: () => unknown) { let didThrow = false; try {
    run();
}
catch {
    didThrow = true;
} assert(didThrow, 'Expected rejection'); }
async function rejects(run: () => Promise<unknown> | unknown, pattern?: RegExp) { try {
    await run();
}
catch (error) {
    if (pattern)
        assert(pattern.test(String(error)), `Unexpected error: ${String(error)}`);
    return;
} throw new Error('Expected rejection'); }
function noise(width = 48, height = 1200, seed = 17): GrayImage {
    let state = seed;
    const pixels = new Uint8Array(width * height);
    for (let index = 0; index < pixels.length; index++) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        pixels[index] = state >>> 24;
    }
    return { width, height, pixels };
}
function line(text: string, y = 20, confidence = 99): OcrLine {
    let x = 10;
    return { text, confidence, words: text.split(' ').map(text => { const width = Math.max(6, text.length * 8); const word = { text, confidence, bbox: { x0: x, y0: y, x1: x + width, y1: y + 20 } }; x += width + 8; return word; }) };
}
const detect = (text: string) => detectSensitive([line(text)], 2000, 2000);
const has = (text: string, category: Redaction['category']) => assert(detect(text).some(item => item.category === category), `Missing ${category} in ${text}`);
const mask = (patch: Partial<Redaction> = {}): Redaction => ({ id: 'm', x: 10, y: 10, width: 100, height: 30, enabled: true, style: 'solid', category: 'manual', confidence: 1, text: 'test', source: 'manual', ...patch });
for (const overlap of [24, 25, 73, 150, 253, 399, 499]) {
    test(`stitch: finds exact ${overlap}px overlap, including odd offsets`, () => {
        const source = noise();
        const result = findOverlap(sliceGray(source, 0, 500), sliceGray(source, 500 - overlap, 1000 - overlap));
        equal(result.overlap, overlap);
        assert(result.confidence > .9);
        equal(result.error, 0);
    });
}
test('stitch: identical informative screenshots are duplicates', () => { const image = noise(48, 500); const result = findOverlap(image, image); equal(result.overlap, 500); assert(result.duplicate); });
test('stitch: unrelated screenshots are not silently overlapped', () => { const result = findOverlap(noise(48, 500, 11), noise(48, 500, 331)); equal(result.overlap, 0); equal(result.confidence, 0); });
test('stitch: flat screenshots produce no confident seam', () => { const image = { width: 48, height: 500, pixels: new Uint8Array(48 * 500).fill(255) }; equal(findOverlap(image, image).confidence, 0); });
test('stitch: narrow and tiny images are rejected as uninformative', () => { equal(findOverlap(noise(2, 100), noise(2, 100)).overlap, 0); equal(findOverlap(noise(48, 8), noise(48, 8)).overlap, 0); });
test('stitch: periodic content does not produce high confidence', () => { const row = noise(48, 20), pixels = new Uint8Array(48 * 500); for (let i = 0; i < pixels.length; i++)
    pixels[i] = row.pixels[i % row.pixels.length]; const image = { width: 48, height: 500, pixels }; assert(findOverlap(image, image).confidence < .72); });
test('stitch: lightly compressed pixels still match', () => { const source = noise(); const first = sliceGray(source, 0, 500), second = sliceGray(source, 247, 747); const perturbed = { ...second, pixels: Uint8Array.from(second.pixels, (value, i) => Math.max(0, Math.min(255, value + (i % 5) - 2))) }; const result = findOverlap(first, perturbed); equal(result.overlap, 253); assert(result.confidence > .8); });
test('stitch: mismatched image heights preserve overlap', () => { const source = noise(); equal(findOverlap(sliceGray(source, 0, 600), sliceGray(source, 400, 750)).overlap, 200); });
test('stitch: slice bounds cannot escape the image', () => { const image = noise(48, 100); const result = sliceGray(image, 1000, -20); equal(result.height, 1); equal(result.pixels.length, 48); });
test('stitch: detects structured repeated header and footer', () => { const a = noise(48, 500, 1), b = noise(48, 500, 2); b.pixels.set(a.pixels.subarray(0, 48 * 40)); b.pixels.set(a.pixels.subarray(48 * 475), 48 * 475); equal(estimateRepeatedChrome([a, b]), { top: 40, bottom: 25 }); });
test('stitch: does not crop identical screenshots as chrome', () => { const image = noise(48, 500); equal(estimateRepeatedChrome([image, image]), { top: 0, bottom: 0 }); });
test('stitch: does not mistake plain white margins for navigation', () => { const a = noise(48, 500, 1), b = noise(48, 500, 2); a.pixels.fill(255, 0, 48 * 40); b.pixels.fill(255, 0, 48 * 40); equal(estimateRepeatedChrome([a, b]).top, 0); });
test('geometry: handles NaN and infinity safely', () => { equal(clamp(NaN, 0, 10), 0); equal(clamp(Infinity, 2, 10), 2); equal(clamp(5, 10, 0), 10); });
test('geometry: keeps a moved rectangle inside the canvas', () => equal(clampRect({ x: 98, y: -20, width: 20, height: 30 }, 100, 100), { x: 80, y: 0, width: 20, height: 30 }));
test('geometry: clamps oversized rectangles', () => equal(clampRect({ x: -1, y: 2, width: 1000, height: 1000 }, 20, 30), { x: 0, y: 0, width: 20, height: 30 }));
test('geometry: expands boxes at image edges without negative coordinates', () => equal(expandRect({ x: 1, y: 2, width: 10, height: 10 }, 5, 20, 20), { x: 0, y: 0, width: 16, height: 17 }));
test('geometry: calculates intersections and unions', () => { const a = { x: 0, y: 0, width: 10, height: 10 }, b = { x: 5, y: 0, width: 10, height: 10 }; equal(intersection(a, b), 50); equal(intersectionOverUnion(a, b), 1 / 3); equal(unionRect([a, b]), { x: 0, y: 0, width: 15, height: 10 }); });
test('detection: plus-addressed email', () => has('Email: alex+orders@example.com', 'email'));
test('detection: international phone', () => has('Call +61 412 345 678', 'phone'));
test('detection: North American phone', () => has('Phone: +1 (415) 555-0132', 'phone'));
test('detection: username', () => has('Follow @alex.morgan', 'handle'));
test('detection: order reference', () => has('Order #SS-204891', 'identifier'));
test('detection: tracking number', () => has('Tracking: 1Z999AA10123456784', 'identifier'));
test('detection: street address', () => has('42 Willow Street, Portland OR 97205', 'address'));
test('detection: post office box', () => has('PO Box 190, Carlton VIC 3053', 'address'));
test('detection: explicitly labelled name', () => has('Name: Alex Morgan', 'name'));
test('detection: contextual NER names map back to actual pixels', () => { const results = detectSensitive([line('Message from Alex Morgan')], 1200, 200, 'strict', ['Alex Morgan']); assert(results.some(item => item.category === 'name' && item.text === 'Alex Morgan' && item.x > 0)); });
test('detection: interface labels are not treated as people', () => { const results = detectSensitive([line('Account Settings')], 1000, 300, 'strict', ['Account Settings']); assert(!results.some(item => item.category === 'name')); });
test('detection: validated card number', () => has('Card: 4242 4242 4242 4242', 'payment'));
test('detection: Luhn rejects repeated zeros and invalid digits', () => { assert(luhnValid('4242 4242 4242 4242')); assert(!luhnValid('0000 0000 0000 0000')); assert(!luhnValid('4242 4242 4242 4241')); assert(!luhnValid('1234')); });
test('detection: IBAN mod-97 check', () => { assert(ibanValid('GB82 WEST 1234 5698 7654 32')); assert(!ibanValid('GB83 WEST 1234 5698 7654 32')); assert(!ibanValid('not an IBAN')); });
test('detection: IBAN is a payment detail', () => has('GB82 WEST 1234 5698 7654 32', 'payment'));
test('detection: account and expiry fields', () => { has('BSB: 123-456', 'payment'); has('CVV: 123', 'payment'); has('Expires: 12/28', 'payment'); });
test('detection: ordinary URL is a link', () => has('Visit https://example.com/help', 'link'));
test('detection: strict preset protects links', () => assert(enabledForPreset('link', 'strict')));
for (const preset of ['chat', 'social', 'marketplace'] as const) {
    test(`detection: ${preset} preserves ordinary links but not email`, () => { assert(!enabledForPreset('link', preset)); assert(enabledForPreset('email', preset)); });
    test(`detection: secret URL tokens stay protected in ${preset}`, () => { const findings = detectSensitive([line('https://example.com/reset?token=secret123')], 2000, 2000, preset); assert(findings.some(item => item.enabled && item.category === 'identifier')); });
}
test('detection: email wins over its overlapping domain match', () => { const results = detect('alex@example.com'); equal(results.length, 1); equal(results[0].category, 'email'); });
test('detection: invalid OCR confidence cannot become NaN', () => { const results = detectSensitive([line('alex@example.com', 20, NaN)], 1000, 500); assert(results.length > 0 && results.every(item => Number.isFinite(item.confidence))); });
test('detection: dates are not telephone numbers', () => assert(!detect('2026-09-12').some(item => item.category === 'phone')));
test('detection: blank OCR yields no fake findings', () => equal(detectSensitive([], 1000, 1000), []));
test('detection: OCR text is data, including HTML-shaped content', () => { const result = detect('<script>alert(1)</script> alex@example.com'); assert(result.some(item => item.category === 'email')); });
test('detection: deduplicates tiled OCR boxes', () => equal(deduplicateRedactions([mask({ category: 'email' }), mask({ id: 'another', x: 11, y: 11, category: 'email' })]).length, 1));
test('detection: disabled suggestion cannot suppress an enabled mask', () => { const results = deduplicateRedactions([mask({ category: 'payment', enabled: false }), mask({ category: 'email' })]); assert(results.some(item => item.enabled)); });
test('detection: repeated address context extends the mask', () => { const results = detectSensitive([line('Shipping Address:', 20), line('42 Willow Street', 60), line('Portland OR 97205', 100)], 1000, 1000); assert(results.some(item => item.category === 'address' && item.y > 80)); });
test('history: edits can be undone and redone', () => { let state = initialHistory(0); state = historyReducer(state, { type: 'set', value: 1 }); state = historyReducer(state, { type: 'undo' }); equal(state.present, 0); state = historyReducer(state, { type: 'redo' }); equal(state.present, 1); });
test('history: a gesture creates one undo entry', () => { let state = initialHistory(0); state = historyReducer(state, { type: 'begin' }); for (let i = 1; i < 30; i++)
    state = historyReducer(state, { type: 'preview', value: i }); state = historyReducer(state, { type: 'commit' }); equal(state.past, [0]); equal(state.present, 29); });
test('history: falsy originals survive cancelled gestures', () => { let state = initialHistory(false); state = historyReducer(state, { type: 'begin' }); state = historyReducer(state, { type: 'preview', value: true }); state = historyReducer(state, { type: 'cancel' }); equal(state.present, false); equal(state.past.length, 0); });
test('history: click without motion does not consume an undo step', () => { let state = initialHistory('value'); state = historyReducer(state, { type: 'begin' }); state = historyReducer(state, { type: 'commit' }); equal(state.past.length, 0); });
test('history: a new edit discards the redo branch', () => { let state = initialHistory(0); state = historyReducer(state, { type: 'set', value: 1 }); state = historyReducer(state, { type: 'undo' }); state = historyReducer(state, { type: 'set', value: 2 }); equal(state.future.length, 0); });
test('history: keeps a bounded 60-step stack', () => { let state = initialHistory(0); for (let i = 1; i < 100; i++)
    state = historyReducer(state, { type: 'set', value: i }); equal(state.past.length, 60); });
test('history: reset clears all old sensitive history', () => { let state = initialHistory(['private']); state = historyReducer(state, { type: 'set', value: ['another'] }); state = historyReducer(state, { type: 'reset', value: [] }); equal(state, initialHistory([])); });
test('history: undo cancels an active gesture safely', () => { let state = initialHistory(0); state = historyReducer(state, { type: 'begin' }); state = historyReducer(state, { type: 'preview', value: 10 }); state = historyReducer(state, { type: 'undo' }); equal(state.present, 0); equal(state.transaction, null); });
test('export: sanitizes path-like filenames', () => equal(safeFilename('../../secret<script>'), 'secretscript.png'));
test('export: avoids duplicate PNG extensions', () => equal(safeFilename('photo.PNG'), 'photo.png'));
test('export: avoids reserved device names', () => equal(safeFilename('CON'), 'screenshot-stitch.png'));
test('export: uses a safe fallback and maximum name length', () => { equal(safeFilename('🔥'), 'screenshot-stitch.png'); equal(safeFilename('a'.repeat(200)).length, 84); });
test('export: rejects invalid scales and dimensions', () => { for (const scale of [0, -1, 2, NaN, Infinity])
    throws(() => validateExportDimensions(100, 100, scale)); throws(() => validateExportDimensions(3000, 9000, 1)); throws(() => validateExportDimensions(100, 25000, 1)); throws(() => validateExportDimensions(0, 100, 1)); validateExportDimensions(1200, 10000, .5); });
test('import: rejects microscopic or oversized images', () => { throws(() => validateImageDimensions(10, 100)); throws(() => validateImageDimensions(10000, 10000)); throws(() => validateImageDimensions(NaN, 200)); validateImageDimensions(780, 1040); });
test('import: checks PNG signatures rather than trusting MIME', async () => { equal(await imageFormat(new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])])), 'png'); equal(await imageFormat(new Blob(['<svg>bad</svg>'], { type: 'image/png' })), null); });
test('import: recognizes JPEG and WebP signatures', async () => { equal(await imageFormat(new Blob([new Uint8Array([255, 216, 255, 224])])), 'jpeg'); equal(await imageFormat(new Blob(['RIFF1234WEBPVP8 '])), 'webp'); });
test('import: rejects animated PNG', async () => { const bytes = new Uint8Array(28); bytes.set([137, 80, 78, 71, 13, 10, 26, 10]); new DataView(bytes.buffer).setUint32(8, 8); bytes.set([97, 99, 84, 76], 12); assert(await isAnimatedImage(new Blob([bytes]), 'png')); });
test('import: rejects animated WebP', async () => { const bytes = new Uint8Array(24); bytes.set(Array.from('RIFF0000WEBPVP8X', ch => ch.charCodeAt(0))); new DataView(bytes.buffer).setUint32(16, 4, true); bytes[20] = 2; assert(await isAnimatedImage(new Blob([bytes]), 'webp')); });
test('identity: creates unique session IDs', () => { const ids = Array.from({ length: 1000 }, uid); equal(new Set(ids).size, 1000); assert(ids.every(id => /^[0-9a-f-]{36}$/.test(id))); });
test('async: resolved deadlines return their value', async () => equal(await withDeadline(Promise.resolve(42), 1000), 42));
test('async: abort rejects promptly', async () => { const controller = new AbortController(); const promise = withDeadline(new Promise(() => { }), 1000, controller.signal); controller.abort(); await rejects(() => promise, /AbortError/); });
test('async: dead jobs eventually time out', async () => await rejects(() => withDeadline(new Promise(() => { }), 5, undefined, 'deadline reached'), /deadline reached/));
test('worker: construction failures are recognizable for fallback', async () => { try {
    await workerRequest(() => { throw new Error('blocked'); }, {});
    throw new Error('Expected failure');
}
catch (error) {
    assert(error instanceof WorkerUnavailableError);
} });
test('worker: cancellation terminates the worker exactly once', async () => { let ended = 0; const fake = { postMessage() { }, terminate() { ended++; } }; const controller = new AbortController(); const promise = workerRequest(() => fake as unknown as Worker, {}, controller.signal); controller.abort(); await rejects(() => promise, /AbortError/); equal(ended, 1); });
test('worker: success releases the worker and its timeout', async () => { let ended = 0; const fake = { onmessage: null as ((event: {
        data: unknown;
    }) => void) | null, terminate() { ended++; }, postMessage() { queueMicrotask(() => fake.onmessage?.({ data: { type: 'result', result: 123 } })); } }; equal(await workerRequest(() => fake as unknown as Worker, {}), 123); equal(ended, 1); });
test('worker: worker-side failures reject instead of hanging', async () => { const fake = { onmessage: null as ((event: {
        data: unknown;
    }) => void) | null, terminate() { }, postMessage() { queueMicrotask(() => fake.onmessage?.({ data: { type: 'error', message: 'decode failed' } })); } }; await rejects(() => workerRequest(() => fake as unknown as Worker, {}), /decode failed/); });
function pngHeader(width: number, height: number): Uint8Array {
    const bytes = new Uint8Array(33), view = new DataView(bytes.buffer);
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
    view.setUint32(8, 13);
    bytes.set(new TextEncoder().encode('IHDR'), 12);
    view.setUint32(16, width);
    view.setUint32(20, height);
    return bytes;
}
test('header: PNG dimensions are read before pixel decoding', () => equal(imageHeaderDimensions(pngHeader(1200, 2200), 'png'), { width: 1200, height: 2200 }));
test('header: huge compressed PNG inputs fail the dimension limit before decoding', () => { const size = imageHeaderDimensions(pngHeader(50000, 50000), 'png'); throws(() => validateImageDimensions(size.width, size.height)); });
test('header: truncated PNG is rejected', () => throws(() => imageHeaderDimensions(pngHeader(800, 900).subarray(0, 24), 'png')));
test('header: JPEG skips metadata and reads baseline/progressive dimensions', () => {
    for (const marker of [0xc0, 0xc2]) {
        const bytes = new Uint8Array([255, 216, 255, 225, 0, 4, 42, 43, 255, marker, 0, 8, 8, 3, 132, 2, 208, 1]);
        equal(imageHeaderDimensions(bytes, 'jpeg'), { height: 900, width: 720 });
    }
});
test('header: malformed JPEG segment lengths are rejected', () => throws(() => imageHeaderDimensions(new Uint8Array([255, 216, 255, 225, 255, 255]), 'jpeg')));
function webpHeader(kind: string, payload: number[]): Uint8Array {
    const bytes = new Uint8Array(20 + payload.length), view = new DataView(bytes.buffer);
    bytes.set(new TextEncoder().encode('RIFF'));
    view.setUint32(4, bytes.length - 8, true);
    bytes.set(new TextEncoder().encode('WEBP' + kind), 8);
    view.setUint32(16, payload.length, true);
    bytes.set(payload, 20);
    return bytes;
}
test('header: extended WebP dimensions use 24-bit little endian fields', () => equal(imageHeaderDimensions(webpHeader('VP8X', [0, 0, 0, 0, 207, 2, 0, 131, 3, 0]), 'webp'), { width: 720, height: 900 }));
test('header: lossless WebP dimensions use packed 14-bit fields', () => {
    const bits = (719 | (899 << 14)) >>> 0;
    const bytes = webpHeader('VP8L', [47, bits & 255, (bits >>> 8) & 255, (bits >>> 16) & 255, (bits >>> 24) & 255]);
    equal(imageHeaderDimensions(bytes, 'webp'), { width: 720, height: 900 });
});
test('header: lossy WebP dimensions ignore scaling hint bits', () => equal(imageHeaderDimensions(webpHeader('VP8 ', [16, 0, 0, 157, 1, 42, 208, 130, 132, 195]), 'webp'), { width: 720, height: 900 }));
test('header: truncated WebP chunks are rejected', () => throws(() => imageHeaderDimensions(webpHeader('VP8X', [0, 0, 0, 0, 207, 2, 0, 131, 3, 0]).subarray(0, 24), 'webp')));
