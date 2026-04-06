import { defineConfig } from '@playwright/test';

/**
 * Playwright config for production E2E tests
 * Usage: PROD_URL=http://your-server:3000 npx playwright test --config=playwright.prod.config.ts
 */
export default defineConfig({
  testDir: './tests',
  testMatch: [
    'auth.spec.ts',
    'full-e2e.spec.ts',
    'generation-e2e.spec.ts',
    'real-data-e2e.spec.ts',
  ],
  timeout: 300_000, // 5 minutes per test
  retries: 2, // Retry failed tests up to 2 times
  workers: 1, // Run tests sequentially to avoid rate limiting
  reporter: 'list',
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
