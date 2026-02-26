import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { createJobRouter, JobQueueLike } from './routes/jobs';
import { createAssetsRouter, AssetsRouterDeps } from './routes/assets';
import { createHistoryRouter } from './routes/history';
import { JobStatus, JobType } from '@ai-3d-platform/shared';

interface CreateAppOptions {
  includeHistory?: boolean;
  assets?: AssetsRouterDeps;
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

  app.use('/v1/jobs', createJobRouter(queue, { saveToHistory: options.saveToHistory }));
  if (options.includeHistory !== false) {
    app.use('/v1/jobs', createHistoryRouter());
  }
  app.use('/v1/assets', createAssetsRouter(options.assets));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
