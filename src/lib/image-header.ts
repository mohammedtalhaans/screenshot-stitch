/** Read declared dimensions before asking a native decoder to allocate pixels.
 * This is a bounded preflight, not a replacement for the browser's image decoder.
 * PNG: W3C IHDR. WebP: RFC 9649 / VP8X, VP8L and VP8 frame headers.
 * JPEG: SOF segment dimensions (metadata segments are skipped by their lengths).
 */
export function imageHeaderDimensions(bytes: Uint8Array, format: 'png' | 'jpeg' | 'webp'): {
    width: number;
    height: number;
} {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
    const invalid = () => new Error('The image header is incomplete or unsupported. Export a new still screenshot and try again.');
    if (format === 'png') {
        if (bytes.length < 33 || view.getUint32(8) !== 13 || tag(12) !== 'IHDR')
            throw invalid();
        return { width: view.getUint32(16), height: view.getUint32(20) };
    }
    if (format === 'jpeg') {
        let offset = 2;
        while (offset < bytes.length) {
            if (bytes[offset++] !== 0xff)
                throw invalid();
            while (bytes[offset] === 0xff)
                offset++;
            if (offset >= bytes.length)
                break;
            const marker = bytes[offset++];
            if (marker === 0xda || marker === 0xd9)
                break;
            if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8))
                continue;
            if (offset + 2 > bytes.length)
                break;
            const size = view.getUint16(offset);
            if (size < 2 || offset + size > bytes.length)
                throw invalid();
            const sof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
            if (sof) {
                if (size < 8)
                    throw invalid();
                return { height: view.getUint16(offset + 3), width: view.getUint16(offset + 5) };
            }
            offset += size;
        }
        throw invalid();
    }
    const uint24 = (offset: number) => bytes[offset] + (bytes[offset + 1] << 8) + (bytes[offset + 2] << 16);
    for (let offset = 12; offset + 8 <= bytes.length;) {
        const kind = tag(offset), size = view.getUint32(offset + 4, true), start = offset + 8;
        if (start + size > bytes.length)
            throw invalid();
        if (kind === 'VP8X' && size >= 10)
            return { width: uint24(start + 4) + 1, height: uint24(start + 7) + 1 };
        if (kind === 'VP8L' && size >= 5 && bytes[start] === 0x2f) {
            const bits = view.getUint32(start + 1, true);
            return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
        }
        if (kind === 'VP8 ' && size >= 10 && bytes[start + 3] === 0x9d && bytes[start + 4] === 0x01 && bytes[start + 5] === 0x2a) {
            return { width: view.getUint16(start + 6, true) & 0x3fff, height: view.getUint16(start + 8, true) & 0x3fff };
        }
        offset += 8 + size + (size % 2);
    }
    throw invalid();
}
