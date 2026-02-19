import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { createJobRouter } from './routes/jobs';
import { createAssetsRouter } from './routes/assets';
import { createHistoryRouter } from './routes/history';
import { createQueue } from './queue';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve local storage files
app.use('/storage', express.static(path.join(__dirname, '..', 'storage')));

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Initialize queue
const queue = createQueue();

// Routes
app.use('/v1/jobs', createJobRouter(queue));
app.use('/v1/jobs', createHistoryRouter());
app.use('/v1/assets', createAssetsRouter());

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API server running on port ${PORT}`);
});

export { app, queue };
