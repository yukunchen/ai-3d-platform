import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import cors from 'cors';
import path from 'path';
import { createJobRouter, JobQueueLike } from './routes/jobs';
import { createAssetsRouter, AssetsRouterDeps } from './routes/assets';
import { createHistoryRouter, createBudgetRouter } from './routes/history';
import { createAuthRouter, AuthStoreLike } from './routes/auth';
import { createApiKeysRouter } from './routes/api-keys';
import { createAuthMiddleware, noopMiddleware, AuthDeps } from './middleware/auth';
import { JobStatus, JobType, User } from '@ai-3d-platform/shared';

export interface AuthOptions {
  authStore: AuthStoreLike;
  jwtSecret: string;
}

interface CreateAppOptions {
  includeHistory?: boolean;
  assets?: AssetsRouterDeps;
  auth?: AuthOptions;
  saveToHistory?: (
    jobId: string,
    type: JobType,
    prompt: string,
    status?: JobStatus,
    assetId?: string | null
  ) => Promise<void>;
}

export function createApp(queue: JobQueueLike, options: CreateAppOptions = {}) {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use('/storage', express.static(path.join(__dirname, '..', 'storage')));

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // Auth routes and middleware (when auth is configured)
  let authenticate: RequestHandler = noopMiddleware;

  if (options.auth) {
    const { authStore, jwtSecret } = options.auth;

    // Helpers for auth middleware
    async function getUser(userId: string): Promise<User | null> {
      const json = await authStore.get(`user:${userId}`);
      return json ? JSON.parse(json) : null;
    }
    async function getApiKeyUser(keyHash: string): Promise<User | null> {
      const apiKeyJson = await authStore.get(`apikey:${keyHash}`);
      if (!apiKeyJson) return null;
      const apiKey = JSON.parse(apiKeyJson);
      return getUser(apiKey.userId);
    }

    const authDeps: AuthDeps = { getUser, getApiKeyUser, jwtSecret };
    authenticate = createAuthMiddleware(authDeps);

    // Mount auth routes
    app.use('/v1/auth', createAuthRouter({ authStore, jwtSecret }));
    app.use('/v1/api-keys', createApiKeysRouter({ apiKeyStore: authStore, authenticate }));
  }

  app.use('/v1/jobs', authenticate, createJobRouter(queue, { saveToHistory: options.saveToHistory }));
  if (options.includeHistory !== false) {
    app.use('/v1/jobs', createHistoryRouter());
    app.use('/v1/budget', createBudgetRouter());
  }
  app.use('/v1/assets', authenticate, createAssetsRouter(options.assets));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
