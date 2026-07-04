import { Logger, type OnApplicationShutdown } from "@nestjs/common";
import {
  ThrottlerStorageService,
  type ThrottlerStorage
} from "@nestjs/throttler";
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";

type ThrottlerIncrementResult = Awaited<
  ReturnType<ThrottlerStorageService["increment"]>
>;

/**
 * Stockage throttler Redis avec repli en mémoire si Redis est indisponible.
 * Évite les crashs ou erreurs silencieuses quand REDIS_URL est configuré mais Redis tombe.
 */
export class ResilientThrottlerStorage
  implements ThrottlerStorage, OnApplicationShutdown
{
  private readonly log = new Logger(ResilientThrottlerStorage.name);
  private readonly fallback = new ThrottlerStorageService();
  private useFallback = false;

  constructor(private readonly redis: ThrottlerStorageRedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string
  ): Promise<ThrottlerIncrementResult> {
    if (this.useFallback) {
      return this.fallback.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName
      );
    }
    try {
      return await this.redis.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName
      );
    } catch (err) {
      this.useFallback = true;
      const msg = err instanceof Error ? err.message : String(err);
      this.log.warn(
        `Redis throttler indisponible — bascule stockage en mémoire: ${msg}`
      );
      return this.fallback.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName
      );
    }
  }

  onApplicationShutdown(): void {
    this.fallback.onApplicationShutdown();
  }
}
