import * as https from 'https';
import * as http from 'http';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';
import { S3Client } from '@aws-sdk/client-s3';
import { Job } from 'bullmq';
import { JobData } from '@ai-3d-platform/shared';
import { uploadToS3 } from '@ai-3d-platform/shared';
import { ProviderAdapter, ProviderContext, ProviderResult } from './provider';

const HUNYUAN_HOST = process.env.HUNYUAN_HOST || 'ai3d.tencentcloudapi.com';
const HUNYUAN_SERVICE = process.env.HUNYUAN_SERVICE || 'ai3d';
const HUNYUAN_VERSION = process.env.HUNYUAN_VERSION || '2025-05-13';

const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_MAX_POLL_ATTEMPTS = 200; // ~10 minutes
const DEFAULT_MAX_INPUT_IMAGE_BYTES = 6 * 1024 * 1024;

type HunyuanMode = 'rapid' | 'pro';
type HunyuanImageInputMode = 'url' | 'base64' | 'auto';

interface HunyuanConfig {
  secretId: string;
  secretKey: string;
  region: string;
  mode: HunyuanMode;
  model?: string;
  resultFormat?: string;
  enablePbr?: boolean;
  enableGeometry?: boolean;
  faceCount?: number;
  generateType?: string;
  polygonType?: string;
  pollIntervalMs: number;
  maxPollAttempts: number;
  imageInputMode: HunyuanImageInputMode;
  maxInputImageBytes: number;
}

interface HunyuanSubmitResponse {
  Response: {
    JobId: string;
    RequestId: string;
    Error?: { Code: string; Message: string };
  };
}

interface HunyuanFile3D {
  Type?: string;
  Url?: string;
  PreviewImageUrl?: string;
}

interface HunyuanQueryResponse {
  Response: {
    Status: 'WAIT' | 'RUN' | 'FAIL' | 'DONE';
    ErrorCode?: string;
    ErrorMessage?: string;
    ResultFile3Ds?: HunyuanFile3D[];
    RequestId: string;
    Error?: { Code: string; Message: string };
  };
}

export function buildHunyuanSubmitPayload(
  jobData: JobData,
  options: {
    mode: HunyuanMode;
    model?: string;
    resultFormat?: string;
    enablePbr?: boolean;
    enableGeometry?: boolean;
    faceCount?: number;
    generateType?: string;
    polygonType?: string;
    imageBase64?: string;
  }
): { action: 'SubmitHunyuanTo3DRapidJob' | 'SubmitHunyuanTo3DProJob'; payload: Record<string, unknown> } {
  const isImage = jobData.type === 'image';
  const isMultiView = jobData.type === 'multiview';

  if (options.mode === 'rapid') {
    if (isMultiView) {
      throw new Error('Hunyuan rapid mode does not support multiview input; use HUNYUAN_MODE=pro');
    }
    const payload: Record<string, unknown> = {};
    if (isImage) {
      if (options.imageBase64) {
        payload.ImageBase64 = options.imageBase64;
      } else if (jobData.imageUrl) {
        payload.ImageUrl = jobData.imageUrl;
      } else {
        throw new Error('Image URL is required for image-to-3D generation');
      }
    } else {
      payload.Prompt = jobData.prompt;
    }
    if (options.resultFormat) payload.ResultFormat = options.resultFormat;
    if (typeof options.enablePbr === 'boolean') payload.EnablePBR = options.enablePbr;
    if (typeof options.enableGeometry === 'boolean') payload.EnableGeometry = options.enableGeometry;
    return { action: 'SubmitHunyuanTo3DRapidJob', payload };
  }

  const payload: Record<string, unknown> = { Model: options.model || '3.0' };
  if (isMultiView) {
    const viewImages = jobData.viewImages;
    if (!viewImages?.front || !viewImages?.left || !viewImages?.right) {
      throw new Error('front/left/right images are required for multiview-to-3D generation');
    }
    payload.ImageUrl = viewImages.front;
    payload.MultiViewImages = [
      { ViewType: 'left', ViewImageUrl: viewImages.left },
      { ViewType: 'right', ViewImageUrl: viewImages.right },
    ];
  } else if (isImage) {
    if (options.imageBase64) {
      payload.ImageBase64 = options.imageBase64;
    } else if (jobData.imageUrl) {
      payload.ImageUrl = jobData.imageUrl;
    } else {
      throw new Error('Image URL is required for image-to-3D generation');
    }
  } else {
    payload.Prompt = jobData.prompt;
  }
  if (typeof options.enablePbr === 'boolean') payload.EnablePBR = options.enablePbr;
  if (typeof options.faceCount === 'number') payload.FaceCount = options.faceCount;
  if (options.generateType) payload.GenerateType = options.generateType;
  if (options.polygonType) payload.PolygonType = options.polygonType;
  return { action: 'SubmitHunyuanTo3DProJob', payload };
}

