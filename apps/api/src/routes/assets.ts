import { Router, Request, Response } from 'express';
import Redis from 'ioredis';
import { AssetResponse, AssetFormat, createS3Client, getStorageConfig, generateDownloadUrl } from '@ai-3d-platform/shared';

export interface AssetStoreLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
}

export interface AssetsRouterDeps {
  assetStore?: AssetStoreLike;
  textureStore?: AssetStoreLike;
  signUrl?: (assetUrl: string) => Promise<string>;
}

const ASSET_PREFIX = 'asset:';

let defaultStore: AssetStoreLike | null = null;

function getDefaultAssetStore(): AssetStoreLike {
  if (defaultStore) {
    return defaultStore;
  }

  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  });

  defaultStore = redis;
  return defaultStore;
}

async function signAssetUrl(assetUrl: string): Promise<string> {
  const s3Client = createS3Client();
  const storageConfig = getStorageConfig();

  if (!s3Client || !storageConfig || !assetUrl.startsWith('s3://')) {
    return assetUrl;
  }

  const key = assetUrl.replace(`s3://${storageConfig.bucket}/`, '');
  return generateDownloadUrl(
    s3Client,
    storageConfig.bucket,
    key,
    3600
  );
}

export function createAssetsRouter(deps: AssetsRouterDeps = {}): Router {
  const router = Router();
  const assetStore = deps.assetStore || getDefaultAssetStore();
  const textureStore = deps.textureStore || assetStore;
  const signer = deps.signUrl || signAssetUrl;

  router.get('/:assetId', async (req: Request, res: Response) => {
    const { assetId } = req.params;
    const assetUrl = await assetStore.get(`${ASSET_PREFIX}${assetId}`);

    if (!assetUrl) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }

    const downloadUrl = await signer(assetUrl);
    const response: AssetResponse = {
      downloadUrl,
      format: AssetFormat.GLB,
    };

    res.json(response);
  });

  router.get('/:assetId/textures', async (req: Request, res: Response) => {
    const { assetId } = req.params;
    const texturesJson = await textureStore.get(`textures:${assetId}`);

    if (!texturesJson) {
      res.status(404).json({ error: 'Textures not found' });
      return;
    }

    res.json(JSON.parse(texturesJson));
  });

  router.get('/:assetId/preview', async (req: Request, res: Response) => {
    const { assetId } = req.params;
    const assetUrl = await assetStore.get(`${ASSET_PREFIX}${assetId}`);

    if (!assetUrl) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }

    const previewUrl = await signer(assetUrl);
    res.redirect(previewUrl);
  });

  return router;
}

export async function registerAsset(assetId: string, downloadUrl: string): Promise<void> {
  const store = getDefaultAssetStore();
  await store.set(`${ASSET_PREFIX}${assetId}`, downloadUrl);
}
