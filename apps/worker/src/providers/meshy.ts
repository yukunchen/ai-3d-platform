import { S3Client } from '@aws-sdk/client-s3';
import { Job } from 'bullmq';
import { JobData } from '@ai-3d-platform/shared';
import { uploadToS3 } from '@ai-3d-platform/shared';
import { generatePlaceholderGLB } from '../glb-generator';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';

// Meshy API configuration
const MESHY_BASE_URL = 'https://api.meshy.ai';
const POLL_INTERVAL = 3000; // 3 seconds
const MAX_POLL_ATTEMPTS = 200; // Max 10 minutes (200 * 3s)
const TIMEOUT_MS = 600000; // 10 minutes timeout

interface MeshyConfig {
  apiKey: string;
}

interface TaskResult {
  assetId: string;
  assetUrl: string;
}

interface MeshyTaskResponse {
  id: string;
  type: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
  progress: number;
  model_urls?: {
    glb?: string;
    fbx?: string;
    obj?: string;
    usdz?: string;
  };
  texture_urls?: Array<{
    base_color?: string;
    metallic?: string;
    normal?: string;
    roughness?: string;
  }>;
  task_error?: {
    message: string;
  };
}

/**
 * Get Meshy configuration from environment variables
 */
function getMeshyConfig(): MeshyConfig | null {
  const apiKey = process.env.MESHY_API_KEY;

  if (!apiKey) {
    return null;
  }

  return { apiKey };
}

/**
 * Make HTTP request to Meshy API
 */
