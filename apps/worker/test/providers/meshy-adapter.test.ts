import { describe, expect, it, vi } from 'vitest';
import type { Job } from 'bullmq';
import type { JobData } from '@ai-3d-platform/shared';
import type { ProviderResult } from '../../src/providers/provider';

vi.mock('../../src/providers/meshy', () => {
  return {
    generateFromText: vi.fn().mockResolvedValue({ assetId: 'asset-text', assetUrl: '/storage/text.glb' }),
    generateFromImage: vi.fn().mockResolvedValue({ assetId: 'asset-image', assetUrl: '/storage/image.glb' }),
    generateFromMultiView: vi.fn().mockResolvedValue({ assetId: 'asset-mv', assetUrl: '/storage/mv.glb' }),
    isMeshyConfigured: vi.fn().mockReturnValue(true),
  };
});

describe('createMeshyProvider', () => {
  it('delegates text/image/multiview calls to meshy module', async () => {
    const { createMeshyProvider } = await import('../../src/providers/meshy-adapter');
    const meshy = await import('../../src/providers/meshy');

    const provider = createMeshyProvider();
    const ctx = { s3Client: null, bucket: undefined };
    const job = {
      id: 'job-1',
      data: { id: 'job-1', type: 'text', prompt: 'hello', createdAt: Date.now() } as JobData,
    } as unknown as Job<JobData, ProviderResult>;

    await provider.generateFromText(job, ctx);
    await provider.generateFromImage(job, ctx);
    await provider.generateFromMultiView(job, ctx);

    expect(meshy.generateFromText).toHaveBeenCalledTimes(1);
    expect(meshy.generateFromImage).toHaveBeenCalledTimes(1);
    expect(meshy.generateFromMultiView).toHaveBeenCalledTimes(1);
  });
});
