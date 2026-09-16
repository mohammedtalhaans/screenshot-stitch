import { test, expect, type Page } from '@playwright/test';
import { noPageOverflow, upload, waitForReview } from './fixtures';

type DeviceActions = {
    copyCalls: number;
    shareCalls: number;
    finishCopy?: () => void;
    finishShare?: () => void;
    cancelShare?: () => void;
};
type DeviceWindow = Window & { exportDeviceActions: DeviceActions };

async function openExport(page: Page) {
    // These tests exercise export state and native device handoffs. Keep the real
    // image renderer; skip OCR, which is covered by the complete flow tests.
    await page.route('**/ocr/**', route => route.abort('failed'));
    await page.goto('/screenshot-stitch/');
    await upload(page, false);
    await page.getByRole('button', { name: 'Scan & protect' }).click();
    await waitForReview(page);
    await page.getByRole('button', { name: 'Review & export' }).click();
    await page.locator('.export-paper').evaluate((image: HTMLImageElement) => image.decode());
}

async function installDeviceActions(page: Page) {
    await page.addInitScript(() => {
        const device = (window as unknown as DeviceWindow).exportDeviceActions = { copyCalls: 0, shareCalls: 0 } as DeviceActions;
        Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: class {
            constructor(readonly items: Record<string, Blob>) {}
        } });
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
            write: () => new Promise<void>(resolve => {
                device.copyCalls += 1;
                device.finishCopy = resolve;
            }),
        } });
        Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
        Object.defineProperty(navigator, 'share', { configurable: true, value: () => new Promise<void>((resolve, reject) => {
            device.shareCalls += 1;
            device.finishShare = resolve;
            device.cancelShare = () => reject(new DOMException('Sharing cancelled', 'AbortError'));
        }) });
    });
}

test('export preview supports actual pixels without page overflow, and resized exports need review', async ({ page }) => {
    await openExport(page);
    const preview = page.getByRole('region', { name: 'Final image preview', exact: true });
    const image = page.locator('.export-paper');
    const save = page.getByRole('button', { name: 'Save clean image', exact: true });
    await expect(page.getByRole('heading', { name: 'Save your image' })).toBeVisible();
    await expect(save).toBeDisabled();
    await expect(save).toHaveAccessibleDescription(/Confirm your review/);
    await expect(page.getByRole('button', { name: 'Fit width', exact: true })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Actual size', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Actual size', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await image.evaluate(element => Math.round(element.getBoundingClientRect().width))).toBe(720);
    const scrolling = await preview.evaluate(element => {
        element.scrollLeft = element.scrollWidth;
        element.scrollTop = element.scrollHeight;
        return { horizontal: element.scrollLeft, vertical: element.scrollTop, viewportWidth: element.clientWidth };
    });
    expect(scrolling.vertical).toBeGreaterThan(0);
    if (scrolling.viewportWidth < 720) expect(scrolling.horizontal).toBeGreaterThan(0);
    await noPageOverflow(page);

    await page.getByRole('button', { name: 'Fit width', exact: true }).click();
    expect(await image.evaluate(element => element.getBoundingClientRect().width)).toBeLessThanOrEqual(await preview.evaluate(element => element.clientWidth));
    await page.getByRole('checkbox').check();
    await expect(save).toBeEnabled();
    await page.getByLabel('Export size', { exact: true }).selectOption('0.5');
    await expect(page.getByRole('checkbox')).not.toBeChecked();
    await expect(save).toBeDisabled();
    await expect(image).toHaveJSProperty('naturalWidth', 360);
    await expect(image).toHaveJSProperty('naturalHeight', 450);
    await expect(page.locator('.export-dimensions')).toHaveText('360 × 450 px');
    await noPageOverflow(page);
});

test('copy handoff blocks concurrent actions and success clears after edits or a short delay', async ({ page }) => {
    await installDeviceActions(page);
    await openExport(page);
    await page.getByRole('checkbox').check();
    const save = page.getByRole('button', { name: 'Save clean image', exact: true });
    const status = page.locator('.export-action-status');

    await page.getByRole('button', { name: 'Copy image', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Copying…', exact: true })).toBeDisabled();
    await expect(save).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeDisabled();
    await expect(page.getByLabel('FILE NAME', { exact: true })).toBeDisabled();
    await expect(page.getByLabel('Export size', { exact: true })).toBeDisabled();
    expect(await page.evaluate(() => (window as unknown as DeviceWindow).exportDeviceActions.copyCalls)).toBe(1);
    await page.evaluate(() => (window as unknown as DeviceWindow).exportDeviceActions.finishCopy?.());
    await expect(status).toHaveText('Image copied to clipboard.');
    await expect(save).toBeEnabled();

    await page.getByLabel('FILE NAME', { exact: true }).fill('reviewed-image');
    await expect(page.getByRole('button', { name: 'Copy image', exact: true })).toBeEnabled();
    await expect(status).toHaveText('Ready to download.');
    await page.getByRole('button', { name: 'Copy image', exact: true }).click();
    await page.evaluate(() => (window as unknown as DeviceWindow).exportDeviceActions.finishCopy?.());
    await expect(page.getByRole('button', { name: 'Copied', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy image', exact: true })).toBeVisible({ timeout: 6000 });

    await page.getByRole('button', { name: 'Copy image', exact: true }).click();
    await page.evaluate(() => (window as unknown as DeviceWindow).exportDeviceActions.finishCopy?.());
    await expect(status).toHaveText('Image copied to clipboard.');
    await page.getByLabel('Export size', { exact: true }).selectOption('0.5');
    await expect(page.locator('.export-paper')).toHaveJSProperty('naturalWidth', 360);
    await expect(page.getByRole('button', { name: 'Copy image', exact: true })).toBeDisabled();
    await expect(status).toBeEmpty();
    await expect(page.getByRole('checkbox')).not.toBeChecked();
});

test('share handoff recovers from cancellation and downloads report the request accurately', async ({ page }) => {
    await installDeviceActions(page);
    await openExport(page);
    await page.getByRole('checkbox').check();
    const save = page.getByRole('button', { name: 'Save clean image', exact: true });

    await page.getByRole('button', { name: 'Share', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Sharing…', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Copy image', exact: true })).toBeDisabled();
    await expect(save).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Back to editing', exact: true })).toBeDisabled();
    expect(await page.evaluate(() => (window as unknown as DeviceWindow).exportDeviceActions.shareCalls)).toBe(1);
    await page.evaluate(() => (window as unknown as DeviceWindow).exportDeviceActions.cancelShare?.());
    await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeEnabled();
    await expect(save).toBeEnabled();
    await expect(page.locator('.toast-stack')).not.toContainText('could not share');

    await page.getByRole('button', { name: 'Share', exact: true }).click();
    await page.evaluate(() => (window as unknown as DeviceWindow).exportDeviceActions.finishShare?.());
    await expect(page.locator('.export-action-status')).toHaveText('Image shared.');
    const downloadEvent = page.waitForEvent('download');
    await save.click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe('screenshot-stitch.png');
    await expect(page.getByRole('heading', { name: 'Download requested', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start a new story', exact: true })).toBeVisible();
    await expect(page.locator('.export-action-status')).toHaveText('Download requested. Check your browser’s downloads.');
    await page.getByLabel('FILE NAME', { exact: true }).fill('another-image');
    await expect(page.getByRole('heading', { name: 'Save your image', exact: true })).toBeVisible();
    await expect(save).toBeEnabled();
});
