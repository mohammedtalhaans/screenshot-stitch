import { test, expect } from '@playwright/test';
import { upload, waitForReview } from './fixtures';

test('keyboard users can create, move, undo and restore manual masks', async ({ page, context }) => {
    // A real stitch with no OCR suggestions exercises creation of the first mask.
    await context.route('**/ocr/**', route => route.abort('failed'));
    await page.goto('/screenshot-stitch/');
    await upload(page, false);
    await page.getByRole('button', { name: 'Scan & protect' }).click();
    await waitForReview(page);
    await expect(page.locator('.redaction-mask')).toHaveCount(0);

    const add = page.getByRole('button', { name: /Add a manual redaction/ });
    await add.focus();
    await page.keyboard.press('Enter');
    const canvas = page.getByRole('region', { name: 'Screenshot canvas', exact: true });
    await expect(canvas).toBeFocused();
    await expect(canvas).toHaveAccessibleDescription(/ENTER \/ SPACE TO PLACE/);
    await page.keyboard.press('Enter');

    const masks = page.locator('.redaction-mask');
    await expect(masks).toHaveCount(1);
    await expect(masks.first()).toBeFocused();
    await expect(masks.first()).toBeInViewport();
    const left = await masks.first().evaluate(mask => parseFloat((mask as HTMLElement).style.left));
    await page.keyboard.press('Shift+ArrowRight');
    await expect.poll(() => masks.first().evaluate(mask => parseFloat((mask as HTMLElement).style.left))).toBeGreaterThan(left);
    await page.keyboard.press('Control+z');
    await expect.poll(() => masks.first().evaluate(mask => parseFloat((mask as HTMLElement).style.left))).toBe(left);
    await page.keyboard.press('Control+z');
    await expect(masks).toHaveCount(0);
    await page.keyboard.press('Control+Shift+z');
    await expect(masks).toHaveCount(1);

    await page.keyboard.press('r');
    await expect(canvas).toBeFocused();
    await page.keyboard.press('Space');
    await expect(masks).toHaveCount(2);
    await expect(page.locator('.redaction-mask.is-selected')).toBeFocused();
    await expect(page.getByRole('button', { name: 'Draw redaction', exact: true })).toHaveAttribute('aria-pressed', 'false');
    // Enter on a selected child mask must not bubble into another creation.
    await page.keyboard.press('Enter');
    await expect(masks).toHaveCount(2);
});
