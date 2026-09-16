/** Pure pixel-matching engine. Full vertical resolution is preserved for exact seams.
 * Horizontal subsampling reduces work without rounding the vertical alignment.
 * Flat/repetitive candidates are penalized rather than called confident matches.
 */
export interface GrayImage {
    width: number;
    height: number;
    pixels: Uint8Array;
}
export interface OverlapMatch {
    overlap: number;
    confidence: number;
    error: number;
    duplicate: boolean;
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export function sliceGray(image: GrayImage, top: number, bottom: number): GrayImage {
    top = Math.max(0, Math.min(image.height - 1, Math.floor(Number.isFinite(top) ? top : 0)));
    bottom = Math.max(top + 1, Math.min(image.height, Math.floor(Number.isFinite(bottom) ? bottom : image.height)));
    return { width: image.width, height: bottom - top, pixels: image.pixels.subarray(top * image.width, bottom * image.width) };
}
function scoreOverlap(a: GrayImage, b: GrayImage, overlap: number, detailed = false) {
    const width = Math.min(a.width, b.width), columns = Math.min(36, width - 2);
    const rows = Math.min(detailed ? 100 : 28, overlap);
    let error = 0, weights = 0, informative = 0, samples = 0;
    for (let j = 0; j < rows; j++) {
        const y = Math.min(overlap - 1, Math.floor((j + 0.37) * overlap / rows));
        const ia = (a.height - overlap + y) * a.width, ib = y * b.width;
        for (let k = 0; k < columns; k++) {
            const x = 1 + Math.floor((k + 0.43) * (width - 2) / columns);
            const va = a.pixels[ia + x], vb = b.pixels[ib + x];
            const ga = Math.abs(va - a.pixels[ia + x - 1]) + Math.abs(va - a.pixels[ia + x + 1]);
            const gb = Math.abs(vb - b.pixels[ib + x - 1]) + Math.abs(vb - b.pixels[ib + x + 1]);
            const weight = 0.12 + Math.min(3, (ga + gb) / 36);
            error += (Math.abs(va - vb) + 0.28 * Math.abs(ga - gb)) * weight;
            weights += weight;
            samples++;
            if (ga + gb > 14)
                informative++;
        }
    }
    const texture = informative / Math.max(1, samples);
    return { error: error / Math.max(1, weights) + (texture < 0.012 ? 28 : 0), texture };
}
export function findOverlap(a: GrayImage, b: GrayImage): OverlapMatch {
    if (a.width < 3 || b.width < 3 || a.height < 16 || b.height < 16)
        return { overlap: 0, confidence: 0, error: 255, duplicate: false };
    const maximum = Math.min(a.height, b.height);
    const minimum = Math.min(maximum, Math.max(24, Math.floor(maximum * 0.035)));
    // Score every vertical offset. Skipping odd rows loses exact seams in sharp text.
    const step = 1;
    const coarse: {
        overlap: number;
        error: number;
        texture: number;
    }[] = [];
    for (let overlap = minimum; overlap <= maximum; overlap += step)
        coarse.push({ overlap, ...scoreOverlap(a, b, overlap) });
    coarse.push({ overlap: maximum, ...scoreOverlap(a, b, maximum) });
    coarse.sort((x, y) => x.error - y.error);
    const visited = new Set<number>();
    const refined: typeof coarse = [];
    for (const candidate of coarse.slice(0, 10)) {
        for (let overlap = Math.max(minimum, candidate.overlap - step); overlap <= Math.min(maximum, candidate.overlap + step); overlap++) {
            if (visited.has(overlap))
                continue;
            visited.add(overlap);
            refined.push({ overlap, ...scoreOverlap(a, b, overlap, true) });
        }
    }
    refined.sort((x, y) => x.error - y.error || y.overlap - x.overlap);
    const best = refined[0];
    if (!best || best.error > 24 || best.texture < 0.009)
        return { overlap: 0, confidence: 0, error: best?.error ?? 255, duplicate: false };
    // Near-neighbor offsets are the same peak; only compare distinct alignments.
    const other = refined.find(candidate => Math.abs(candidate.overlap - best.overlap) > Math.max(8, maximum * 0.02));
    const coarseOther = coarse.find(candidate => Math.abs(candidate.overlap - best.overlap) > Math.max(8, maximum * 0.02));
    const secondError = Math.min(other?.error ?? 100, coarseOther?.error ?? 100);
    const uniqueness = clamp01((secondError - best.error) / Math.max(7, secondError));
    const texture = clamp01(best.texture / 0.04);
    const confidence = clamp01(Math.exp(-best.error / 14) * (0.58 + 0.42 * uniqueness) * texture);
    return { overlap: best.overlap, confidence, error: best.error, duplicate: best.overlap === maximum && Math.abs(a.height - b.height) < 3 && best.error < 2 };
}
function rowDifference(a: GrayImage, b: GrayImage, ya: number, yb: number) {
    let error = 0, energy = 0, count = 0;
    const width = Math.min(a.width, b.width);
    for (let x = 2; x < width - 2; x += 2) {
        error += Math.abs(a.pixels[ya * a.width + x] - b.pixels[yb * b.width + x]);
        energy += Math.abs(a.pixels[ya * a.width + x] - a.pixels[ya * a.width + x - 1]);
        count++;
    }
    return { error: error / Math.max(count, 1), energy: energy / Math.max(count, 1) };
}
/** Conservative chrome trimming: requires shared structure, not just white space.
 * Identical screenshots and bands that never reach a differing boundary are not trimmed.
 */
export function estimateRepeatedChrome(images: GrayImage[]): {
    top: number;
    bottom: number;
} {
    if (images.length < 2)
        return { top: 0, bottom: 0 };
    const height = Math.min(...images.map(i => i.height));
    const scan = (fromBottom: boolean) => {
        const limit = Math.floor(height * (fromBottom ? 0.17 : 0.23));
        let lastGood = 0, badRun = 0, structured = 0, matched = 0, hitBoundary = false;
        for (let row = 0; row < limit; row++) {
            let diff = 0, energy = 0;
            for (let i = 1; i < images.length; i++) {
                const a = images[0], b = images[i];
                const d = rowDifference(a, b, fromBottom ? a.height - 1 - row : row, fromBottom ? b.height - 1 - row : row);
                diff += d.error / (images.length - 1);
                energy += d.energy / (images.length - 1);
            }
            if (diff < 5) {
                lastGood = row + 1;
                badRun = 0;
                matched++;
                if (energy > 1.5)
                    structured++;
            }
            else if (++badRun > 8) {
                hitBoundary = true;
                break;
            }
        }
        return hitBoundary && lastGood >= 12 && structured >= 3 && matched / Math.max(lastGood, 1) > .75 ? lastGood : 0;
    };
    return { top: scan(false), bottom: scan(true) };
}
