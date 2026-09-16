import type { Page } from '@playwright/test';
/** Synthetic, non-personal fixtures are drawn in the browser; never real user files. */
export async function screenshots(page: Page, two = true) {
    const encoded = await page.evaluate(() => {
        const full = document.createElement('canvas');
        full.width = 720;
        full.height = 1380;
        const ctx = full.getContext('2d')!;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, full.width, full.height);
        const lines = [
            'PRIVATE CONVERSATION', 'Name: Alex Morgan', 'Email: alex@example.com',
            'The package is ready to collect.', 'Phone: +61 412 345 678', 'Order ID: ORD-2026-849102',
            'Send the receipt after pickup.', 'Keep a copy of the invoice.', 'The door opens at nine.',
            'Address: 18 Willow Street', 'Please use the side entrance.', 'Email: hello@example.com',
            'The confirmation will arrive today.', 'Thank you for your help.', 'One more thing to remember.',
            'Use the same reference next time.', 'There is nothing else to add.', 'This is the final message.',
        ];
        lines.forEach((line, index) => {
            const y = 45 + index * 73;
            ctx.fillStyle = index % 2 ? '#e9f0e5' : '#f3f4f1';
            ctx.fillRect(14, y - 28, 692, 58);
            ctx.fillStyle = '#13241b';
            ctx.font = '27px Arial';
            ctx.fillText(line, 30, y + 10);
            // Non-repeating structure at every row makes alignment objectively testable.
            ctx.fillStyle = '#2d6950';
            ctx.fillRect(690 - index * 2, y - 26, 4, 51);
        });
        const crop = (start: number) => {
            const canvas = document.createElement('canvas');
            canvas.width = 720;
            canvas.height = 900;
            canvas.getContext('2d')!.drawImage(full, 0, start, 720, 900, 0, 0, 720, 900);
            return canvas.toDataURL('image/png').split(',')[1];
        };
        return [crop(0), crop(480)];
    });
    return encoded.slice(0, two ? 2 : 1).map((base64, index) => ({ name: `screenshot-${index + 1}.png`, mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') }));
}
export async function upload(page: Page, two = true) {
    await page.getByLabel('Upload screenshots', { exact: true }).setInputFiles(await screenshots(page, two));
    await page.locator('.prepare-page').waitFor();
}
export async function waitForReview(page: Page) {
    await page.locator('.review-page').waitFor({ timeout: 150000 });
    await page.locator('.original-image').evaluate((image: HTMLImageElement) => image.decode());
}
export async function noPageOverflow(page: Page) {
    const dimensions = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
    if (dimensions.content > dimensions.viewport + 1)
        throw new Error(`Page overflows: ${dimensions.content}px > ${dimensions.viewport}px`);
}
