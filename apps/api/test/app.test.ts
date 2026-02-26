import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { JobStatus, JobType } from '@ai-3d-platform/shared';
import { createApp } from '../src/app';
import { JobQueueLike, QueueJobLike } from '../src/routes/jobs';
import { AssetStoreLike } from '../src/routes/assets';

function createQueueMock(overrides: Partial<JobQueueLike> = {}): JobQueueLike {
  return {
    add: vi.fn().mockResolvedValue(undefined),
    getJob: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function createJobMock(state: string, returnvalue: unknown = null, failedReason?: string): QueueJobLike {
  return {
    getState: vi.fn().mockResolvedValue(state),
    returnvalue: returnvalue as QueueJobLike['returnvalue'],
    failedReason,
  };
}

function createAssetStore(seed: Record<string, string> = {}): AssetStoreLike {
  const map = new Map(Object.entries(seed));
  return {
    get: vi.fn(async (key: string) => map.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      map.set(key, value);
    }),
  };
}

describe('API app', () => {
  it('returns health status', async () => {
    const queue = createQueueMock();
    const app = createApp(queue, {
      includeHistory: false,
      saveToHistory: vi.fn().mockResolvedValue(undefined),
    });

    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  describe('POST /v1/jobs', () => {
    it('creates a text job with queued status', async () => {
      const queue = createQueueMock();
      const saveToHistory = vi.fn().mockResolvedValue(undefined);
      const app = createApp(queue, { includeHistory: false, saveToHistory });

      const res = await request(app)
        .post('/v1/jobs')
        .send({ type: 'text', prompt: 'A red sports car' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('queued');
      expect(typeof res.body.jobId).toBe('string');
      expect((queue.add as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
      expect(saveToHistory).toHaveBeenCalledTimes(1);
    });

    it('rejects image jobs without imageUrl', async () => {
      const queue = createQueueMock();
      const app = createApp(queue, {
        includeHistory: false,
        saveToHistory: vi.fn().mockResolvedValue(undefined),
      });

      const res = await request(app)
        .post('/v1/jobs')
        .send({ type: 'image', prompt: 'From image' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    it('rejects text jobs with imageUrl', async () => {
      const queue = createQueueMock();
      const app = createApp(queue, {
        includeHistory: false,
        saveToHistory: vi.fn().mockResolvedValue(undefined),
      });

      const res = await request(app)
        .post('/v1/jobs')
        .send({ type: 'text', prompt: 'A robot', imageUrl: 'https://example.com/test.png' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    it('rejects prompts over 2000 chars', async () => {
      const queue = createQueueMock();
      const app = createApp(queue, {
        includeHistory: false,
        saveToHistory: vi.fn().mockResolvedValue(undefined),
      });

      const res = await request(app)
        .post('/v1/jobs')
        .send({ type: 'text', prompt: 'x'.repeat(2001) });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    it('creates a multiview job when front/left/right are provided', async () => {
      const queue = createQueueMock();
      const app = createApp(queue, {
        includeHistory: false,
        saveToHistory: vi.fn().mockResolvedValue(undefined),
      });

      const res = await request(app)
        .post('/v1/jobs')
        .send({
          type: 'multiview',
          prompt: 'A stylized toy car',
          viewImages: {
            front: 'https://example.com/front.png',
            left: 'https://example.com/left.png',
            right: 'https://example.com/right.png',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('queued');
    });

    it('rejects multiview jobs without viewImages', async () => {
      const queue = createQueueMock();
      const app = createApp(queue, {
        includeHistory: false,
        saveToHistory: vi.fn().mockResolvedValue(undefined),
      });

      const res = await request(app)
        .post('/v1/jobs')
        .send({ type: 'multiview', prompt: 'A toy' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    it('rejects text jobs with viewImages', async () => {
      const queue = createQueueMock();
      const app = createApp(queue, {
        includeHistory: false,
        saveToHistory: vi.fn().mockResolvedValue(undefined),
      });

      const res = await request(app)
        .post('/v1/jobs')
        .send({
          type: 'text',
          prompt: 'A robot',
          viewImages: {
            front: 'https://example.com/front.png',
            left: 'https://example.com/left.png',
            right: 'https://example.com/right.png',
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });
  });

  describe('GET /v1/jobs/:jobId', () => {
    it('maps waiting/delayed to queued', async () => {
      for (const state of ['waiting', 'delayed']) {
        const queue = createQueueMock({
          getJob: vi.fn().mockResolvedValue(createJobMock(state)),
        });
        const app = createApp(queue, { includeHistory: false, saveToHistory: vi.fn() });
        const res = await request(app).get('/v1/jobs/job-1');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          jobId: 'job-1',
          status: JobStatus.Queued,
          assetId: null,
          error: null,
        });
      }
    });

    it('maps active to running', async () => {
      const queue = createQueueMock({
        getJob: vi.fn().mockResolvedValue(createJobMock('active')),
      });
      const app = createApp(queue, { includeHistory: false, saveToHistory: vi.fn() });
      const res = await request(app).get('/v1/jobs/job-2');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(JobStatus.Running);
    });

    it('maps completed to succeeded and returns assetId', async () => {
      const queue = createQueueMock({
        getJob: vi.fn().mockResolvedValue(createJobMock('completed', { assetId: 'asset-1' })),
      });
      const app = createApp(queue, { includeHistory: false, saveToHistory: vi.fn() });
      const res = await request(app).get('/v1/jobs/job-3');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        jobId: 'job-3',
        status: JobStatus.Succeeded,
        assetId: 'asset-1',
        error: null,
      });
    });

    it('maps failed and returns failedReason', async () => {
      const queue = createQueueMock({
        getJob: vi.fn().mockResolvedValue(createJobMock('failed', null, 'provider timeout')),
      });
      const app = createApp(queue, { includeHistory: false, saveToHistory: vi.fn() });
      const res = await request(app).get('/v1/jobs/job-4');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        jobId: 'job-4',
        status: JobStatus.Failed,
        assetId: null,
        error: 'provider timeout',
      });
    });

    it('returns 404 when job does not exist', async () => {
      const queue = createQueueMock({ getJob: vi.fn().mockResolvedValue(null) });
      const app = createApp(queue, { includeHistory: false, saveToHistory: vi.fn() });
      const res = await request(app).get('/v1/jobs/not-found');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Job not found');
    });
  });

  describe('GET /v1/assets/*', () => {
    it('returns download URL and glb format', async () => {
      const queue = createQueueMock();
      const store = createAssetStore({ 'asset:asset-1': 'https://cdn.example.com/model.glb' });
      const app = createApp(queue, {
        includeHistory: false,
        saveToHistory: vi.fn().mockResolvedValue(undefined),
        assets: { assetStore: store, signUrl: vi.fn(async (url: string) => `${url}?signed=true`) },
      });

      const res = await request(app).get('/v1/assets/asset-1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        downloadUrl: 'https://cdn.example.com/model.glb?signed=true',
        format: 'glb',
      });
    });

    it('returns 404 when asset is not found', async () => {
      const queue = createQueueMock();
      const store = createAssetStore();
      const app = createApp(queue, {
        includeHistory: false,
        saveToHistory: vi.fn().mockResolvedValue(undefined),
        assets: { assetStore: store },
      });

      const res = await request(app).get('/v1/assets/missing');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Asset not found');
    });

    it('redirects preview endpoint to signed URL', async () => {
      const queue = createQueueMock();
      const store = createAssetStore({ 'asset:asset-2': 'https://cdn.example.com/preview.glb' });
      const app = createApp(queue, {
        includeHistory: false,
        saveToHistory: vi.fn().mockResolvedValue(undefined),
        assets: { assetStore: store, signUrl: vi.fn(async (url: string) => `${url}?preview=true`) },
      });

      const res = await request(app).get('/v1/assets/asset-2/preview');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('https://cdn.example.com/preview.glb?preview=true');
    });
  });

  it('accepts image jobs with imageUrl', async () => {
    const queue = createQueueMock();
    const app = createApp(queue, {
      includeHistory: false,
      saveToHistory: vi.fn().mockResolvedValue(undefined),
    });

    const res = await request(app)
      .post('/v1/jobs')
      .send({ type: JobType.Image, prompt: 'use image', imageUrl: 'https://example.com/a.png' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe(JobStatus.Queued);
  });
});
