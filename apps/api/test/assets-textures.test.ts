import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { AssetStoreLike } from '../src/routes/assets';

function createQueueMock() {
  return {
    add: vi.fn().mockResolvedValue(undefined),
    getJob: vi.fn().mockResolvedValue(null),
  };
}

function createStore(seed: Record<string, string> = {}): AssetStoreLike {
  const map = new Map(Object.entries(seed));
  return {
    get: vi.fn(async (key: string) => map.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => { map.set(key, value); }),
  };
}

describe('GET /v1/assets/:id/textures', () => {
  it('returns texture map URLs when textures exist', async () => {
    const textures = { albedo: 'https://cdn.meshy.ai/albedo.png', normal: 'https://cdn.meshy.ai/normal.png' };
    const textureStore = createStore({ 'textures:asset-1': JSON.stringify(textures) });
    const assetStore = createStore({ 'asset:asset-1': 'https://cdn.example.com/model.glb' });

    const app = createApp(createQueueMock(), {
      includeHistory: false,
      saveToHistory: vi.fn().mockResolvedValue(undefined),
      assets: { assetStore, textureStore },
    });

    const res = await request(app).get('/v1/assets/asset-1/textures');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(textures);
  });

  it('returns 404 when textures are not found', async () => {
    const textureStore = createStore();
    const assetStore = createStore();

    const app = createApp(createQueueMock(), {
      includeHistory: false,
      saveToHistory: vi.fn().mockResolvedValue(undefined),
      assets: { assetStore, textureStore },
    });

    const res = await request(app).get('/v1/assets/missing/textures');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Textures not found');
  });

  it('returns all four texture map types when present', async () => {
    const textures = {
      albedo: 'https://cdn.meshy.ai/albedo.png',
      normal: 'https://cdn.meshy.ai/normal.png',
      roughness: 'https://cdn.meshy.ai/roughness.png',
      metallic: 'https://cdn.meshy.ai/metallic.png',
    };
    const textureStore = createStore({ 'textures:asset-full': JSON.stringify(textures) });
    const assetStore = createStore();

    const app = createApp(createQueueMock(), {
      includeHistory: false,
      saveToHistory: vi.fn().mockResolvedValue(undefined),
      assets: { assetStore, textureStore },
    });

    const res = await request(app).get('/v1/assets/asset-full/textures');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(textures);
  });
});
