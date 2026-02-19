import { Router, Request, Response } from 'express';
import Redis from 'ioredis';
import { AssetResponse, AssetFormat, createS3Client, getStorageConfig, generateDownloadUrl } from '@ai-3d-platform/shared';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

const ASSET_PREFIX = 'asset:';

// Initialize S3 client
const s3Client = createS3Client();
const storageConfig = getStorageConfig();

export function createAssetsRouter(): Router {
  const router = Router();

  // GET /v1/assets/:assetId
  router.get('/:assetId', async (req: Request, res: Response) => {
    const { assetId } = req.params;
    const assetUrl = await redis.get(`${ASSET_PREFIX}${assetId}`);

    if (!assetUrl) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }

    let downloadUrl = assetUrl;

    // If S3 is configured, generate a signed URL
    if (s3Client && storageConfig && assetUrl.startsWith('s3://')) {
      const key = assetUrl.replace(`s3://${storageConfig.bucket}/`, '');
      downloadUrl = await generateDownloadUrl(
        s3Client,
        storageConfig.bucket,
        key,
        3600 // 1 hour expiry
      );
    }

    const response: AssetResponse = {
      downloadUrl,
      format: AssetFormat.GLB,
    };

    res.json(response);
  });

  // GET /v1/assets/:assetId/preview
  router.get('/:assetId/preview', async (req: Request, res: Response) => {
    const { assetId } = req.params;
    const assetUrl = await redis.get(`${ASSET_PREFIX}${assetId}`);

    if (!assetUrl) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }

    // If S3 is configured, generate a signed URL
    let previewUrl = assetUrl;
    if (s3Client && storageConfig && assetUrl.startsWith('s3://')) {
      const key = assetUrl.replace(`s3://${storageConfig.bucket}/`, '');
      previewUrl = await generateDownloadUrl(
        s3Client,
        storageConfig.bucket,
        key,
        3600 // 1 hour expiry
      );
    }

    // Redirect to the preview resource
    res.redirect(previewUrl);
  });

  return router;
}

// Helper function to register an asset (called by worker)
export async function registerAsset(assetId: string, downloadUrl: string): Promise<void> {
  await redis.set(`${ASSET_PREFIX}${assetId}`, downloadUrl);
}
