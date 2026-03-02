import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { JobStatus, JobType, AssetFormat, AnimationType } from '@ai-3d-platform/shared';
import { createApp } from '../src/app';
import { JobQueueLike } from '../src/routes/jobs';

function createQueueMock(overrides: Partial<JobQueueLike> = {}): JobQueueLike {
  return {
    add: vi.fn().mockResolvedValue(undefined),
    getJob: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('POST /v1/jobs — animationOptions', () => {
  it('accepts FBX job with animationOptions type=walk', async () => {
    const queue = createQueueMock();
    const app = createApp(queue, { includeHistory: false, saveToHistory: vi.fn().mockResolvedValue(undefined) });

    const res = await request(app)
      .post('/v1/jobs')
      .send({
        type: 'text',
        prompt: 'a walking character',
        format: AssetFormat.FBX,
        animationOptions: { type: AnimationType.Walk },
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe(JobStatus.Queued);
    // Verify animationOptions were passed to the queue
    const addCall = (queue.add as ReturnType<typeof vi.fn>).mock.calls[0];
    const jobData = addCall[1];
    expect(jobData.format).toBe(AssetFormat.FBX);
    expect(jobData.animationOptions).toEqual({ type: AnimationType.Walk });
  });

  it('rejects animationOptions with non-none type when format is GLB', async () => {
    const queue = createQueueMock();
    const app = createApp(queue, { includeHistory: false, saveToHistory: vi.fn().mockResolvedValue(undefined) });

    const res = await request(app)
      .post('/v1/jobs')
      .send({
        type: 'text',
        prompt: 'a robot',
        format: AssetFormat.GLB,
        animationOptions: { type: AnimationType.Walk },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  it('accepts animationOptions with type=none when format is GLB', async () => {
    const queue = createQueueMock();
    const app = createApp(queue, { includeHistory: false, saveToHistory: vi.fn().mockResolvedValue(undefined) });

    const res = await request(app)
      .post('/v1/jobs')
      .send({
        type: 'text',
        prompt: 'a static model',
        format: AssetFormat.GLB,
        animationOptions: { type: AnimationType.None },
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe(JobStatus.Queued);
  });

  it('accepts job without animationOptions (optional field)', async () => {
    const queue = createQueueMock();
    const app = createApp(queue, { includeHistory: false, saveToHistory: vi.fn().mockResolvedValue(undefined) });

    const res = await request(app)
      .post('/v1/jobs')
      .send({
        type: 'text',
        prompt: 'a simple cube',
        format: AssetFormat.FBX,
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe(JobStatus.Queued);
  });

  it('accepts FBX job with animationOptions type=custom and customClipUrl', async () => {
    const queue = createQueueMock();
    const app = createApp(queue, { includeHistory: false, saveToHistory: vi.fn().mockResolvedValue(undefined) });

    const res = await request(app)
      .post('/v1/jobs')
      .send({
        type: 'text',
        prompt: 'a dancing figure',
        format: AssetFormat.FBX,
        animationOptions: { type: AnimationType.Custom, customClipUrl: 'https://example.com/dance.fbx' },
      });

    expect(res.status).toBe(201);
    const addCall = (queue.add as ReturnType<typeof vi.fn>).mock.calls[0];
    const jobData = addCall[1];
    expect(jobData.animationOptions).toEqual({
      type: AnimationType.Custom,
      customClipUrl: 'https://example.com/dance.fbx',
    });
  });

  it('rejects animationOptions with non-none type when format is omitted', async () => {
    const queue = createQueueMock();
    const app = createApp(queue, { includeHistory: false, saveToHistory: vi.fn().mockResolvedValue(undefined) });

    const res = await request(app)
      .post('/v1/jobs')
      .send({
        type: 'text',
        prompt: 'a running figure',
        animationOptions: { type: AnimationType.Run },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  it('rejects invalid animationType value', async () => {
    const queue = createQueueMock();
    const app = createApp(queue, { includeHistory: false, saveToHistory: vi.fn().mockResolvedValue(undefined) });

    const res = await request(app)
      .post('/v1/jobs')
      .send({
        type: 'text',
        prompt: 'a figure',
        format: AssetFormat.FBX,
        animationOptions: { type: 'dance' },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  it('accepts FBX job with animationOptions type=idle', async () => {
    const queue = createQueueMock();
    const app = createApp(queue, { includeHistory: false, saveToHistory: vi.fn().mockResolvedValue(undefined) });

    const res = await request(app)
      .post('/v1/jobs')
      .send({
        type: 'text',
        prompt: 'an idle guard',
        format: AssetFormat.FBX,
        animationOptions: { type: AnimationType.Idle },
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe(JobStatus.Queued);
  });
});