function getConfig(): HunyuanConfig | null {
  const secretId = process.env.TENCENTCLOUD_SECRET_ID;
  const secretKey = process.env.TENCENTCLOUD_SECRET_KEY;
  if (!secretId || !secretKey) {
    return null;
  }

  const region = process.env.TENCENTCLOUD_REGION || 'ap-guangzhou';
  const mode = (process.env.HUNYUAN_MODE || 'rapid').toLowerCase() as HunyuanMode;
  const imageInputMode = (process.env.HUNYUAN_IMAGE_INPUT_MODE || 'auto').toLowerCase() as HunyuanImageInputMode;

  return {
    secretId,
    secretKey,
    region,
    mode: mode === 'pro' ? 'pro' : 'rapid',
    model: process.env.HUNYUAN_MODEL || '3.0',
    resultFormat: process.env.HUNYUAN_RESULT_FORMAT || 'GLB',
    enablePbr: process.env.HUNYUAN_ENABLE_PBR === 'true',
    enableGeometry: process.env.HUNYUAN_ENABLE_GEOMETRY === 'true',
    faceCount: process.env.HUNYUAN_FACE_COUNT ? parseInt(process.env.HUNYUAN_FACE_COUNT) : undefined,
    generateType: process.env.HUNYUAN_GENERATE_TYPE,
    polygonType: process.env.HUNYUAN_POLYGON_TYPE,
    pollIntervalMs: process.env.HUNYUAN_POLL_INTERVAL_MS
      ? parseInt(process.env.HUNYUAN_POLL_INTERVAL_MS)
      : DEFAULT_POLL_INTERVAL_MS,
    maxPollAttempts: process.env.HUNYUAN_MAX_POLL_ATTEMPTS
      ? parseInt(process.env.HUNYUAN_MAX_POLL_ATTEMPTS)
      : DEFAULT_MAX_POLL_ATTEMPTS,
    imageInputMode: imageInputMode === 'base64' || imageInputMode === 'url' ? imageInputMode : 'auto',
    maxInputImageBytes: process.env.HUNYUAN_MAX_INPUT_IMAGE_BYTES
      ? parseInt(process.env.HUNYUAN_MAX_INPUT_IMAGE_BYTES)
      : DEFAULT_MAX_INPUT_IMAGE_BYTES,
  };
}

function sha256(message: string, encoding: crypto.BinaryToTextEncoding = 'hex'): string {
  return crypto.createHash('sha256').update(message).digest(encoding);
}

function hmacSha256(key: Buffer | string, msg: string, encoding?: crypto.BinaryToTextEncoding) {
  const hmac = crypto.createHmac('sha256', key).update(msg);
  return encoding ? hmac.digest(encoding) : hmac.digest();
}

function getDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function tc3Request<T>(action: string, payload: object, config: HunyuanConfig): Promise<T> {
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await tc3RequestOnce<T>(action, payload, config);
    } catch (error) {
      lastError = error;
      const code = error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined;
      const retryable = code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'EAI_AGAIN';
      if (!retryable || attempt === maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }

  throw lastError;
}

