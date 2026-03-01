import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { JobStatus, JobType, AssetFormat, SkeletonPreset } from '@ai-3d-platform/shared';
import { createApp } from '../src/app';
import { JobQueueLike } from '../src/routes/jobs';

function createQueueMock(overrides: Partial<JobQueueLike> = {}): JobQueueLike {
  return {
    add: vi.fn().mockResolvedValue(undefined),
    getJob: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('POST /v1/jobs — format and skeletonOptions', () => {
  it('accepts a GLB text job (default)', async () => {
    const queue = createQueueMock();
    const app = createApp(queue, { includeHistory: false, saveToHistory: vi.fn().mockResolvedValue(undefined) });

    const res = await request(app)
      .post('/v1/jobs')
      .send({ type: 'text', prompt: 'a red car', format: AssetFormat.GLB });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe(JobStatus.Queued);
  });

  it('accepts an FBX text job', async () => {
    const queue = createQueueMock();
    const app = createApp(queue, { includeHistory: false, saveToHistory: vi.fn().mockResolvedValue(undefined) });

    const res = await request(app)
      .post('/v1/jobs')
      .send({ type: 'text', prompt: 'a knight', format: AssetFormat.FBX });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe(JobStatus.Queued);
  });

  it('accepts FBX job with skeletonOptions humanoid', async () => {
    const queue = createQueueMock();
    const app = createApp(queue, { includeHistory: false, saveToHistory: vi.fn().mockResolvedValue(undefined) });

    const res = await request(app)
      .post('/v1/jobs')
      .send({
        type: 'text',
        prompt: 'a warrior',
        format: AssetFormat.FBX,
        skeletonOptions: { preset: SkeletonPreset.Humanoid },
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe(JobStatus.Queued);
    // Verify format and skeletonOptions were passed to the queue
    const addCall = (queue.add as ReturnType<typeof vi.fn>).mock.calls[0];
    const jobData = addCall[1];
    expect(jobData.format).toBe(AssetFormat.FBX);
    expect(jobData.skeletonOptions).toEqual({ preset: SkeletonPreset.Humanoid });
  });

  it('accepts FBX job with skeletonOptions quadruped', async () => {
    const queue = createQueueMock();
    const app = createApp(queue, { includeHistory: false, saveToHistory: vi.fn().mockResolvedValue(undefined) });

    const res = await request(app)
      .post('/v1/jobs')
      .send({
        type: 'text',
        prompt: 'a horse',
        format: AssetFormat.FBX,
        skeletonOptions: { preset: SkeletonPreset.Quadruped },
      });

    expect(res.status).toBe(201);
  });

  it('rejects skeletonOptions when format is GLB', async () => {
    const queue = createQueueMock();
    const app = createApp(queue, { includeHistory: false, saveToHistory: vi.fn().mockResolvedValue(undefined) });

    const res = await request(app)
      .post('/v1/jobs')
      .send({
        type: 'text',
        prompt: 'a robot',
        format: AssetFormat.GLB,
        skeletonOptions: { preset: SkeletonPreset.Humanoid },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  it('rejects skeletonOptions when format is omitted', async () => {
    const queue = createQueueMock();
    const app = createApp(queue, { includeHistory: false, saveToHistory: vi.fn().mockResolvedValue(undefined) });

    const res = await request(app)
      .post('/v1/jobs')
      .send({
        type: 'text',
        prompt: 'a robot',
        skeletonOptions: { preset: SkeletonPreset.Humanoid },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  it('rejects invalid format value', async () => {
    const queue = createQueueMock();
    const app = createApp(queue, { includeHistory: false, saveToHistory: vi.fn().mockResolvedValue(undefined) });

    const res = await request(app)
      .post('/v1/jobs')
      .send({ type: 'text', prompt: 'a table', format: 'obj' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  it('rejects invalid skeletonPreset value', async () => {
    const queue = createQueueMock();
    const app = createApp(queue, { includeHistory: false, saveToHistory: vi.fn().mockResolvedValue(undefined) });

    const res = await request(app)
      .post('/v1/jobs')
      .send({
        type: 'text',
        prompt: 'a ghost',
        format: AssetFormat.FBX,
        skeletonOptions: { preset: 'bipedal' },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });
});
