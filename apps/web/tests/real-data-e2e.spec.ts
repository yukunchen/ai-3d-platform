/**
 * Real User Data E2E Tests - Issue #8
 *
 * Tests the exact scenario from Issue #8 screenshot:
 * Text to 3D with Meshy provider, textures enabled (1024, photorealistic), "A flying pig"
 *
 * Data source: GitHub Issue #8 screenshot
 *
 * Usage:
 *   PROD_URL=http://localhost:3000 pnpm test:e2e real-data-e2e.spec.ts
 */

import { expect, test } from '@playwright/test';

const PROD_URL = process.env.PROD_URL || 'http://localhost:3000';

// Fixture data from Issue #8 screenshot
const REAL_USER_DATA = {
  type: 'text',
  provider: 'meshy',
  format: 'glb',
  enableTextures: true,
  textureResolution: '1024',
  textureStyle: 'photorealistic',
  prompt: 'A flying pig',
} as const;

// Helper to generate unique test data
const uniqueId = () => Date.now().toString(36);

// Set long timeout for 3D generation (up to 6 minutes per test)
test.setTimeout(360_000);

/**
 * Helper: Register a new user and return to home page
 */
async function registerUser(page: import('@playwright/test').Page) {
  const email = `e2e_${uniqueId()}@example.com`;
  const password = 'TestPass123!';

  await page.goto(PROD_URL);
  await expect(page.getByRole('heading', { name: 'AI 3D Model Generator' })).toBeVisible();

  // Switch to register mode
  await page.getByTestId('auth-toggle').click();
  await expect(page.getByTestId('auth-name')).toBeVisible();

  // Fill registration form
  await page.getByTestId('auth-name').fill('E2E Test User');
  await page.getByTestId('auth-email').fill(email);
  await page.getByTestId('auth-password').fill(password);
  await page.getByTestId('auth-submit').click();

  // Wait for generation form to appear (indicates successful login)
  await expect(page.getByRole('button', { name: 'Generate 3D Model' })).toBeVisible({ timeout: 10_000 });

  return { email, password };
}

/**
 * Helper: Wait for job to complete and verify download
 */
async function waitForSuccessAndVerifyDownload(page: import('@playwright/test').Page) {
  // Wait for success message (up to 5 minutes for provider delays)
  await expect(page.getByText('Success!')).toBeVisible({ timeout: 300_000 });

  // Verify download link exists
  const downloadLink = page.getByRole('link', { name: /Download (GLB|FBX)/ });
  await expect(downloadLink).toBeVisible();

  // Get download URL and verify file is accessible
  const href = await downloadLink.getAttribute('href');
  expect(href).toBeTruthy();

  const absoluteUrl = href!.startsWith('http') ? href! : `${PROD_URL}${href}`;
  const resp = await page.request.get(absoluteUrl);
  expect(resp.status()).toBe(200);

  // Verify content type is a 3D model
  const contentType = resp.headers()['content-type'];
  expect(contentType).toMatch(/gltf|octet|model/);

  console.log(`✅ Download verified: ${absoluteUrl} (${contentType})`);

  return { downloadUrl: absoluteUrl, contentType };
}

// ============================================================================
// Test 1: Text → 3D with exact Issue #8 screenshot data
// ============================================================================
test('Real data: Text to 3D with Meshy provider and textures (Issue #8)', async ({ page }) => {
  console.log(`\n🧪 Test: Real data Text to 3D (Issue #8 scenario)`);
  console.log(`📍 URL: ${PROD_URL}`);
  console.log(`📋 Data: ${JSON.stringify(REAL_USER_DATA)}`);

  // Register and login
  await registerUser(page);
  console.log('✅ User registered and logged in');

  // Select Meshy provider (second select = provider)
  await page.locator('select').nth(1).selectOption(REAL_USER_DATA.provider);

  // Enable texture maps
  await page.getByText('Enable Texture Maps').click();
  console.log('✅ Texture maps enabled');

  // Set texture resolution to 1024
  await page.locator('label:has-text("Texture Resolution:") + select').selectOption(REAL_USER_DATA.textureResolution);

  // Set texture style to photorealistic
  await page.locator('label:has-text("Texture Style:") + select').selectOption(REAL_USER_DATA.textureStyle);

  // Fill prompt with real user data
  await page.getByPlaceholder(/Enter a description/i).fill(REAL_USER_DATA.prompt);

  // Submit job
  await page.getByRole('button', { name: 'Generate 3D Model' }).click();

  // Verify job started
  await expect(page.getByText(/queue|Generating/i)).toBeVisible({ timeout: 10_000 });
  console.log('✅ Job submitted, waiting for completion...');

  // Wait for success and verify download
  await waitForSuccessAndVerifyDownload(page);

  console.log('✅ Real data Text to 3D test passed!');
});

// ============================================================================
// Test 2: Smoke test — verify job submission pipeline is active
// ============================================================================
test('Real data: Job submission pipeline is active (smoke)', async ({ page }) => {
  console.log(`\n🧪 Test: Job submission smoke check`);
  console.log(`📍 URL: ${PROD_URL}`);

  // Quick smoke: verify the end-to-end submission path works end-to-end
  // If this fails, it means the form or API is broken — not just slow generation
  test.setTimeout(60_000);

  // Register and login
  await registerUser(page);
  console.log('✅ User registered and logged in');

  // Select Meshy provider
  await page.locator('select').nth(1).selectOption('meshy');

  // Fill a prompt that should produce a valid job (we just verify submission flow)
  await page.getByPlaceholder(/Enter a description/i).fill(REAL_USER_DATA.prompt);

  // Submit job
  await page.getByRole('button', { name: 'Generate 3D Model' }).click();

  // Verify job started — this is the meaningful check:
  // if this assertion fails, it means the submission flow is broken, not just slow
  const jobStarted = await page.getByText(/queue|Generating/i).isVisible({ timeout: 10_000 });
  if (!jobStarted) {
    const pageContent = await page.textContent('body');
    throw new Error(
      `Job submission failed — form may have changed or API is down.\n` +
      `Page content preview: ${pageContent?.slice(0, 500)}`
    );
  }
  console.log('✅ Job submission verified — generation pipeline is active');
});
