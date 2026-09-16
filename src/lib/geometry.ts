import type { Rect } from '../types';
export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(Number.isFinite(value) ? value : min, min), Math.max(min, max));
export function clampRect(rect: Rect, width: number, height: number, minimum = 4): Rect {
    const w = clamp(rect.width, Math.min(minimum, width), width);
    const h = clamp(rect.height, Math.min(minimum, height), height);
    return { x: clamp(rect.x, 0, width - w), y: clamp(rect.y, 0, height - h), width: w, height: h };
}
export function intersection(a: Rect, b: Rect): number {
    return Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
}
export function intersectionOverUnion(a: Rect, b: Rect): number {
    const common = intersection(a, b);
    return common / Math.max(1, a.width * a.height + b.width * b.height - common);
}
export function unionRect(rects: Rect[]): Rect {
    if (!rects.length)
        return { x: 0, y: 0, width: 0, height: 0 };
    const x = Math.min(...rects.map(r => r.x)), y = Math.min(...rects.map(r => r.y));
    return { x, y, width: Math.max(...rects.map(r => r.x + r.width)) - x, height: Math.max(...rects.map(r => r.y + r.height)) - y };
}
export function expandRect(rect: Rect, padding: number, width: number, height: number): Rect {
    const x = Math.max(0, rect.x - padding), y = Math.max(0, rect.y - padding);
    return { x, y, width: Math.min(width, rect.x + rect.width + padding) - x, height: Math.min(height, rect.y + rect.height + padding) - y };
}
