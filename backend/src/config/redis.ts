import Redis from 'ioredis';
import logger from '../utils/logger';

class RedisClient {
  private client: Redis;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.client = new Redis(redisUrl);
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.client.on('connect', () => logger.info('Redis connected'));
    this.client.on('error', (error) => logger.error('Redis error', { error }));
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error('Redis GET error', { key, error });
      return null;
    }
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    try {
      await this.client.setex(key, seconds, value);
    } catch (error) {
      logger.error('Redis SETEX error', { key, seconds, error });
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error('Redis DEL error', { key, error });
    }
  }

  isReady(): boolean {
    return this.client.status === 'ready';
  }
}

const redisClient = new RedisClient();
export default redisClient;