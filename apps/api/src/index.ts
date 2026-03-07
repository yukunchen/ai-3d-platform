import Redis from 'ioredis';
import { createQueue } from './queue';
import { createApp } from './app';

const PORT = parseInt(process.env.PORT || '3001', 10);
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

async function main() {
  // Create Redis client for auth store
  const redisClient = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
  });

  console.log(`Connected to Redis at ${REDIS_HOST}:${REDIS_PORT}`);

  // Create auth store using Redis
  const authStore = {
    get: async (key: string) => {
      return await redisClient.get(key);
    },
    set: async (key: string, value: string) => {
      await redisClient.set(key, value);
    },
  };

  const queue = createQueue();
  const app = createApp(queue, {
    auth: {
      authStore,
      jwtSecret: JWT_SECRET,
    },
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`API server running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export { createApp, createQueue };
