import { uid } from './identity';
/** Synthetic screenshots, generated locally. They go through the exact same engines
 * as uploads: no hard-coded match results, OCR output, or pre-seeded redactions. */
import type { Screenshot } from '../types';
const W = 780, CH = 2200;
function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string) { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size = 24, color = '#28322e', weight = 400) { ctx.font = `${weight} ${size}px Arial, sans-serif`; ctx.fillStyle = color; ctx.fillText(value, x, y); }
function bubble(ctx: CanvasRenderingContext2D, y: number, lines: string[], own = false) { const x = own ? 160 : 68, w = own ? 555 : 594, h = lines.length * 38 + 40; rounded(ctx, x, y, w, h, 18, own ? '#dff3cc' : '#ffffff'); lines.forEach((line, i) => text(ctx, line, x + 24, y + 42 + i * 38)); return h; }
export async function makeDemo(): Promise<Screenshot[]> {
    const surfaces: HTMLCanvasElement[] = [], images: Screenshot[] = [];
    try {
        const content = document.createElement('canvas');
        surfaces.push(content);
        content.width = W;
        content.height = CH;
        const c = content.getContext('2d')!;
        c.fillStyle = '#f0f2ee';
        c.fillRect(0, 0, W, CH);
        text(c, 'TODAY, 10:24 AM', 295, 46, 17, '#89928a', 600);
        rounded(c, 20, 82, 34, 34, 17, '#748570');
        text(c, 'A', 30, 106, 20, '#fff', 700);
        text(c, 'Alex Morgan', 72, 91, 22, '#3a4639', 700);
        bubble(c, 112, ['Hey! Here are the details for the order.', 'Email: alex.morgan@example.com', 'Phone: +1 (415) 555-0132']);
        text(c, '10:24', 74, 293, 16, '#8a928a');
        bubble(c, 345, ['Perfect, thank you!', 'Where should we send it?'], true);
        text(c, '10:25  ✓✓', 617, 484, 16, '#7b8877');
        text(c, 'Alex Morgan', 72, 565, 22, '#3a4639', 700);
        bubble(c, 588, ['Please send it to:', '42 Willow Street', 'Portland, OR 97205', 'Leave the package at the front door.']);
        text(c, '10:26', 74, 806, 16, '#8a928a');
        bubble(c, 864, ['Got it. I will send you a tracking link', 'once it is on the way.'], true);
        text(c, '10:27  ✓✓', 617, 1005, 16, '#7b8877');
        text(c, 'Alex Morgan', 72, 1070, 22, '#3a4639', 700);
        bubble(c, 1094, ['Order #SS-204891', 'Tracking: 1Z999AA10123456784', 'I am @alex.morgan on the app.']);
        text(c, '10:28', 74, 1276, 16, '#8a928a');
        bubble(c, 1330, ['Everything looks good on our side.', 'Your payment receipt is below.'], true);
        text(c, '10:29  ✓✓', 617, 1468, 16, '#7b8877');
        rounded(c, 68, 1530, 594, 400, 20, '#ffffff');
        text(c, 'PAYMENT RECEIPT', 94, 1572, 19, '#6a7967', 700);
        text(c, 'Alex Morgan', 94, 1620, 26, '#28322e', 600);
        text(c, 'Card: 4242 4242 4242 4242', 94, 1664, 25);
        text(c, 'Receipt #RC-092418', 94, 1708, 24);
        text(c, '$ 128.00', 94, 1770, 35, '#28322e', 600);
        const QRCode = await import('qrcode');
        const qr = document.createElement('canvas');
        surfaces.push(qr);
        await QRCode.toCanvas(qr, 'https://example.com/order/SS-204891', { width: 142, margin: 2, color: { dark: '#202920', light: '#ffffff' } });
        c.drawImage(qr, 478, 1765, 140, 140);
        text(c, 'Order details', 94, 1842, 22, '#7b8877');
        text(c, 'Scan to view →', 94, 1878, 22, '#7b8877');
        bubble(c, 1990, ['Thanks! Looking forward to it.'], true);
        text(c, '10:31  ✓✓', 617, 2095, 16, '#7b8877');
        for (const [index, offset] of [0, 660, 1320].entries()) {
            const canvas = document.createElement('canvas');
            surfaces.push(canvas);
            canvas.width = W;
            canvas.height = 1040;
            const ctx = canvas.getContext('2d')!;
            ctx.fillStyle = '#fcfcf9';
            ctx.fillRect(0, 0, W, 1040);
            text(ctx, '9:41', 32, 31, 19, '#293429', 700);
            text(ctx, '‹', 28, 77, 35);
            rounded(ctx, 67, 48, 38, 38, 19, '#748570');
            text(ctx, 'A', 79, 75, 21, '#fff', 700);
            text(ctx, 'Alex Morgan', 124, 70, 25, '#28322e', 600);
            text(ctx, 'Online', 125, 92, 15, '#748570');
            text(ctx, '•••', 714, 76, 26);
            ctx.strokeStyle = '#e2e6de';
            ctx.beginPath();
            ctx.moveTo(0, 99);
            ctx.lineTo(W, 99);
            ctx.stroke();
            ctx.drawImage(content, 0, offset, W, 880, 0, 100, W, 880);
            ctx.fillStyle = '#fcfcf9';
            ctx.fillRect(0, 980, W, 60);
            rounded(ctx, 53, 990, 660, 36, 18, '#eef0ea');
            text(ctx, '+', 19, 1018, 28, '#677561');
            text(ctx, 'Message', 76, 1015, 20, '#959d91');
            text(ctx, '↑', 681, 1016, 25, '#516548');
            const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not create the demo.')), 'image/png'));
            images.push({ id: uid(), name: `conversation-0${index + 1}.png`, blob, url: URL.createObjectURL(blob), width: W, height: 1040 });
        }
        return images;
    }
    catch (error) {
        for (const image of images)
            URL.revokeObjectURL(image.url);
        throw error;
    }
    finally {
        for (const surface of surfaces)
            surface.width = surface.height = 1;
    }
}
