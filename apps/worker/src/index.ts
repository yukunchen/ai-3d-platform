import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { JobData, createS3Client, getStorageConfig } from '@ai-3d-platform/shared';
import { generateFromText, generateFromImage, isMeshyConfigured } from './providers/meshy';

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

// Log Meshy configuration
const meshyConfigured = isMeshyConfigured();
console.log(`[Meshy] API configured: ${meshyConfigured}, API Key: ${process.env.MESHY_API_KEY ? '***' + process.env.MESHY_API_KEY.slice(-4) : 'NOT SET'}`);

// Generate 3D model using Meshy API or mock provider
async function generate3D(job: Job<JobData, JobReturn>): Promise<JobReturn> {
  const useMeshy = isMeshyConfigured();

  if (!useMeshy) {
    console.log(`[Mock Provider] Generating 3D for job ${job.id}`);
    console.log(`[Mock Provider] Type: ${job.data.type}, Prompt: ${job.data.prompt.substring(0, 50)}...`);

    // Simulate generation time (1-3 seconds) for mock
    const delay = 1000 + Math.random() * 2000;
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Import mock generator dynamically to avoid circular dependency
    const { generatePlaceholderGLB } = await import('./glb-generator');

    // Generate placeholder GLB and upload to S3
    const result = await generatePlaceholderGLB(
      job.id!,
      s3Client,
      storageConfig?.bucket
    );

    console.log(`[Mock Provider] Generated asset: ${result.assetId}`);

    return result;
  }

  // Use Meshy API based on job type
  if (job.data.type === 'image' && job.data.imageUrl) {
    return generateFromImage(job, s3Client, storageConfig?.bucket);
  }

  // Default to text-to-3d
  return generateFromText(job, s3Client, storageConfig?.bucket);
}

const worker = new Worker<JobData, JobReturn>(
  QUEUE_NAME,
  async (job: Job<JobData, JobReturn>) => {
    console.log(`Processing job ${job.id}: ${job.data.type} - ${job.data.prompt}`);

    // Generate 3D model (Meshy API or mock)
    const result = await generate3D(job);

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
