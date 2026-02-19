import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StorageConfig {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  forcePathStyle?: boolean;
}

const DEFAULT_URL_EXPIRY = 3600; // 1 hour in seconds

/**
 * Create S3 client from environment variables
 */
export function createS3Client(): S3Client | null {
  const region = process.env.AWS_REGION || 'us-east-1';
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const endpoint = process.env.S3_ENDPOINT;
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';

  if (!bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    endpoint,
    forcePathStyle,
  });
}

/**
 * Get storage configuration from environment
 */
export function getStorageConfig(): StorageConfig | null {
  const region = process.env.AWS_REGION || 'us-east-1';
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const endpoint = process.env.S3_ENDPOINT;
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';

  if (!bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    endpoint,
    forcePathStyle,
  };
}

/**
 * Generate a signed URL for uploading a file to S3
 */
export async function generateUploadUrl(
  s3Client: S3Client,
  bucket: string,
  key: string,
  expiresIn: number = DEFAULT_URL_EXPIRY
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Generate a signed URL for downloading a file from S3
 */
export async function generateDownloadUrl(
  s3Client: S3Client,
  bucket: string,
  key: string,
  expiresIn: number = DEFAULT_URL_EXPIRY
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Upload a file buffer to S3
 */
export async function uploadToS3(
  s3Client: S3Client,
  bucket: string,
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await s3Client.send(command);

  // Return the S3 object URL
  return `s3://${bucket}/${key}`;
}
