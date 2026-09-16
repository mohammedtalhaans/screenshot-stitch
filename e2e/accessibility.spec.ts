import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { screenshots, upload, waitForReview, noPageOverflow } from './fixtures';

test('accessible names, focus, contrast and regions across every major screen', async ({ page }, testInfo) => {
  const check = async (screen: string) => {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    await testInfo.attach(`accessibility-${screen}`, { body: JSON.stringify(result.violations, null, 2), contentType: 'application/json' });
    expect(result.violations, screen).toEqual([]);
    await noPageOverflow(page);
  };
  await page.goto('/screenshot-stitch/'); await check('landing');
  await page.getByRole('button', { name: 'Our privacy promise' }).click(); await check('privacy');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Shortcuts', exact: true }).click(); await check('shortcuts');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Upload screenshots', exact: true }).click();
  await page.locator('.prepare-page').waitFor(); await check('upload-empty');
  await upload(page); await check('prepare');
  await page.getByRole('button', { name: 'Stitch & protect' }).click(); await waitForReview(page); await check('review');
  await page.locator('.review-seam-status button').click(); await check('seams'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Review & export' }).click();
  await page.locator('.export-paper').waitFor(); await check('export');
});

test('manual seam rebuild preserves the explicit overlap and resets mask edits', async ({ page }) => {
  await page.goto('/screenshot-stitch/'); await upload(page);
  await page.getByRole('switch', { name: 'Auto-crop repeated headers and footers' }).uncheck();
  await page.getByRole('button', { name: 'Stitch & protect' }).click(); await waitForReview(page);
  await page.locator('.review-seam-status button').click();
  await page.getByRole('spinbutton', { name: 'OVERLAP', exact: true }).fill('380');
  await page.getByRole('button', { name: 'Rebuild & scan' }).click(); await waitForReview(page);
  await expect(page.locator('.original-image')).toHaveJSProperty('naturalHeight', 1420);
  await page.locator('.review-seam-status button').click();
  await expect(page.getByRole('spinbutton', { name: 'OVERLAP', exact: true })).toHaveValue('380');
  await page.getByRole('button', { name: 'Use automatic values' }).click();
  await expect(page.getByRole('spinbutton', { name: 'OVERLAP', exact: true })).toHaveValue('420');
  await page.getByRole('button', { name: 'Rebuild & scan' }).click(); await waitForReview(page);
  await expect(page.locator('.original-image')).toHaveJSProperty('naturalHeight', 1380);
});

test('source archive is a real ZIP and contains the lockfile without environment secrets', async ({ page, request }) => {
  await page.goto('/screenshot-stitch/');
  const response = await request.get('/screenshot-stitch/source/screenshot-stitch-source.zip');
  expect(response.ok()).toBe(true);
  const { unzipSync, strFromU8 } = await import('fflate');
  const archive = unzipSync(new Uint8Array(await response.body()));
  expect(JSON.parse(strFromU8(archive['screenshot-stitch/package-lock.json'])).lockfileVersion).toBe(3);
  expect(strFromU8(archive['screenshot-stitch/.node-version']).trim()).toBe('22');
  expect(strFromU8(archive['screenshot-stitch/.github/workflows/pages.yml'])).toContain('actions/deploy-pages@v4');
  expect(Object.keys(archive).some(name => /node_modules|\.env\.local|fixtures-private/.test(name))).toBe(false);
});