async function tc3RequestOnce<T>(action: string, payload: object, config: HunyuanConfig): Promise<T> {
  const timestamp = Math.floor(Date.now() / 1000);
  const date = getDate(timestamp);

  const canonicalUri = '/';
  const canonicalQuerystring = '';
  const contentType = 'application/json; charset=utf-8';
  const canonicalHeaders = `content-type:${contentType}\nhost:${HUNYUAN_HOST}\n`;
  const signedHeaders = 'content-type;host';
  const payloadString = JSON.stringify(payload);
  const hashedRequestPayload = sha256(payloadString);

  const canonicalRequest = [
    'POST',
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    hashedRequestPayload,
  ].join('\n');

  const credentialScope = `${date}/${HUNYUAN_SERVICE}/tc3_request`;
  const stringToSign = [
    'TC3-HMAC-SHA256',
    timestamp.toString(),
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n');

  const secretDate = hmacSha256(`TC3${config.secretKey}`, date) as Buffer;
  const secretService = hmacSha256(secretDate, HUNYUAN_SERVICE) as Buffer;
  const secretSigning = hmacSha256(secretService, 'tc3_request') as Buffer;
  const signature = hmacSha256(secretSigning, stringToSign, 'hex') as string;

  const authorization =
    `TC3-HMAC-SHA256 Credential=${config.secretId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const options: https.RequestOptions = {
    hostname: HUNYUAN_HOST,
    method: 'POST',
    path: '/',
    headers: {
      Authorization: authorization,
      'Content-Type': contentType,
      Host: HUNYUAN_HOST,
      'X-TC-Action': action,
      'X-TC-Version': HUNYUAN_VERSION,
      'X-TC-Timestamp': timestamp.toString(),
      'X-TC-Region': config.region,
    },
  };

  return await new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed as T);
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.write(payloadString);
    req.end();
  });
}

async function submitJob(
  job: Job<JobData, ProviderResult>,
  config: HunyuanConfig,
  options: { useImageBase64?: boolean } = {}
): Promise<string> {
  let imageBase64: string | undefined;
  if (options.useImageBase64 && job.data.type === 'image') {
    if (!job.data.imageUrl) {
      throw new Error('Image URL is required for image-to-3D generation');
    }
    imageBase64 = await imageUrlToBase64(job.data.imageUrl, config.maxInputImageBytes);
  }

  const { action, payload } = buildHunyuanSubmitPayload(job.data, {
    mode: config.mode,
    model: config.model,
    resultFormat: config.resultFormat,
    enablePbr: config.enablePbr,
    enableGeometry: config.enableGeometry,
    faceCount: config.faceCount,
    generateType: config.generateType,
    polygonType: config.polygonType,
    imageBase64,
  });

  const response = await tc3Request<HunyuanSubmitResponse>(action, payload, config);
  if (response.Response.Error) {
    throw new Error(`${response.Response.Error.Code}: ${response.Response.Error.Message}`);
  }
  return response.Response.JobId;
}

async function pollJob(jobId: string, config: HunyuanConfig): Promise<HunyuanQueryResponse> {
  const action = config.mode === 'pro' ? 'QueryHunyuanTo3DProJob' : 'QueryHunyuanTo3DRapidJob';

  let attempts = 0;
  while (attempts < config.maxPollAttempts) {
    const response = await tc3Request<HunyuanQueryResponse>(action, { JobId: jobId }, config);
    if (response.Response.Error) {
      return {
        Response: {
          Status: 'FAIL',
          ErrorCode: response.Response.Error.Code,
          ErrorMessage: `${response.Response.Error.Code}: ${response.Response.Error.Message}`,
          RequestId: response.Response.RequestId,
        },
      };
    }
    if (response.Response.Status === 'DONE' || response.Response.Status === 'FAIL') {
      return response;
    }
    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
    attempts++;
  }

  throw new Error(`Hunyuan job polling timeout after ${config.maxPollAttempts} attempts`);
}

async function downloadFile(urlString: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const protocol = url.protocol === 'https:' ? https : http;

    const req = protocol.request(
      {
        hostname: url.hostname,
        port: url.protocol === 'https:' ? 443 : 80,
        path: url.pathname + url.search,
        method: 'GET',
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          downloadFile(res.headers.location).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Failed to download file: HTTP ${res.statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function imageUrlToBase64(imageUrl: string, maxBytes: number): Promise<string> {
  const buffer = await downloadFile(imageUrl);
  if (buffer.length === 0) {
    throw new Error('Image download returned empty body');
  }
  if (buffer.length > maxBytes) {
    throw new Error(`Image is too large for Hunyuan base64 input (${buffer.length} bytes > ${maxBytes} bytes)`);
  }
  return buffer.toString('base64');
}

function shouldRetryWithBase64(
  jobData: JobData,
  response: HunyuanQueryResponse,
  config: HunyuanConfig,
  usedBase64: boolean
): boolean {
  if (usedBase64 || config.imageInputMode !== 'auto' || jobData.type !== 'image' || !jobData.imageUrl) {
    return false;
  }
  const code = response.Response.ErrorCode || '';
  const message = response.Response.ErrorMessage || '';
  return code.includes('DownloadError') || message.includes('DownloadError');
}

async function uploadResultFile(
  buffer: Buffer,
  extension: string,
  jobId: string,
  s3Client: S3Client | null,
  bucket: string | undefined
): Promise<ProviderResult> {
  const assetId = `asset-${jobId}.${extension}`;
  let assetUrl: string;

  if (s3Client && bucket) {
    const s3Key = `assets/${assetId}`;
    await uploadToS3(s3Client, bucket, s3Key, buffer, 'application/octet-stream');
    assetUrl = `s3://${bucket}/${s3Key}`;
  } else {
    const storageDir = path.join(process.cwd(), '..', 'api', 'storage');
    await fs.promises.mkdir(storageDir, { recursive: true });
    const filePath = path.join(storageDir, assetId);
    await fs.promises.writeFile(filePath, buffer);
    assetUrl = `/storage/${assetId}`;
  }

  return { assetId, assetUrl };
}

