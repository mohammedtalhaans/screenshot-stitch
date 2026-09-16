import { expect, test, type Page } from '@playwright/test';
import { noPageOverflow, upload, waitForReview } from './fixtures';

async function openEditor(page: Page) {
    // Exercise the real stitch; OCR availability does not affect navigation.
    await page.context().route('**/ocr/**', route => route.abort('failed'));
    await page.goto('/screenshot-stitch/');
    await upload(page);
    await page.getByRole('switch', { name: 'Auto-crop repeated headers and footers' }).uncheck();
    await page.getByRole('button', { name: 'Stitch & protect' }).click();
    await waitForReview(page);
}

async function canvasMetrics(page: Page) {
    return page.locator('.canvas-viewport').evaluate(viewport => {
        const stage = viewport.querySelector<HTMLElement>('.image-stage')!;
        const image = viewport.querySelector<HTMLImageElement>('.original-image')!;
        const canvasBox = stage.getBoundingClientRect(), viewportBox = viewport.getBoundingClientRect();
        const scale = canvasBox.width / image.naturalWidth;
        return {
            width: canvasBox.width,
            height: canvasBox.height,
            sourceWidth: image.naturalWidth,
            scale,
            viewportWidth: viewport.clientWidth,
            viewportHeight: viewport.clientHeight,
            scrollHeight: viewport.scrollHeight,
            left: canvasBox.left - viewportBox.left - viewport.clientLeft,
            top: canvasBox.top - viewportBox.top - viewport.clientTop,
            centerX: (viewportBox.left + viewport.clientLeft + viewport.clientWidth / 2 - canvasBox.left) / scale,
            centerY: (viewportBox.top + viewport.clientTop + viewport.clientHeight / 2 - canvasBox.top) / scale,
        };
    });
}

test('keyboard zoom reports actual pixels and both fit modes respect the viewport', async ({ page }) => {
    await openEditor(page);
    const fitWidth = page.getByRole('button', { name: 'Fit width', exact: true });
    const fitImage = page.getByRole('button', { name: 'Fit image', exact: true });
    const actualSize = page.getByRole('button', { name: 'Actual size (100%)', exact: true });
    await expect(fitWidth).toHaveAttribute('aria-pressed', 'true');

    const initial = await canvasMetrics(page);
    expect(initial.width).toBeLessThanOrEqual(initial.viewportWidth);
    await expect(actualSize).toHaveText(`${Math.round(initial.scale * 100)}%`);
    await actualSize.focus();
    await page.keyboard.press('Enter');
    await expect.poll(async () => Math.round((await canvasMetrics(page)).width)).toBe(initial.sourceWidth);
    await expect(actualSize).toHaveText('100%');

    await fitImage.focus();
    await page.keyboard.press('Enter');
    await expect(fitImage).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => {
        const metrics = await canvasMetrics(page);
        return metrics.left >= -1 && metrics.top >= -1
            && metrics.left + metrics.width <= metrics.viewportWidth + 1
            && metrics.top + metrics.height <= metrics.viewportHeight + 1
            && metrics.scrollHeight <= metrics.viewportHeight + 2;
    }).toBe(true);
    const fitted = await canvasMetrics(page);
    await expect(actualSize).toHaveText(`${Math.round(fitted.scale * 100)}%`);

    await fitWidth.focus();
    await page.keyboard.press('Enter');
    await expect(fitWidth).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => Math.round((await canvasMetrics(page)).width)).toBe(Math.round(initial.width));
    await noPageOverflow(page);
});

test('zooming in and out keeps the same image detail at the viewport center', async ({ page }) => {
    await openEditor(page);
    await page.getByRole('button', { name: 'Actual size (100%)', exact: true }).click();
    await page.locator('.canvas-viewport').evaluate(viewport => {
        viewport.scrollTop = (viewport.scrollHeight - viewport.clientHeight) / 2;
        viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) / 2;
    });
    const before = await canvasMetrics(page);
    await page.getByRole('button', { name: 'Zoom in', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Actual size (100%)', exact: true })).toHaveText('125%');
    const zoomed = await canvasMetrics(page);
    expect(Math.abs(zoomed.centerX - before.centerX)).toBeLessThan(2);
    expect(Math.abs(zoomed.centerY - before.centerY)).toBeLessThan(2);

    await page.getByRole('button', { name: 'Zoom out', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Actual size (100%)', exact: true })).toHaveText('100%');
    const restored = await canvasMetrics(page);
    expect(Math.abs(restored.centerX - before.centerX)).toBeLessThan(2);
    expect(Math.abs(restored.centerY - before.centerY)).toBeLessThan(2);
});

test('a first touch selects a mask without moving it and image background clears selection', async ({ page }) => {
    await openEditor(page);
    await page.getByRole('button', { name: 'Draw redaction', exact: true }).click();
    await page.keyboard.press('Enter');
    const canvas = page.getByRole('region', { name: 'Screenshot canvas', exact: true });
    const mask = page.locator('.redaction-mask').last();
    await expect(mask).toHaveClass(/is-selected/);
    await page.keyboard.press('Escape');
    await expect(mask).not.toHaveClass(/is-selected/);
    const before = await mask.evaluate(element => ({ left: (element as HTMLElement).style.left, top: (element as HTMLElement).style.top }));
    // Synthetic touch events let every browser verify the select-only path;
    // selected-mask dragging is covered with real pointer capture in flow.spec.
    await mask.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 41, button: 0, clientX: 100, clientY: 100 });
    await expect(mask).toHaveClass(/is-selected/);
    await canvas.dispatchEvent('pointermove', { pointerType: 'touch', pointerId: 41, buttons: 1, clientX: 120, clientY: 180 });
    await canvas.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 41, button: 0, clientX: 120, clientY: 180 });
    expect(await mask.evaluate(element => ({ left: (element as HTMLElement).style.left, top: (element as HTMLElement).style.top }))).toEqual(before);
    // A child image target must behave like the image-stage background.
    await page.locator('.original-image').dispatchEvent('pointerdown', { pointerType: 'mouse', button: 0 });
    await expect(mask).not.toHaveClass(/is-selected/);
});