function makeRequest<T>(
  method: string,
  path: string,
  body?: object,
  apiKey?: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, MESHY_BASE_URL);
    const isHttps = url.protocol === 'https:';

    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: isHttps ? 443 : 80,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: TIMEOUT_MS,
    };

    const protocol = isHttps ? https : http;
    const req = protocol.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data as T);
          }
        } else {
          reject(new Error(`Meshy API error: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * Download file from URL
 */
async function downloadFile(urlString: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const isHttps = url.protocol === 'https:';
    const protocol = isHttps ? https : http;

    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: isHttps ? 443 : 80,
      path: url.pathname + url.search,
      method: 'GET',
      timeout: TIMEOUT_MS,
    };

    const req = protocol.request(options, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Handle redirect
        downloadFile(res.headers.location).then(resolve).catch(reject);
        return;
      }

      const chunks: Buffer[] = [];

      res.on('data', (chunk) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Download timeout'));
    });

    req.end();
  });
}

/**
 * Poll task status until completion
 */
async function pollTaskStatus(
  taskId: string,
  apiVersion: 'v1' | 'v2',
  apiKey: string,
  jobId?: string
): Promise<MeshyTaskResponse> {
  let attempts = 0;

  while (attempts < MAX_POLL_ATTEMPTS) {
    const response = await makeRequest<MeshyTaskResponse>(
      'GET',
      `/openapi/${apiVersion}/${apiVersion === 'v1' ? 'image-to-3d' : 'text-to-3d'}/${taskId}`,
      undefined,
      apiKey
    );

    if (jobId) {
      console.log(`[Meshy] Task ${taskId} progress: ${response.progress}%`);
    }

    if (response.status === 'SUCCEEDED') {
      return response;
    }

    if (response.status === 'FAILED' || response.status === 'CANCELED') {
      const errorMsg = response.task_error?.message || 'Task failed or canceled';
      throw new Error(`Meshy task ${response.status.toLowerCase()}: ${errorMsg}`);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
    attempts++;
  }

  throw new Error(`Meshy task polling timeout after ${MAX_POLL_ATTEMPTS} attempts`);
}

/**
 * Upload GLB to S3 or local storage
 */
async function uploadGLB(
  glbBuffer: Buffer,
  jobId: string,
  s3Client: S3Client | null,
  bucket: string | undefined
): Promise<TaskResult> {
  const assetId = `asset-${jobId}.glb`;

  let assetUrl: string;

  if (s3Client && bucket) {
    const s3Key = `assets/${assetId}`;
    await uploadToS3(s3Client, bucket, s3Key, glbBuffer, 'model/gltf-binary');
    assetUrl = `s3://${bucket}/${s3Key}`;
  } else {
    // Fallback: store locally (for development without S3)
    // Save to a shared storage directory that API can serve
    const storageDir = path.join(process.cwd(), '..', 'api', 'storage');
    await fs.promises.mkdir(storageDir, { recursive: true });
    const filePath = path.join(storageDir, assetId);
    await fs.promises.writeFile(filePath, glbBuffer);
    // Use relative path - will be proxied through frontend
    assetUrl = `/storage/${assetId}`;
  }

  return { assetId, assetUrl };
}

/**
 * Generate 3D model from text prompt using Meshy API
 */
export async function generateFromText(
  job: Job<JobData, TaskResult>,
  s3Client: S3Client | null,
  bucket: string | undefined
): Promise<TaskResult> {
  const config = getMeshyConfig();

  if (!config) {
    console.log('[Meshy] API key not configured, using mock provider');
    return generatePlaceholderGLB(job.id!, s3Client, bucket);
  }

  const { apiKey } = config;
  const { prompt } = job.data;

  console.log(`[Meshy] Generating 3D from text: "${prompt.substring(0, 50)}..."`);

  // Create text-to-3d task
  const createResponse = await makeRequest<{ result: string }>(
    'POST',
    '/openapi/v2/text-to-3d',
    {
      mode: 'preview',
      prompt: prompt,
      should_remesh: true,
    },
    apiKey
  );

  const taskId = createResponse.result;
  console.log(`[Meshy] Task created: ${taskId}`);

  // Poll for completion
  const result = await pollTaskStatus(taskId, 'v2', apiKey, job.id);

  if (!result.model_urls?.glb) {
    throw new Error('No GLB URL in Meshy response');
  }

  // Download GLB
  console.log(`[Meshy] Downloading GLB from: ${result.model_urls.glb}`);
  const glbBuffer = await downloadFile(result.model_urls.glb);

  // Upload to storage
  const uploadResult = await uploadGLB(glbBuffer, job.id!, s3Client, bucket);

  console.log(`[Meshy] Generated asset: ${uploadResult.assetId}`);

  return uploadResult;
}

/**
 * Generate 3D model from image using Meshy API
 */
export async function generateFromImage(
  job: Job<JobData, TaskResult>,
  s3Client: S3Client | null,
  bucket: string | undefined
): Promise<TaskResult> {
  const config = getMeshyConfig();

  if (!config) {
    console.log('[Meshy] API key not configured, using mock provider');
    return generatePlaceholderGLB(job.id!, s3Client, bucket);
  }

  const { apiKey } = config;
  const { imageUrl } = job.data;

  if (!imageUrl) {
    throw new Error('Image URL is required for image-to-3D generation');
  }

  console.log(`[Meshy] Generating 3D from image: ${imageUrl}`);

  // Create image-to-3d task
  const createResponse = await makeRequest<{ result: string }>(
    'POST',
    '/openapi/v1/image-to-3d',
    {
      image_url: imageUrl,
      should_remesh: true,
      should_texture: true,
      enable_pbr: true,
      save_pre_remeshed_model: false,
    },
    apiKey
  );

  const taskId = createResponse.result;
  console.log(`[Meshy] Task created: ${taskId}`);

  // Poll for completion
  const result = await pollTaskStatus(taskId, 'v1', apiKey, job.id);

  if (!result.model_urls?.glb) {
    throw new Error('No GLB URL in Meshy response');
  }

  // Download GLB
  console.log(`[Meshy] Downloading GLB from: ${result.model_urls.glb}`);
  const glbBuffer = await downloadFile(result.model_urls.glb);

  // Upload to storage
  const uploadResult = await uploadGLB(glbBuffer, job.id!, s3Client, bucket);

  console.log(`[Meshy] Generated asset: ${uploadResult.assetId}`);

  return uploadResult;
}

/**
 * Check if Meshy API is configured
 */
export function isMeshyConfigured(): boolean {
  return !!getMeshyConfig();
}
