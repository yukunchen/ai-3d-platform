import { test } from '@playwright/test';
import path from 'path';

const screenshotsDir = path.join(__dirname, '..', '..', '..', 'docs', 'screenshots');

// Auth screenshot tests
test('screenshot: login form', async ({ page }) => {
  await page.goto('/');
  // Wait for client hydration to show the login form
  await page.waitForSelector('[data-testid="auth-email"]', { timeout: 60000 });
  await page.screenshot({ path: path.join(screenshotsDir, 'auth-login.png'), fullPage: true });
});

test('screenshot: register form', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="auth-email"]', { timeout: 60000 });
  // Switch to register mode
  await page.getByTestId('auth-toggle').click();
  await page.waitForSelector('[data-testid="auth-name"]');
  await page.screenshot({ path: path.join(screenshotsDir, 'auth-register.png'), fullPage: true });
});

// History screenshot tests
const sampleData = {
  data: [
    {
      jobId: 'abc12345-6789-0abc-def0-123456789abc',
      type: 'text',
      prompt: 'A low-poly medieval castle with a moat and drawbridge',
      status: 'succeeded',
      createdAt: 1709400000000,
      assetId: 'asset-001',
      cost: 250,
    },
    {
      jobId: 'def45678-9012-3def-4567-890abcdef012',
      type: 'image',
      prompt: 'Stylized robot from reference image',
      status: 'running',
      createdAt: 1709396400000,
      assetId: null,
    },
    {
      jobId: 'ghi78901-2345-6ghi-7890-abcdef012345',
      type: 'multiview',
      prompt: 'A toy car from three views',
      status: 'failed',
      createdAt: 1709392800000,
      assetId: null,
      cost: 100,
    },
    {
      jobId: 'jkl01234-5678-9jkl-0123-456789abcdef',
      type: 'text',
      prompt: 'Cyberpunk motorcycle with neon lights',
      status: 'queued',
      createdAt: 1709389200000,
      assetId: null,
      cost: 0,
    },
  ],
  pagination: { page: 1, limit: 20, total: 4, totalPages: 1 },
};

test('capture history page screenshot', async ({ page }) => {
  test.setTimeout(60000);

  await page.route('**/v1/jobs*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sampleData),
    });
  });

  await page.goto('/history', { waitUntil: 'networkidle' });
  await page.waitForSelector('table');
  await page.screenshot({ path: path.join(screenshotsDir, 'history-page.png'), fullPage: true });
});

test('capture navigation bar screenshot', async ({ page }) => {
  test.setTimeout(60000);

  await page.route('**/v1/jobs*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sampleData),
    });
  });

  await page.goto('/history', { waitUntil: 'networkidle' });
  await page.waitForSelector('nav');
  await page.screenshot({
    path: path.join(screenshotsDir, 'history-nav.png'),
    clip: { x: 0, y: 0, width: 1280, height: 60 },
  });
});
