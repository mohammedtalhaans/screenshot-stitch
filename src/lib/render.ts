import type { Rect, Redaction, RedactionStyle } from '../types';
import { context, surface, canvasBlob, loadBitmap, closeBitmap, type SurfaceContext } from './stitch-pipeline';
import { validateExportDimensions } from './limits';
import { throwIfAborted } from './async';
import { clampRect } from './geometry';
export const SOLID_COLOR = '#182320';
/** Paint a truly rasterized patch: nothing beneath a solid patch survives export. */
export function paintPatch(ctx: SurfaceContext, image: CanvasImageSource, rect: Rect, style: RedactionStyle, dest: Rect = { x: 0, y: 0, width: rect.width, height: rect.height }) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(dest.x, dest.y, dest.width, dest.height);
    ctx.clip();
    ctx.fillStyle = SOLID_COLOR;
    ctx.fillRect(dest.x, dest.y, dest.width, dest.height);
    if (style === 'pixelate') {
        const block = Math.max(14, Math.min(28, rect.height * .7));
        const small = surface(Math.max(1, Math.ceil(rect.width / block)), Math.max(1, Math.ceil(rect.height / block)));
        const mini = context(small);
        mini.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, small.width, small.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(small, dest.x, dest.y, dest.width, dest.height);
        small.width = small.height = 1;
    }
    else if (style === 'blur' && 'filter' in ctx) {
        // Heavy blur is a visual treatment, not a security guarantee. The UI says so.
        const blur = Math.max(12, rect.height * .42) * dest.width / rect.width;
        const patch = surface(Math.max(1, Math.ceil(dest.width)), Math.max(1, Math.ceil(dest.height)));
        const p = context(patch);
        p.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, patch.width, patch.height);
        // Stretch edge pixels outside the box; an opaque undercoat avoids transparent fringes.
        ctx.filter = `blur(${Math.min(40, blur)}px)`;
        ctx.drawImage(patch, dest.x - blur, dest.y - blur, dest.width + blur * 2, dest.height + blur * 2);
        ctx.filter = 'none';
        patch.width = patch.height = 1;
    }
    ctx.restore();
}
export async function renderExport(blob: Blob, width: number, height: number, redactions: Redaction[], scale = 1, signal?: AbortSignal): Promise<Blob> {
    throwIfAborted(signal);
    validateExportDimensions(width, height, scale);
    for (const r of redactions)
        if (r.enabled && (![r.x, r.y, r.width, r.height].every(Number.isFinite) || r.width <= 0 || r.height <= 0))
            throw new Error('A redaction has invalid coordinates. Remove it and draw a new mask.');
    const image = await loadBitmap(blob);
    let canvas: ReturnType<typeof surface> | undefined;
    try {
        canvas = surface(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
        throwIfAborted(signal);
        if (image.width !== width || image.height !== height)
            throw new Error('The source image dimensions changed. Rebuild the stitch before exporting.');
        const ctx = context(canvas);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        // Solid last: overlapping visual effects must never repaint an opaque redaction.
        const active = redactions.filter(r => r.enabled).sort((a, b) => Number(a.style === 'solid') - Number(b.style === 'solid'));
        for (const redaction of active) {
            throwIfAborted(signal);
            const rect = clampRect(redaction, width, height);
            paintPatch(ctx, image, rect, redaction.style, { x: Math.floor(rect.x * scale), y: Math.floor(rect.y * scale), width: Math.ceil(rect.width * scale) + 1, height: Math.ceil(rect.height * scale) + 1 });
        }
        const result = await canvasBlob(canvas, 'image/png');
        throwIfAborted(signal);
        return result;
    }
    finally {
        closeBitmap(image);
        if (canvas)
            canvas.width = canvas.height = 1;
    }
}
