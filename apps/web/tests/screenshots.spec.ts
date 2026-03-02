import { test } from '@playwright/test';

test('screenshot: login form', async ({ page }) => {
  await page.goto('/');
  // Wait for client hydration to show the login form
  await page.waitForSelector('[data-testid="auth-email"]', { timeout: 60000 });
  await page.screenshot({ path: '../../docs/screenshots/auth-login.png', fullPage: true });
});

test('screenshot: register form', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="auth-email"]', { timeout: 60000 });
  // Switch to register mode
  await page.getByTestId('auth-toggle').click();
  await page.waitForSelector('[data-testid="auth-name"]');
  await page.screenshot({ path: '../../docs/screenshots/auth-register.png', fullPage: true });
});
