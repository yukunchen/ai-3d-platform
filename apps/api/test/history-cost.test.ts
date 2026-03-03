import { describe, expect, it, vi, beforeEach } from 'vitest';
import { JobStatus, JobType } from '@ai-3d-platform/shared';

// Shared in-memory state that all tests manipulate
const store = new Map<string, string>();
const lists = new Map<string, string[]>();

// Create persistent mock fns
const mockOn = vi.fn();
const mockGet = vi.fn(async (key: string) => store.get(key) ?? null);
const mockSet = vi.fn(async (key: string, value: string) => { store.set(key, value); });
const mockIncrby = vi.fn(async (key: string, amount: number) => {
  const current = parseInt(store.get(key) || '0', 10);
  const next = current + amount;
  store.set(key, String(next));
  return next;
});
const mockExpire = vi.fn(async () => 1);
const mockLpush = vi.fn(async (key: string, value: string) => {
  const list = lists.get(key) || [];
  list.unshift(value);
  lists.set(key, list);
  return list.length;
});
const mockLtrim = vi.fn(async () => 'OK');
const mockLrange = vi.fn(async (key: string, start: number, stop: number) => {
  const list = lists.get(key) || [];
  const end = stop === -1 ? list.length : stop + 1;
  return list.slice(start, end);
});
const mockLset = vi.fn(async (key: string, index: number, value: string) => {
  const list = lists.get(key) || [];
  list[index] = value;
  return 'OK';
});

vi.mock('ioredis', () => {
  return {
    default: class MockRedis {
      status = 'ready';
      on = mockOn;
      get = mockGet;
      set = mockSet;
      incrby = mockIncrby;
      expire = mockExpire;
      lpush = mockLpush;
      ltrim = mockLtrim;
      lrange = mockLrange;
      lset = mockLset;
    },
  };
});

// Must import AFTER vi.mock
import request from 'supertest';
import { createApp } from '../src/app';
import { JobQueueLike } from '../src/routes/jobs';
import { saveJobToHistory } from '../src/routes/history';

function createQueueMock(): JobQueueLike {
  return {
    add: vi.fn().mockResolvedValue(undefined),
    getJob: vi.fn().mockResolvedValue(null),
  };
}

describe('History cost tracking', () => {
  beforeEach(() => {
    store.clear();
    lists.clear();
    mockOn.mockClear();
    mockGet.mockClear();
    mockSet.mockClear();
    mockIncrby.mockClear();
    mockExpire.mockClear();
    mockLpush.mockClear();
    mockLtrim.mockClear();
    mockLrange.mockClear();
    mockLset.mockClear();
  });

  it('saveJobToHistory stores cost field', async () => {
    await saveJobToHistory('job-c1', JobType.Text, 'A dragon', JobStatus.Succeeded, 'asset-1', 150);

    expect(mockLpush).toHaveBeenCalledTimes(1);
    const storedRecord = JSON.parse(mockLpush.mock.calls[0][1]);
    expect(storedRecord.cost).toBe(150);
    expect(storedRecord.jobId).toBe('job-c1');
    expect(storedRecord.type).toBe('text');
  });

  it('saveJobToHistory works without cost', async () => {
    await saveJobToHistory('job-c2', JobType.Image, 'A car', JobStatus.Queued);

    expect(mockLpush).toHaveBeenCalledTimes(1);
    const storedRecord = JSON.parse(mockLpush.mock.calls[0][1]);
    expect(storedRecord.cost).toBeUndefined();
  });

  it('saveJobToHistory increments daily budget when cost is provided', async () => {
    await saveJobToHistory('job-c3', JobType.Text, 'A robot', JobStatus.Succeeded, 'asset-2', 200);

    expect(mockIncrby).toHaveBeenCalledTimes(1);
    const today = new Date().toISOString().slice(0, 10);
    expect(mockIncrby.mock.calls[0][0]).toBe(`budget:daily:${today}`);
    expect(mockIncrby.mock.calls[0][1]).toBe(200);
  });

  it('GET /v1/jobs response includes cost in each record', async () => {
    const record = {
      jobId: 'job-r1',
      type: 'text',
      prompt: 'A castle',
      status: 'succeeded',
      createdAt: Date.now(),
      assetId: 'asset-r1',
      cost: 350,
    };
    lists.set('job:history', [JSON.stringify(record)]);

    const queue = createQueueMock();
    const app = createApp(queue, {
      includeHistory: true,
      saveToHistory: vi.fn().mockResolvedValue(undefined),
    });

    const res = await request(app).get('/v1/jobs');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].cost).toBe(350);
  });

  it('GET /v1/budget/daily returns correct aggregated total', async () => {
    const today = new Date().toISOString().slice(0, 10);
    store.set(`budget:daily:${today}`, '5000');

    const queue = createQueueMock();
    const app = createApp(queue, {
      includeHistory: true,
      saveToHistory: vi.fn().mockResolvedValue(undefined),
    });

    const res = await request(app).get('/v1/budget/daily');
    expect(res.status).toBe(200);
    expect(res.body.date).toBe(today);
    expect(res.body.totalCents).toBe(5000);
    expect(res.body.limitCents).toBe(10000);
    expect(res.body.exceeded).toBe(false);
  });

  it('GET /v1/budget/daily sets exceeded=true when over limit', async () => {
    const today = new Date().toISOString().slice(0, 10);
    store.set(`budget:daily:${today}`, '15000');

    const queue = createQueueMock();
    const app = createApp(queue, {
      includeHistory: true,
      saveToHistory: vi.fn().mockResolvedValue(undefined),
    });

    const res = await request(app).get('/v1/budget/daily');
    expect(res.status).toBe(200);
    expect(res.body.exceeded).toBe(true);
    expect(res.body.totalCents).toBe(15000);
  });

  it('filtering by status and type works with cost field present', async () => {
    const records = [
      { jobId: 'j1', type: 'text', prompt: 'A', status: 'succeeded', createdAt: 1, assetId: 'a1', cost: 100 },
      { jobId: 'j2', type: 'image', prompt: 'B', status: 'failed', createdAt: 2, assetId: null, cost: 200 },
      { jobId: 'j3', type: 'text', prompt: 'C', status: 'succeeded', createdAt: 3, assetId: 'a3' },
    ];
    lists.set('job:history', records.map((r) => JSON.stringify(r)));

    const queue = createQueueMock();
    const app = createApp(queue, {
      includeHistory: true,
      saveToHistory: vi.fn().mockResolvedValue(undefined),
    });

    // Filter by status=succeeded
    const res1 = await request(app).get('/v1/jobs?status=succeeded');
    expect(res1.status).toBe(200);
    expect(res1.body.data).toHaveLength(2);
    expect(res1.body.data.every((r: { status: string }) => r.status === 'succeeded')).toBe(true);

    // Filter by type=image
    const res2 = await request(app).get('/v1/jobs?type=image');
    expect(res2.status).toBe(200);
    expect(res2.body.data).toHaveLength(1);
    expect(res2.body.data[0].jobId).toBe('j2');
  });
});
