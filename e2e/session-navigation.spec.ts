import { test, expect } from '@playwright/test';
import { upload, waitForReview } from './fixtures';

test('returning to uploads and interrupted rebuilds preserve the completed edit', async ({ page, context }) => {
    // Use the real compatibility pipeline so a deliberate decoder failure can be
    // injected consistently across Chromium and WebKit after the initial stitch.
    await context.addInitScript(() => {
        Object.defineProperty(window, 'OffscreenCanvas', { value: undefined, configurable: true });
        const original = window.createImageBitmap.bind(window);
        window.createImageBitmap = ((image: ImageBitmapSource, options?: ImageBitmapOptions) => {
            if ((window as Window & { failNextDecode?: boolean }).failNextDecode)
                return Promise.reject(new Error('The test image decoder is unavailable.'));
            return original(image, options);
        }) as typeof createImageBitmap;
    });
    let holdOcr = false;
    const releaseRequests: (() => void)[] = [];
    await context.route('**/ocr/**', async route => {
        if (holdOcr)
            await new Promise<void>(resolve => releaseRequests.push(resolve));
        await route.abort('failed').catch(() => { });
    });
    await page.goto('/screenshot-stitch/');
    await upload(page);
    await page.getByRole('button', { name: 'Stitch & protect', exact: true }).click();
    await waitForReview(page);
    await page.getByRole('button', { name: /Add a manual redaction/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('region', { name: 'Screenshot canvas', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.redaction-mask')).toHaveCount(1);
    const originalUrl = await page.locator('.original-image').getAttribute('src');
    const originalMask = await page.locator('.redaction-mask').getAttribute('id');
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    const retainedZoom = await page.locator('.zoom-level').innerText();
    await page.getByRole('button', { name: 'Back to screenshots', exact: true }).click();
    await expect(page.locator('.screenshot-item')).toHaveCount(2);
    await page.getByRole('button', { name: 'Remove screenshot-2.png', exact: true }).click();
    await expect(page.locator('.screenshot-item')).toHaveCount(1);
    // Hidden review shortcuts must not delete or modify the retained edit.
    await page.getByRole('button', { name: 'Resume review', exact: true }).focus();
    await page.keyboard.press('Delete');
    await page.keyboard.press('Enter');
    await waitForReview(page);
    await expect(page.locator('.original-image')).toHaveAttribute('src', originalUrl!);
    await expect(page.locator('.redaction-mask.is-selected')).toHaveAttribute('id', originalMask!);
    await expect(page.locator('.zoom-level')).toHaveText(retainedZoom);
    // Removing a draft input must not revoke the completed stitch's seam sources.
    await page.getByRole('button', { name: /Adjust seams|seam.*to review/ }).click();
    const seamImages = page.getByRole('dialog').locator('img');
    await expect(seamImages).toHaveCount(2);
    await seamImages.evaluateAll(async images => { await Promise.all(images.map(image => (image as HTMLImageElement).decode())); });
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Back to screenshots', exact: true }).click();
    holdOcr = true;
    await page.getByRole('button', { name: 'Scan & protect', exact: true }).click();
    const pendingImage = page.getByRole('img', { name: 'Stitched image being scanned', exact: true });
    await expect(pendingImage).toBeVisible();
    await expect(pendingImage).not.toHaveAttribute('src', originalUrl!);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    holdOcr = false;
    releaseRequests.splice(0).forEach(release => release());
    await waitForReview(page);
    await expect(page.locator('.processing-page')).toHaveCount(0);
    await expect(page.locator('.original-image')).toHaveAttribute('src', originalUrl!);
    await expect(page.locator('.redaction-mask.is-selected')).toHaveAttribute('id', originalMask!);
    await expect(page.locator('.zoom-level')).toHaveText(retainedZoom);
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();

    await page.getByRole('button', { name: 'Back to screenshots', exact: true }).click();
    await page.evaluate(() => { (window as Window & { failNextDecode?: boolean }).failNextDecode = true; });
    await page.getByRole('button', { name: 'Scan & protect', exact: true }).click();
    await waitForReview(page);
    await expect(page.locator('.toast-stack')).toContainText('The test image decoder is unavailable.');
    await expect(page.locator('.original-image')).toHaveAttribute('src', originalUrl!);
    await expect(page.locator('.redaction-mask.is-selected')).toHaveAttribute('id', originalMask!);

    // A successful explicit rebuild is the point where the old edit is replaced.
    await page.evaluate(() => { (window as Window & { failNextDecode?: boolean }).failNextDecode = false; });
    await page.getByRole('button', { name: 'Back to screenshots', exact: true }).click();
    await page.getByRole('button', { name: 'Scan & protect', exact: true }).click();
    await waitForReview(page);
    await expect(page.locator('.original-image')).not.toHaveAttribute('src', originalUrl!);
    await expect(page.locator('.original-image')).toHaveJSProperty('naturalHeight', 900);
    await expect(page.locator('.redaction-mask')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Fit width', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
});
