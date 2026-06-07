import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

const TTL_SECONDS = 3600;

@Injectable()
export class PigPriceIndexCacheService implements OnModuleDestroy {
  private readonly log = new Logger(PigPriceIndexCacheService.name);
  private readonly memory = new Map<string, { exp: number; value: string }>();
  private redis: Redis | null = null;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>("REDIS_URL")?.trim();
    if (url) {
      this.redis = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
      void this.redis.connect().catch((e) => {
        this.log.warn(`Redis indisponible — cache mémoire: ${(e as Error).message}`);
        this.redis = null;
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit();
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redis) {
      try {
        const raw = await this.redis.get(key);
        if (raw) {
          return JSON.parse(raw) as T;
        }
      } catch (e) {
        this.log.warn(`Redis get ${key}: ${(e as Error).message}`);
      }
    }
    const hit = this.memory.get(key);
    if (!hit || hit.exp < Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return JSON.parse(hit.value) as T;
  }

  async set(key: string, value: unknown): Promise<void> {
    const raw = JSON.stringify(value);
    if (this.redis) {
      try {
        await this.redis.setex(key, TTL_SECONDS, raw);
        return;
      } catch (e) {
        this.log.warn(`Redis set ${key}: ${(e as Error).message}`);
      }
    }
    this.memory.set(key, { exp: Date.now() + TTL_SECONDS * 1000, value: raw });
  }

  async invalidatePrefix(prefix: string): Promise<void> {
    if (this.redis) {
      try {
        const keys = await this.redis.keys(`${prefix}*`);
        if (keys.length) {
          await this.redis.del(...keys);
        }
      } catch (e) {
        this.log.warn(`Redis invalidate ${prefix}: ${(e as Error).message}`);
      }
    }
    for (const key of [...this.memory.keys()]) {
      if (key.startsWith(prefix)) {
        this.memory.delete(key);
      }
    }
  }
}
