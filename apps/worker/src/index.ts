import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { JobData, createS3Client, getStorageConfig } from '@ai-3d-platform/shared';
import { createMeshyProvider } from './providers/meshy-adapter';
import { createHunyuanProvider } from './providers/hunyuan';
import { generate3D } from './core';

const QUEUE_NAME = '3d-generation';

interface JobReturn {
  assetId: string;
  assetUrl: string;
}

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

const redis = new Redis(connection);

// Initialize S3 client
const s3Client = createS3Client();
const storageConfig = getStorageConfig();

if (s3Client && storageConfig) {
  console.log(`[Storage] S3 configured: bucket=${storageConfig.bucket}`);
} else {
  console.log('[Storage] S3 not configured, using local storage');
}

// Asset storage in Redis
const ASSET_PREFIX = 'asset:';

const providers = [createHunyuanProvider(), createMeshyProvider()];

const worker = new Worker<JobData, JobReturn>(
  QUEUE_NAME,
  async (job: Job<JobData, JobReturn>) => {
    console.log(`Processing job ${job.id}: ${job.data.type} - ${job.data.prompt}`);

    // Generate 3D model (Meshy API or mock)
    const result = await generate3D(job, {
      providers,
      s3Client,
      bucket: storageConfig?.bucket,
      envProvider: process.env.PROVIDER,
    });

    // Store asset URL in Redis
    await redis.set(`${ASSET_PREFIX}${result.assetId}`, result.assetUrl);

    console.log(`Job ${job.id} completed, asset: ${result.assetId}`);

    return result;
  },
  {
    connection,
    concurrency: 2,
  }
);

worker.on('completed', (job: Job<JobData, JobReturn>) => {
  console.log(`Job ${job.id} completed successfully`);
});

worker.on('failed', (job: Job<JobData, JobReturn> | undefined, err: Error) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

console.log('Worker started, waiting for jobs...');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing worker...');
  await worker.close();
  await redis.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing worker...');
  await worker.close();
  await redis.quit();
  process.exit(0);
});
