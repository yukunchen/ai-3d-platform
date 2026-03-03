import { Router, Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { ApiKey } from '@ai-3d-platform/shared';

export interface ApiKeyStoreLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  del?(key: string): Promise<unknown>;
}

export interface ApiKeysRouterDeps {
  apiKeyStore: ApiKeyStoreLike;
  authenticate: RequestHandler;
}

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
});

export function createApiKeysRouter(deps: ApiKeysRouterDeps): Router {
  const router = Router();
  const { apiKeyStore, authenticate } = deps;

  // All routes require auth
  router.use(authenticate);

  // POST /v1/api-keys
  router.post('/', async (req: Request, res: Response) => {
    try {
      const body = createKeySchema.parse(req.body);
      const userId = req.user!.id;

      // Generate raw key
      const rawKey = crypto.randomBytes(32).toString('hex');
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
      const keyId = crypto.randomUUID();

      const apiKey: ApiKey = {
        id: keyId,
        key: keyHash, // Store hash, not raw key
        userId,
        name: body.name,
        createdAt: Date.now(),
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
      };

      // Store API key by hash (for lookup during auth)
      await apiKeyStore.set(`apikey:${keyHash}`, JSON.stringify(apiKey));

      // Store key ID in user's key set
      const keysJson = await apiKeyStore.get(`user:${userId}:apikeys`);
      const keys: string[] = keysJson ? JSON.parse(keysJson) : [];
      keys.push(keyId);
      await apiKeyStore.set(`user:${userId}:apikeys`, JSON.stringify(keys));

      // Store key metadata by ID (for listing/deletion)
      await apiKeyStore.set(`apikey:id:${keyId}`, JSON.stringify(apiKey));

      // Return raw key only once
      res.status(201).json({
        id: keyId,
        key: rawKey,
        name: body.name,
        createdAt: apiKey.createdAt,
        expiresAt: apiKey.expiresAt,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      console.error('Error creating API key:', error);
      res.status(500).json({ error: 'Failed to create API key' });
    }
  });

  // GET /v1/api-keys
  router.get('/', async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const keysJson = await apiKeyStore.get(`user:${userId}:apikeys`);
      const keyIds: string[] = keysJson ? JSON.parse(keysJson) : [];

      const keys: Array<Omit<ApiKey, 'key'>> = [];
      for (const keyId of keyIds) {
        const keyJson = await apiKeyStore.get(`apikey:id:${keyId}`);
        if (keyJson) {
          const apiKey: ApiKey = JSON.parse(keyJson);
          // Never return the hash
          const { key: _hash, ...rest } = apiKey;
          keys.push(rest);
        }
      }

      res.json(keys);
    } catch (error) {
      console.error('Error listing API keys:', error);
      res.status(500).json({ error: 'Failed to list API keys' });
    }
  });

  // DELETE /v1/api-keys/:keyId
  router.delete('/:keyId', async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { keyId } = req.params;

      // Verify key belongs to user
      const keyJson = await apiKeyStore.get(`apikey:id:${keyId}`);
      if (!keyJson) {
        res.status(404).json({ error: 'API key not found' });
        return;
      }

      const apiKey: ApiKey = JSON.parse(keyJson);
      if (apiKey.userId !== userId) {
        res.status(404).json({ error: 'API key not found' });
        return;
      }

      // Remove from hash lookup
      if (deps.apiKeyStore.del) {
        await deps.apiKeyStore.del(`apikey:${apiKey.key}`);
        await deps.apiKeyStore.del(`apikey:id:${keyId}`);
      } else {
        // For mock stores without del, set to empty
        await apiKeyStore.set(`apikey:${apiKey.key}`, '');
        await apiKeyStore.set(`apikey:id:${keyId}`, '');
      }

      // Remove from user's key list
      const keysJson = await apiKeyStore.get(`user:${userId}:apikeys`);
      const keyIds: string[] = keysJson ? JSON.parse(keysJson) : [];
      const updated = keyIds.filter((id) => id !== keyId);
      await apiKeyStore.set(`user:${userId}:apikeys`, JSON.stringify(updated));

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting API key:', error);
      res.status(500).json({ error: 'Failed to delete API key' });
    }
  });

  return router;
}
