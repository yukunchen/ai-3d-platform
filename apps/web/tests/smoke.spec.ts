import { expect, test } from '@playwright/test';

test('submit flow shows queued/running status after submit', async ({ page }) => {
  let statusCallCount = 0;

  await page.route('**/v1/jobs', async (route, request) => {
    if (request.method() !== 'POST') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ jobId: 'job-1', status: 'queued' }),
    });
  });

  await page.route('**/v1/jobs/job-1', async (route) => {
    statusCallCount += 1;
    const payload = statusCallCount >= 1
      ? { jobId: 'job-1', status: 'running', assetId: null, error: null }
      : { jobId: 'job-1', status: 'queued', assetId: null, error: null };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    });
  });

  await page.goto('/');
  await page.getByPlaceholder('Enter a description of the 3D model...').fill('A low poly fox');
  await page.getByRole('button', { name: 'Generate 3D Model' }).click();

  await expect(page.getByText('Generating your 3D model...')).toBeVisible();
});

test('multiview submit sends front/left/right payload', async ({ page }) => {
  let capturedBody: Record<string, unknown> | null = null;

  await page.route('**/v1/jobs', async (route, request) => {
    if (request.method() !== 'POST') {
      await route.fallback();
      return;
    }
    capturedBody = request.postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ jobId: 'job-mv-1', status: 'queued' }),
    });
  });

  await page.route('**/v1/jobs/job-mv-1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ jobId: 'job-mv-1', status: 'running', assetId: null, error: null }),
    });
  });

  await page.goto('/');
  await page.locator('select').first().selectOption('multiview');
  await page.getByPlaceholder('Enter a description of the 3D model...').fill('A toy car from three views');
  await page.getByPlaceholder('https://example.com/front.png').fill('https://example.com/front.png');
  await page.getByPlaceholder('https://example.com/left.png').fill('https://example.com/left.png');
  await page.getByPlaceholder('https://example.com/right.png').fill('https://example.com/right.png');

  const submitButton = page.getByRole('button', { name: 'Generate 3D Model' });
  await expect(submitButton).toBeEnabled();
  await submitButton.click();

  await expect(page.getByText('Generating your 3D model...')).toBeVisible();
  expect(capturedBody).toMatchObject({
    type: 'multiview',
    prompt: 'A toy car from three views',
    viewImages: {
      front: 'https://example.com/front.png',
      left: 'https://example.com/left.png',
      right: 'https://example.com/right.png',
    },
  });
});
