import request from 'supertest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createApp, AuthOptions } from '../src/app';
import { JobQueueLike } from '../src/routes/jobs';
import { AssetStoreLike } from '../src/routes/assets';

// In-memory store that mimics Redis get/set/del
function createMemoryStore(): AssetStoreLike & { del(key: string): Promise<void> } {
  const map = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => map.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      map.set(key, value);
    }),
    del: vi.fn(async (key: string) => {
      map.delete(key);
    }),
  };
}

function createQueueMock(): JobQueueLike {
  return {
    add: vi.fn().mockResolvedValue(undefined),
    getJob: vi.fn().mockResolvedValue(null),
  };
}

const JWT_SECRET = 'test-secret-key-for-testing';

function createTestApp(store?: ReturnType<typeof createMemoryStore>) {
  const authStore = store || createMemoryStore();
  const queue = createQueueMock();
  const auth: AuthOptions = { authStore, jwtSecret: JWT_SECRET };
  const app = createApp(queue, {
    includeHistory: false,
    saveToHistory: vi.fn().mockResolvedValue(undefined),
    auth,
  });
  return { app, queue, authStore };
}

async function registerUser(app: ReturnType<typeof createTestApp>['app'], overrides: Record<string, string> = {}) {
  const body = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
    ...overrides,
  };
  return request(app).post('/v1/auth/register').send(body);
}

async function loginUser(app: ReturnType<typeof createTestApp>['app'], overrides: Record<string, string> = {}) {
  const body = {
    email: 'test@example.com',
    password: 'password123',
    ...overrides,
  };
  return request(app).post('/v1/auth/login').send(body);
}

describe('Auth endpoints', () => {
  describe('POST /v1/auth/register', () => {
    it('creates user and returns JWT + user object (201)', async () => {
      const { app } = createTestApp();
      const res = await registerUser(app);

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('test@example.com');
      expect(res.body.user.name).toBe('Test User');
      expect(res.body.user.role).toBe('user');
      expect(typeof res.body.token).toBe('string');
      expect(res.body.expiresAt).toBeGreaterThan(Date.now());
    });

    it('returns 409 for duplicate email', async () => {
      const { app } = createTestApp();
      await registerUser(app);
      const res = await registerUser(app);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Email already registered');
    });

    it('returns 400 for invalid email', async () => {
      const { app } = createTestApp();
      const res = await registerUser(app, { email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    it('returns 400 for short password', async () => {
      const { app } = createTestApp();
      const res = await registerUser(app, { password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });
  });

  describe('POST /v1/auth/login', () => {
    it('returns JWT on correct password (200)', async () => {
      const store = createMemoryStore();
      const { app } = createTestApp(store);
      await registerUser(app);

      const res = await loginUser(app);

      expect(res.status).toBe(200);
      expect(typeof res.body.token).toBe('string');
      expect(res.body.user.email).toBe('test@example.com');
    });

    it('returns 401 on wrong password', async () => {
      const store = createMemoryStore();
      const { app } = createTestApp(store);
      await registerUser(app);

      const res = await loginUser(app, { password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });

    it('returns 401 for non-existent email', async () => {
      const { app } = createTestApp();
      const res = await loginUser(app, { email: 'nobody@example.com' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });
  });

  describe('GET /v1/auth/me', () => {
    it('returns user with valid JWT', async () => {
      const store = createMemoryStore();
      const { app } = createTestApp(store);
      const regRes = await registerUser(app);
      const token = regRes.body.token;

      const res = await request(app)
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('test@example.com');
      expect(res.body.name).toBe('Test User');
    });

    it('returns 401 with no token', async () => {
      const { app } = createTestApp();
      const res = await request(app).get('/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authentication required');
    });

    it('returns 401 with invalid token', async () => {
      const { app } = createTestApp();
      const res = await request(app)
        .get('/v1/auth/me')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired token');
    });
  });

  describe('API Keys', () => {
    async function getTokenAndApp() {
      const store = createMemoryStore();
      const { app, queue } = createTestApp(store);
      const regRes = await registerUser(app);
      return { app, token: regRes.body.token, queue };
    }

    it('POST /v1/api-keys creates key and returns raw key once', async () => {
      const { app, token } = await getTokenAndApp();

      const res = await request(app)
        .post('/v1/api-keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'My Key' });

      expect(res.status).toBe(201);
      expect(typeof res.body.key).toBe('string');
      expect(res.body.key.length).toBe(64); // 32 bytes hex
      expect(res.body.name).toBe('My Key');
      expect(typeof res.body.id).toBe('string');
    });

    it('GET /v1/api-keys lists keys without raw key', async () => {
      const { app, token } = await getTokenAndApp();

      await request(app)
        .post('/v1/api-keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Key 1' });

      const res = await request(app)
        .get('/v1/api-keys')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe('Key 1');
      // Raw key should not be in the response; the stored hash should be stripped
      expect(res.body[0].key).toBeUndefined();
    });

    it('DELETE /v1/api-keys/:id revokes key', async () => {
      const { app, token } = await getTokenAndApp();

      const createRes = await request(app)
        .post('/v1/api-keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Temp Key' });

      const keyId = createRes.body.id;

      const delRes = await request(app)
        .delete(`/v1/api-keys/${keyId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(delRes.status).toBe(204);

      // Verify key is gone
      const listRes = await request(app)
        .get('/v1/api-keys')
        .set('Authorization', `Bearer ${token}`);

      expect(listRes.body.length).toBe(0);
    });
  });

  describe('Protected routes', () => {
    it('POST /v1/jobs with valid JWT succeeds', async () => {
      const store = createMemoryStore();
      const { app, queue } = createTestApp(store);
      const regRes = await registerUser(app);
      const token = regRes.body.token;

      const res = await request(app)
        .post('/v1/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'text', prompt: 'A red car' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('queued');
    });

    it('POST /v1/jobs without token returns 401 (auth enabled)', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .post('/v1/jobs')
        .send({ type: 'text', prompt: 'A red car' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authentication required');
    });
  });
});

describe('Backward compatibility (no auth)', () => {
  it('POST /v1/jobs works without auth options', async () => {
    const queue = createQueueMock();
    const app = createApp(queue, {
      includeHistory: false,
      saveToHistory: vi.fn().mockResolvedValue(undefined),
    });

    const res = await request(app)
      .post('/v1/jobs')
      .send({ type: 'text', prompt: 'A blue chair' });

    expect(res.status).toBe(201);
  });
});
