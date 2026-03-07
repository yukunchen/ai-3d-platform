/**
 * Production E2E test — runs against the real server at PROD_URL.
 * Usage: PROD_URL=http://100.22.97.122:3000 pnpm exec playwright test tests/prod-e2e.spec.ts --headed
 */
import { expect, test } from '@playwright/test';

const PROD_URL = process.env.PROD_URL || 'http://100.22.97.122:3000';

// Generate unique email for each test run
const TEST_EMAIL = `test${Date.now()}@example.com`;
const TEST_PASSWORD = 'testpassword123';
const TEST_NAME = 'Test User';

test('page loads and auth form is rendered', async ({ page }) => {
  await page.goto(PROD_URL);
  await expect(page.getByRole('heading', { name: 'AI 3D Model Generator' })).toBeVisible();
  await expect(page.getByTestId('auth-email')).toBeVisible();
  await expect(page.getByTestId('auth-password')).toBeVisible();
});

test('register, login, and submit job successfully', async ({ page }) => {
  test.setTimeout(400_000); // Allow extra time for registration and job processing

  // === Step 1: Register ===
  await page.goto(PROD_URL);
  await expect(page.getByTestId('auth-email')).toBeVisible();

  // Switch to register mode
  await page.getByTestId('auth-toggle').click();
  await expect(page.getByTestId('auth-name')).toBeVisible();

  // Fill register form
  await page.getByTestId('auth-name').fill(TEST_NAME);
  await page.getByTestId('auth-email').fill(TEST_EMAIL);
  await page.getByTestId('auth-password').fill(TEST_PASSWORD);
  await page.getByTestId('auth-submit').click();

  // After registration, generation form should appear
  await expect(page.getByRole('button', { name: 'Generate 3D Model' })).toBeVisible({ timeout: 10_000 });

  // === Step 2: Submit a job ===
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

  // === Step 3: Test logout and login ===
  await page.getByTestId('logout-btn').click();

  // Should show auth form again
  await expect(page.getByTestId('auth-email')).toBeVisible();

  // Login with the same credentials
  await page.getByTestId('auth-email').fill(TEST_EMAIL);
  await page.getByTestId('auth-password').fill(TEST_PASSWORD);
  await page.getByTestId('auth-submit').click();

  // Should show generation form again
  await expect(page.getByRole('button', { name: 'Generate 3D Model' })).toBeVisible({ timeout: 10_000 });
});
