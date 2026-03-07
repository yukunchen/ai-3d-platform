import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, AuthResponse, UserRole, AuthProvider } from '@ai-3d-platform/shared';
import { createAuthMiddleware, AuthDeps } from '../middleware/auth';

export interface AuthStoreLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
}

export interface AuthRouterDeps {
  authStore: AuthStoreLike;
  jwtSecret: string;
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function signToken(userId: string, role: UserRole, secret: string): string {
  return jwt.sign({ sub: userId, role }, secret, { expiresIn: '7d' });
}

export function createAuthRouter(deps: AuthRouterDeps): Router {
  const router = Router();
  const { authStore, jwtSecret } = deps;

  // Helper to get user by ID
  async function getUser(userId: string): Promise<User | null> {
    const json = await authStore.get(`user:${userId}`);
    return json ? JSON.parse(json) : null;
  }

  // Helper to get user by API key hash
  async function getApiKeyUser(keyHash: string): Promise<User | null> {
    const apiKeyJson = await authStore.get(`apikey:${keyHash}`);
    if (!apiKeyJson) return null;
    const apiKey = JSON.parse(apiKeyJson);
    return getUser(apiKey.userId);
  }

  const authDeps: AuthDeps = { getUser, getApiKeyUser, jwtSecret };
  const authenticate = createAuthMiddleware(authDeps);

  // POST /v1/auth/register
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const body = registerSchema.parse(req.body);

      // Check if email already exists
      const existingUserId = await authStore.get(`user:email:${body.email}`);
      if (existingUserId) {
        res.status(409).json({ error: 'Email already registered' });
        return;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(body.password, 12);

      // Create user
      const userId = crypto.randomUUID();
      const user: User = {
        id: userId,
        email: body.email,
        name: body.name,
        role: UserRole.User,
        authProvider: AuthProvider.Email,
        createdAt: Date.now(),
      };

      // Store user data
      await authStore.set(`user:${userId}`, JSON.stringify(user));
      await authStore.set(`user:email:${body.email}`, userId);
      await authStore.set(`user:password:${userId}`, passwordHash);

      // Generate JWT
      const token = signToken(userId, user.role, jwtSecret);
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

      const response: AuthResponse = { user, token, expiresAt };
      res.status(201).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      console.error('Error registering user:', error);
      res.status(500).json({ error: 'Failed to register user' });
    }
  });

  // POST /v1/auth/login
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const body = loginSchema.parse(req.body);

      // Look up user by email
      const userId = await authStore.get(`user:email:${body.email}`);
      if (!userId) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const userJson = await authStore.get(`user:${userId}`);
      const passwordHash = await authStore.get(`user:password:${userId}`);
      if (!userJson || !passwordHash) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      // Verify password
      const valid = await bcrypt.compare(body.password, passwordHash);
      if (!valid) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const user: User = JSON.parse(userJson);
      const token = signToken(user.id, user.role, jwtSecret);
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

      const response: AuthResponse = { user, token, expiresAt };
      res.json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
        return;
      }
      console.error('Error logging in:', error);
      res.status(500).json({ error: 'Failed to login' });
    }
  });

  // GET /v1/auth/me
  router.get('/me', authenticate, (req: Request, res: Response) => {
    res.json(req.user);
  });

  return router;
}

// Re-export helpers for use by api-keys router and app.ts
export type { AuthDeps };