function pickResultFile(files: HunyuanFile3D[] | undefined): { url: string; type: string } {
  if (!files || files.length === 0) {
    throw new Error('No result files returned from Hunyuan');
  }
  const glb = files.find((f) => f.Type?.toLowerCase() === 'glb' && f.Url);
  const chosen = glb || files.find((f) => f.Url) || files[0];
  if (!chosen.Url) {
    throw new Error('Result file URL is missing');
  }
  const type = (chosen.Type || 'glb').toLowerCase();
  return { url: chosen.Url, type };
}

async function generate(job: Job<JobData, ProviderResult>, ctx: ProviderContext): Promise<ProviderResult> {
  const config = getConfig();
  if (!config) {
    throw new Error('Hunyuan credentials are not configured');
  }

  if (job.data.textureOptions) {
    console.warn('[Hunyuan] textureOptions are not supported by Hunyuan provider; ignoring');
  }

  const t0 = Date.now();
  const tag = `[Hunyuan][${job.id}]`;

  let useImageBase64 = config.imageInputMode === 'base64';
  let jobId = await submitJob(job, config, { useImageBase64 });
  console.log(`${tag} submitted hunyuanJobId=${jobId} +${Date.now() - t0}ms`);

  let t1 = Date.now();
  let result = await pollJob(jobId, config);
  console.log(`${tag} poll done status=${result.Response.Status} +${Date.now() - t1}ms`);

  if (result.Response.Status === 'FAIL' && shouldRetryWithBase64(job.data, result, config, useImageBase64)) {
    console.warn(`${tag} URL download failed, retrying with ImageBase64`);
    useImageBase64 = true;
    jobId = await submitJob(job, config, { useImageBase64 });
    t1 = Date.now();
    result = await pollJob(jobId, config);
    console.log(`${tag} retry poll done status=${result.Response.Status} +${Date.now() - t1}ms`);
  }

  if (result.Response.Status === 'FAIL') {
    throw new Error(result.Response.ErrorMessage || 'Hunyuan job failed');
  }

  const { url, type } = pickResultFile(result.Response.ResultFile3Ds);
  const t2 = Date.now();
  const buffer = await downloadFile(url);
  console.log(`${tag} download done size=${buffer.length}bytes +${Date.now() - t2}ms`);

  const t3 = Date.now();
  const extension = type || 'glb';
  const uploadResult = await uploadResultFile(buffer, extension, job.id!, ctx.s3Client, ctx.bucket);
  console.log(`${tag} upload done +${Date.now() - t3}ms | total +${Date.now() - t0}ms`);

  return uploadResult;
}

export function createHunyuanProvider(): ProviderAdapter {
  return {
    name: 'hunyuan',
    isConfigured: () => !!getConfig(),
    generateFromText: (job, ctx) => generate(job, ctx),
    generateFromImage: (job, ctx) => generate(job, ctx),
    generateFromMultiView: (job, ctx) => generate(job, ctx),
  };
}
