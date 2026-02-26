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
      optimizer: {
        ssr: {
          include: ['@ai-3d-platform/shared'],
        },
      },
    },
  },
});
