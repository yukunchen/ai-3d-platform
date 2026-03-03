import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, UserRole } from '@ai-3d-platform/shared';

// Augment Express Request with user property
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export interface AuthDeps {
  getUser: (userId: string) => Promise<User | null>;
  getApiKeyUser: (keyHash: string) => Promise<User | null>;
  jwtSecret: string;
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

export function createAuthMiddleware(deps: AuthDeps): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Try JWT first
    try {
      const payload = jwt.verify(token, deps.jwtSecret) as { sub: string; role: string };
      const user = await deps.getUser(payload.sub);
      if (user) {
        req.user = user;
        next();
        return;
      }
    } catch {
      // JWT failed, try API key
    }

    // Try API key: hash token and look up
    try {
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      const user = await deps.getApiKeyUser(hash);
      if (user) {
        req.user = user;
        next();
        return;
      }
    } catch {
      // API key lookup failed
    }

    res.status(401).json({ error: 'Invalid or expired token' });
  };
}

export function requireRole(role: UserRole): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (req.user.role !== role) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

export function optionalAuth(deps: AuthDeps): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const token = extractBearerToken(req);
    if (!token) {
      next();
      return;
    }

    // Try JWT
    try {
      const payload = jwt.verify(token, deps.jwtSecret) as { sub: string; role: string };
      const user = await deps.getUser(payload.sub);
      if (user) {
        req.user = user;
        next();
        return;
      }
    } catch {
      // JWT failed, try API key
    }

    // Try API key
    try {
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      const user = await deps.getApiKeyUser(hash);
      if (user) {
        req.user = user;
      }
    } catch {
      // Ignore
    }

    next();
  };
}

/** No-op middleware for backward compatibility when auth is not configured */
export const noopMiddleware: RequestHandler = (_req, _res, next) => next();
