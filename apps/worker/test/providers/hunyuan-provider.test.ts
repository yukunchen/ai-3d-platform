import { describe, expect, it } from 'vitest';
import type { Job } from 'bullmq';
import type { JobData } from '@ai-3d-platform/shared';
import type { ProviderResult } from '../../src/providers/provider';
import { createHunyuanProvider } from '../../src/providers/hunyuan';

function setEnv(vars: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe('createHunyuanProvider', () => {
  it('returns not configured when credentials are missing', () => {
    setEnv({
      TENCENTCLOUD_SECRET_ID: undefined,
      TENCENTCLOUD_SECRET_KEY: undefined,
    });

    const provider = createHunyuanProvider();
    expect(provider.isConfigured()).toBe(false);
  });

  it('maps multiview request to rapid-mode unsupported error', async () => {
    setEnv({
      TENCENTCLOUD_SECRET_ID: 'test-id',
      TENCENTCLOUD_SECRET_KEY: 'test-key',
      TENCENTCLOUD_REGION: 'ap-guangzhou',
      HUNYUAN_MODE: 'rapid',
      HUNYUAN_HOST: 'ai3d.ap-guangzhou.tencentcloudapi.com',
      HUNYUAN_SERVICE: 'ai3d',
      HUNYUAN_VERSION: '2025-05-13',
    });

    const provider = createHunyuanProvider();
    const job = {
      id: 'job-mv-1',
      data: {
        id: 'job-mv-1',
        type: 'multiview',
        prompt: 'three view toy',
        viewImages: {
          front: 'https://example.com/front.png',
          left: 'https://example.com/left.png',
          right: 'https://example.com/right.png',
        },
        createdAt: Date.now(),
      },
    } as unknown as Job<JobData, ProviderResult>;

    await expect(provider.generateFromMultiView(job, { s3Client: null, bucket: undefined })).rejects.toThrow(
      'rapid mode does not support multiview'
    );
  });
});
