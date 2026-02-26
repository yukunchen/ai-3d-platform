import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    server: {
      deps: {
        inline: [/@ai-3d-platform\/shared/],
      },
    },
    deps: {
      // Keep optimizer include so workspace TS source from shared package is resolved consistently.
      optimizer: {
        ssr: {
          include: ['@ai-3d-platform/shared'],
        },
      },
    },
  },
});
