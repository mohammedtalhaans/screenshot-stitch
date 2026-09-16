import { defineConfig, devices } from '@playwright/test';
const port = process.env.TEST_PORT || '5187';
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './e2e', timeout: 180_000, expect: { timeout: 20_000 },
  fullyParallel: false, workers: process.env.CI ? 2 : 1, retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure', reducedMotion: 'reduce' },
  // Never accidentally verify a different app already using a preview port.
  webServer: { command: 'node scripts/serve-dist.mjs', url: baseURL, env: { PORT: port }, reuseExistingServer: false },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'webkit', use: { ...devices['iPhone 13'] } },
  ],
});
