import { describe, expect, it, vi } from 'vitest';
import { JobType } from '@ai-3d-platform/shared';
import { generate3D, selectProvider } from '../src/core';
import { ProviderAdapter } from '../src/providers/provider';

function createProvider(
  name: string,
  configured: boolean,
  result: { assetId: string; assetUrl: string } = { assetId: 'asset-provider', assetUrl: 'url-provider' }
): ProviderAdapter {
  return {
    name,
    isConfigured: () => configured,
    generateFromText: vi.fn().mockResolvedValue(result),
    generateFromImage: vi.fn().mockResolvedValue(result),
    generateFromMultiView: vi.fn().mockResolvedValue(result),
  };
}

describe('selectProvider', () => {
  it('returns explicitly requested provider when configured', () => {
    const hunyuan = createProvider('hunyuan', true);
    const meshy = createProvider('meshy', true);
    const provider = selectProvider([hunyuan, meshy], 'meshy');
    expect(provider?.name).toBe('meshy');
  });

  it('falls back to first configured provider when requested one is unavailable', () => {
    const hunyuan = createProvider('hunyuan', true);
    const meshy = createProvider('meshy', false);
    const provider = selectProvider([hunyuan, meshy], 'meshy');
    expect(provider?.name).toBe('hunyuan');
  });
});

describe('generate3D', () => {
  it('throws for image jobs without imageUrl', async () => {
    const provider = createProvider('hunyuan', true);
    await expect(
      generate3D(
        {
          id: 'job-1',
          data: {
            id: 'job-1',
            type: JobType.Image,
            prompt: 'image input',
            createdAt: Date.now(),
          },
        },
        { providers: [provider], s3Client: null, bucket: undefined }
      )
    ).rejects.toThrow('Image URL is required');
  });

  it('uses provider text generation for text jobs', async () => {
    const provider = createProvider('meshy', true, { assetId: 'asset-1', assetUrl: 'https://cdn/a.glb' });
    const result = await generate3D(
      {
        id: 'job-2',
        data: {
          id: 'job-2',
          type: JobType.Text,
          prompt: 'a chair',
          createdAt: Date.now(),
        },
      },
      { providers: [provider], s3Client: null, bucket: undefined }
    );

    expect(result).toEqual({ assetId: 'asset-1', assetUrl: 'https://cdn/a.glb' });
    expect(provider.generateFromText).toHaveBeenCalledTimes(1);
  });

  it('falls back to placeholder generator when no providers are configured', async () => {
    const placeholder = vi.fn().mockResolvedValue({ assetId: 'asset-mock', assetUrl: '/storage/mock.glb' });
    const result = await generate3D(
      {
        id: 'job-3',
        data: {
          id: 'job-3',
          type: JobType.Text,
          prompt: 'mock model',
          createdAt: Date.now(),
        },
      },
      {
        providers: [createProvider('hunyuan', false), createProvider('meshy', false)],
        s3Client: null,
        bucket: undefined,
        generatePlaceholder: placeholder,
        delay: vi.fn().mockResolvedValue(undefined),
        random: () => 0,
      }
    );

    expect(placeholder).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ assetId: 'asset-mock', assetUrl: '/storage/mock.glb' });
  });

  it('propagates provider failures', async () => {
    const provider = createProvider('meshy', true);
    provider.generateFromText = vi.fn().mockRejectedValue(new Error('provider timeout'));

    await expect(
      generate3D(
        {
          id: 'job-4',
          data: {
            id: 'job-4',
            type: JobType.Text,
            prompt: 'failing run',
            createdAt: Date.now(),
          },
        },
        { providers: [provider], s3Client: null, bucket: undefined }
      )
    ).rejects.toThrow('provider timeout');
  });

  it('uses provider multiview generation when type is multiview', async () => {
    const provider = createProvider('hunyuan', true, { assetId: 'asset-mv', assetUrl: 'https://cdn/mv.glb' });
    const result = await generate3D(
      {
        id: 'job-5',
        data: {
          id: 'job-5',
          type: JobType.MultiView,
          prompt: 'three views',
          viewImages: {
            front: 'https://example.com/front.png',
            left: 'https://example.com/left.png',
            right: 'https://example.com/right.png',
          },
          createdAt: Date.now(),
        },
      },
      { providers: [provider], s3Client: null, bucket: undefined }
    );

    expect(result).toEqual({ assetId: 'asset-mv', assetUrl: 'https://cdn/mv.glb' });
    expect(provider.generateFromMultiView).toHaveBeenCalledTimes(1);
  });

  it('throws when multiview job misses required views', async () => {
    const provider = createProvider('hunyuan', true);
    await expect(
      generate3D(
        {
          id: 'job-6',
          data: {
            id: 'job-6',
            type: JobType.MultiView,
            prompt: 'broken multiview',
            viewImages: {
              front: 'https://example.com/front.png',
              left: 'https://example.com/left.png',
            } as never,
            createdAt: Date.now(),
          },
        },
        { providers: [provider], s3Client: null, bucket: undefined }
      )
    ).rejects.toThrow('front/left/right images are required');
  });
});
