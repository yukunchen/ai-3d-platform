import { Router, Request, Response } from 'express';
import Redis from 'ioredis';
import { z } from 'zod';
import { JobStatus, JobType } from '@ai-3d-platform/shared';

const HISTORY_KEY = 'job:history';
const MAX_HISTORY_SIZE = 1000;

let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (redisClient && redisClient.status === 'ready') {
    return redisClient;
  }

  const host = process.env.REDIS_HOST || 'localhost';
  const port = parseInt(process.env.REDIS_PORT || '6379');

  redisClient = new Redis({
    host,
    port,
    lazyConnect: true,
  });

  redisClient.on('error', (err) => console.error('Redis Client Error:', err));

  return redisClient;
}

/**
 * Job history record stored in Redis
 */
export interface JobHistoryRecord {
  jobId: string;
  type: JobType;
  prompt: string;
  status: JobStatus;
  createdAt: number;
  assetId: string | null;
}

/**
 * Save job to history
 */
export async function saveJobToHistory(
  jobId: string,
  type: JobType,
  prompt: string,
  status: JobStatus = JobStatus.Queued,
  assetId: string | null = null
): Promise<void> {
  const client = getRedisClient();

  const record: JobHistoryRecord = {
    jobId,
    type,
    prompt,
    status,
    createdAt: Date.now(),
    assetId,
  };

  // Push to the beginning of the list (most recent first)
  await client.lpush(HISTORY_KEY, JSON.stringify(record));

  // Trim to keep only the most recent records
  await client.ltrim(HISTORY_KEY, 0, MAX_HISTORY_SIZE - 1);
}

/**
 * Update job status in history
 */
export async function updateJobStatusInHistory(
  jobId: string,
  status: JobStatus,
  assetId: string | null = null
): Promise<void> {
  const client = getRedisClient();

  // Get all records
  const records = await client.lrange(HISTORY_KEY, 0, -1);

  // Find and update the matching job
  for (let i = 0; i < records.length; i++) {
    const record: JobHistoryRecord = JSON.parse(records[i]);
    if (record.jobId === jobId) {
      record.status = status;
      if (assetId !== null) {
        record.assetId = assetId;
      }
      // Re-store the record at the same position using lset
      await client.lset(HISTORY_KEY, i, JSON.stringify(record));
      break;
    }
  }
}

const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum([JobType.Text, JobType.Image, JobType.MultiView]).optional(),
  status: z.enum([JobStatus.Queued, JobStatus.Running, JobStatus.Succeeded, JobStatus.Failed]).optional(),
});

export interface JobHistoryResponse {
  data: JobHistoryRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function createHistoryRouter(): Router {
  const router = Router();

  // GET /v1/jobs - Get job history list with pagination
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const query = historyQuerySchema.parse(_req.query);

      const client = getRedisClient();

      // Get all records
      const records = await client.lrange(HISTORY_KEY, 0, -1);

      // Parse and filter records
      let filteredRecords: JobHistoryRecord[] = records.map((record) => JSON.parse(record));

      // Apply type filter
      if (query.type) {
        filteredRecords = filteredRecords.filter((r) => r.type === query.type);
      }

      // Apply status filter
      if (query.status) {
        filteredRecords = filteredRecords.filter((r) => r.status === query.status);
      }

      // Calculate pagination
      const total = filteredRecords.length;
      const totalPages = Math.ceil(total / query.limit);
      const startIndex = (query.page - 1) * query.limit;
      const endIndex = startIndex + query.limit;

      const paginatedData = filteredRecords.slice(startIndex, endIndex);

      const response: JobHistoryResponse = {
        data: paginatedData,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages,
        },
      };

      res.json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      console.error('Error getting job history:', error);
      res.status(500).json({ error: 'Failed to get job history' });
    }
  });

  return router;
}
