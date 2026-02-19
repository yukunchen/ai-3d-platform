import { Queue } from 'bullmq';
import { JobData } from '@ai-3d-platform/shared';

const QUEUE_NAME = '3d-generation';

export function createQueue(): Queue<JobData> {
  const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  };

  return new Queue<JobData>(QUEUE_NAME, { connection });
}
