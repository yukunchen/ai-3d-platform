/**
 * Production E2E test — runs against the real server at PROD_URL.
 * Usage: PROD_URL=http://100.22.97.122:3000 pnpm exec playwright test tests/prod-e2e.spec.ts --headed
 */
import { expect, test } from '@playwright/test';

const PROD_URL = process.env.PROD_URL || 'http://100.22.97.122:3000';

test('page loads and form is rendered', async ({ page }) => {
  await page.goto(PROD_URL);
  await expect(page.getByRole('heading', { name: 'AI 3D Model Generator' })).toBeVisible();
  await expect(page.getByPlaceholder('Enter a description of the 3D model...')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate 3D Model' })).toBeDisabled();
});

test('submit job and wait for success + model download link', async ({ page }) => {
  test.setTimeout(300_000); // 5 minutes — Meshy can get stuck at 99% for a while

  await page.goto(PROD_URL);

  // Select Meshy provider
  await page.locator('select').nth(1).selectOption('meshy');

  // Fill prompt
  await page.getByPlaceholder('Enter a description of the 3D model...').fill('a small red mushroom');

  // Button should now be enabled
  const btn = page.getByRole('button', { name: 'Generate 3D Model' });
  await expect(btn).toBeEnabled();
  await btn.click();

  // Should enter queued/running state
  await expect(page.getByText(/queue|Generating/i)).toBeVisible({ timeout: 10_000 });

  // Wait for success (up to 3 min)
  await expect(page.getByText('Success!')).toBeVisible({ timeout: 260_000 });

  // Download GLB link must exist
  const downloadLink = page.getByRole('link', { name: 'Download GLB' });
  await expect(downloadLink).toBeVisible();

  const href = await downloadLink.getAttribute('href');
  console.log('Download URL:', href);
  expect(href).toBeTruthy();

  // Build absolute URL (href may be relative, e.g. /storage/...)
  const absoluteHref = href!.startsWith('http') ? href! : `${PROD_URL}${href}`;

  // Verify the GLB URL actually returns a binary file
  const resp = await page.request.get(absoluteHref);
  expect(resp.status()).toBe(200);
  const ct = resp.headers()['content-type'];
  console.log('Content-Type:', ct);
  expect(ct).toMatch(/gltf|octet/);
});
