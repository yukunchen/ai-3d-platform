import { defineConfig } from '@playwright/test';

const PORT = 3100;

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    headless: true,
  },
  webServer: {
    command: `pnpm dev -p ${PORT}`,
    port: PORT,
    timeout: 120_000,
    reuseExistingServer: true,
    env: {
      NEXT_PUBLIC_API_URL: 'http://mock-api.local',
    },
  },
});
