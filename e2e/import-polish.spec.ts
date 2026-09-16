import { test, expect } from '@playwright/test';
import { screenshots, noPageOverflow } from './fixtures';

test('landing accepts dropped screenshots and rejects unsupported files', async ({ page }) => {
  await page.goto('/screenshot-stitch/');
  const files = await screenshots(page);
  const transfer = await page.evaluateHandle(items => {
    const data = new DataTransfer();
    for (const item of items) data.items.add(new File([new Uint8Array(item.bytes)], item.name, { type: item.type }));
    data.items.add(new File(['not an image'], 'notes.txt', { type: 'text/plain' }));
    return data;
  }, files.map(file => ({ name: file.name, type: file.mimeType, bytes: [...file.buffer] })));
  await page.locator('.landing').dispatchEvent('dragenter', { dataTransfer: transfer });
  await expect(page.getByRole('status')).toContainText('Drop the pieces here.');
  await page.locator('.landing').dispatchEvent('drop', { dataTransfer: transfer });
  await expect(page.locator('.screenshot-item')).toHaveCount(2);
  await expect(page.locator('.toast-stack')).toContainText('Use PNG');
  await expect(page.getByRole('button', { name: 'Stitch & protect' })).toBeEnabled();
  await noPageOverflow(page);
});

test('pasting an image while a dialog is open does not change the workspace', async ({ page }) => {
  await page.goto('/screenshot-stitch/');
  await page.getByRole('button', { name: 'Our privacy promise' }).click();
  await page.evaluate(() => {
    const clipboardData = new DataTransfer();
    clipboardData.items.add(new File(['invalid'], 'private.png', { type: 'image/png' }));
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
  });
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.landing')).toBeAttached();
  await expect(page.locator('.toast')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await noPageOverflow(page);
});
