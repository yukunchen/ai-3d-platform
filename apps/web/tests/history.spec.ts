import { expect, test } from '@playwright/test';

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
  ],
  pagination: {
    page: 1,
    limit: 20,
    total: 3,
    totalPages: 1,
  },
};

test('history page renders table with correct columns and data', async ({ page }) => {
  await page.route('**/v1/jobs*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sampleData),
    });
  });

  await page.goto('/history');

  // Check heading
  await expect(page.getByRole('heading', { name: 'Job History' })).toBeVisible();

  // Check table headers
  await expect(page.getByRole('columnheader', { name: 'Job ID' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Type' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Prompt' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Created At' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Cost' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Asset' })).toBeVisible();

  // Check that rows are rendered
  const rows = page.getByRole('row');
  // 1 header row + 3 data rows
  await expect(rows).toHaveCount(4);

  // Check status badges exist
  const badges = page.getByTestId('status-badge');
  await expect(badges).toHaveCount(3);

  // Check cost display
  await expect(page.getByText('$2.50')).toBeVisible();
  await expect(page.getByText('$1.00')).toBeVisible();
});

test('filter dropdowns update the table', async ({ page }) => {
  let lastUrl = '';

  await page.route('**/v1/jobs*', async (route, request) => {
    lastUrl = request.url();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sampleData),
    });
  });

  await page.goto('/history');
  await expect(page.getByRole('heading', { name: 'Job History' })).toBeVisible();

  // Change status filter
  const statusSelect = page.getByTestId('status-filter');
  await statusSelect.selectOption('succeeded');

  // Wait for the request with status param
  await page.waitForResponse((resp) => resp.url().includes('status=succeeded'));
  expect(lastUrl).toContain('status=succeeded');

  // Change type filter
  const typeSelect = page.getByTestId('type-filter');
  await typeSelect.selectOption('text');

  await page.waitForResponse((resp) => resp.url().includes('type=text'));
  expect(lastUrl).toContain('type=text');
});

test('pagination buttons work', async ({ page }) => {
  test.setTimeout(60000);
  const page1Data = {
    data: sampleData.data,
    pagination: { page: 1, limit: 20, total: 25, totalPages: 2 },
  };
  const page2Data = {
    data: [sampleData.data[0]],
    pagination: { page: 2, limit: 20, total: 25, totalPages: 2 },
  };

  let requestCount = 0;
  await page.route('**/v1/jobs*', async (route) => {
    const url = route.request().url();
    requestCount++;
    console.log('Request', requestCount, ':', url);
    if (url.includes('page=2')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(page2Data),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(page1Data),
      });
    }
  });

  await page.goto('/history');
  await expect(page.getByRole('heading', { name: 'Job History' })).toBeVisible();

  // Previous should be disabled on page 1
  const prevButton = page.getByRole('button', { name: 'Previous' });
  await expect(prevButton).toBeDisabled();

  // Next should be enabled
  const nextButton = page.getByRole('button', { name: 'Next' });
  await expect(nextButton).toBeEnabled();

  // Click next
  await nextButton.click();

  // Wait a bit for the UI to update
  await page.waitForTimeout(1000);

  // Verify page indicator shows page 2
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
});
