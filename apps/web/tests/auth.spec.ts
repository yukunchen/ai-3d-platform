import { expect, test } from '@playwright/test';

// First test in the suite may hit cold-start compilation; give it extra time
test.setTimeout(60_000);

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
  authProvider: 'email',
  createdAt: Date.now(),
};

const mockAuthResponse = {
  user: mockUser,
  token: 'mock-jwt-token',
  expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
};

test('register flow: fill form, submit, verify generation form appears', async ({ page }) => {
  await page.route('**/v1/auth/register', async (route, request) => {
    if (request.method() !== 'POST') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(mockAuthResponse),
    });
  });

  await page.goto('/');

  // Wait for client hydration to complete and show auth form
  await page.waitForSelector('[data-testid="auth-email"]', { timeout: 30000 });

  // Should show login form by default
  await expect(page.getByTestId('auth-email')).toBeVisible();

  // Switch to register
  await page.getByTestId('auth-toggle').click();
  await expect(page.getByTestId('auth-name')).toBeVisible();

  // Fill register form
  await page.getByTestId('auth-name').fill('Test User');
  await page.getByTestId('auth-email').fill('test@example.com');
  await page.getByTestId('auth-password').fill('password123');
  await page.getByTestId('auth-submit').click();

  // After successful register, generation form should appear
  await expect(page.getByRole('button', { name: 'Generate 3D Model' })).toBeVisible();
  await expect(page.getByTestId('logout-btn')).toBeVisible();
});

test('login flow: fill form, submit, verify generation form appears', async ({ page }) => {
  await page.route('**/v1/auth/login', async (route, request) => {
    if (request.method() !== 'POST') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockAuthResponse),
    });
  });

  await page.goto('/');

  // Wait for client hydration to complete and show auth form
  await page.waitForSelector('[data-testid="auth-email"]', { timeout: 30000 });

  // Should show login form by default
  await expect(page.getByTestId('auth-email')).toBeVisible();
  await expect(page.getByTestId('auth-submit')).toHaveText('Login');

  // Fill login form
  await page.getByTestId('auth-email').fill('test@example.com');
  await page.getByTestId('auth-password').fill('password123');
  await page.getByTestId('auth-submit').click();

  // After successful login, generation form should appear
  await expect(page.getByRole('button', { name: 'Generate 3D Model' })).toBeVisible();
  await expect(page.getByTestId('logout-btn')).toBeVisible();
});
