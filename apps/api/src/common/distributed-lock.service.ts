import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import Redis from "ioredis";
import { isDeploymentProduction } from "../marketplace/escrow/runtime-env.util";

/** TTL par défaut des verrous Redis (ms). */
export const DISTRIBUTED_LOCK_DEFAULT_TTL_MS = 120_000;

const LOCK_KEY_PREFIX = "lock:";

/**
 * Script Lua compare-and-delete : ne supprime la clé que si la valeur
 * correspond au jeton de cette instance (évite de libérer le verrou d'un autre process).
 */
const RELEASE_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

type MemoryLock = { value: string; expiresAt: number };

/**
 * Verrou distribué Redis (SET NX PX + release Lua).
 *
 * Remplace les advisory locks Postgres, incompatibles avec le pooler
 * transactionnel Supabase (port 6543) : chaque requête Prisma peut changer
 * de connexion serveur, donc lock/unlock n'étaient pas fiables.
 *
 * Fallback sans REDIS_URL :
 * - production : erreur fatale au boot, sauf ALLOW_NO_REDIS_LOCKS=true
 *   (déploiement mono-instance explicite) → Map en mémoire + warn
 * - dev/local/test : Map en mémoire + warn
 */
@Injectable()
export class DistributedLockService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(DistributedLockService.name);
  /** Jeton unique à cette instance process (valeur stockée dans Redis). */
  private readonly instanceToken = randomUUID();
  private redis: Redis | null = null;
  private readonly memoryLocks = new Map<string, MemoryLock>();
  private usingMemoryFallback = false;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>("REDIS_URL")?.trim();
    if (url) {
      // Même options que pig-price-index-cache / usage Redis API
      this.redis = new Redis(url, {
        maxRetriesPerRequest: 1,
        lazyConnect: true
      });
    } else {
      this.usingMemoryFallback = true;
    }
  }

  onModuleInit(): void {
    if (!this.usingMemoryFallback) {
      void this.redis!.connect().catch((e) => {
        this.log.error(
          `Connexion Redis (verrous distribués) échouée: ${(e as Error).message}`
        );
      });
      return;
    }

    const allowNoRedis =
      (this.config.get<string>("ALLOW_NO_REDIS_LOCKS") ?? "").trim() === "true";

    if (isDeploymentProduction()) {
      if (!allowNoRedis) {
        this.log.error(
          "REDIS_URL est obligatoire en production pour DistributedLockService " +
            "(crons financiers multi-instances). Définir REDIS_URL, ou " +
            "ALLOW_NO_REDIS_LOCKS=true uniquement pour un déploiement mono-instance."
        );
        throw new Error(
          "REDIS_URL manquant : verrous distribués indisponibles en production. " +
            "Définir REDIS_URL ou ALLOW_NO_REDIS_LOCKS=true (mono-instance)."
        );
      }
      this.log.warn(
        "ALLOW_NO_REDIS_LOCKS=true — verrous in-memory (mono-instance uniquement). " +
          "Ne pas utiliser avec plusieurs replicas."
      );
      return;
    }

    this.log.warn(
      "REDIS_URL absent — verrous in-memory (dev/local). " +
        "Non sûr pour plusieurs instances."
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        this.redis.disconnect();
      }
      this.redis = null;
    }
  }

  /**
   * Tente d'acquérir un verrou nommé. Retourne true si acquis.
   * @param ttlMs durée de vie du verrou (défaut 120_000 ms)
   */
  async tryAcquire(
    lockKey: string,
    ttlMs: number = DISTRIBUTED_LOCK_DEFAULT_TTL_MS
  ): Promise<boolean> {
    const redisKey = LOCK_KEY_PREFIX + lockKey;
    const ttl = ttlMs > 0 ? ttlMs : DISTRIBUTED_LOCK_DEFAULT_TTL_MS;

    if (this.redis && !this.usingMemoryFallback) {
      try {
        const result = await this.redis.set(
          redisKey,
          this.instanceToken,
          "PX",
          ttl,
          "NX"
        );
        const acquired = result === "OK";
        if (!acquired) {
          this.log.debug(`Verrou occupé — skip: ${lockKey}`);
        }
        return acquired;
      } catch (e) {
        this.log.error(
          `Échec tryAcquire Redis (${lockKey}): ${(e as Error).message}`
        );
        return false;
      }
    }

    return this.tryAcquireMemory(redisKey, ttl);
  }

  async release(lockKey: string): Promise<void> {
    const redisKey = LOCK_KEY_PREFIX + lockKey;

    if (this.redis && !this.usingMemoryFallback) {
      try {
        await this.redis.eval(RELEASE_LUA, 1, redisKey, this.instanceToken);
      } catch (e) {
        this.log.error(
          `Échec release Redis (${lockKey}): ${(e as Error).message}`
        );
      }
      return;
    }

    this.releaseMemory(redisKey);
  }

  /**
   * Exécute fn uniquement si le verrou est acquis ; libère en finally.
   */
  async withLock(
    lockKey: string,
    fn: () => Promise<void>,
    ttlMs: number = DISTRIBUTED_LOCK_DEFAULT_TTL_MS
  ): Promise<boolean> {
    const acquired = await this.tryAcquire(lockKey, ttlMs);
    if (!acquired) {
      return false;
    }
    try {
      await fn();
      return true;
    } finally {
      await this.release(lockKey);
    }
  }

  private tryAcquireMemory(redisKey: string, ttlMs: number): boolean {
    this.purgeExpiredMemory(redisKey);
    if (this.memoryLocks.has(redisKey)) {
      this.log.debug(`Verrou occupé — skip: ${redisKey}`);
      return false;
    }
    this.memoryLocks.set(redisKey, {
      value: this.instanceToken,
      expiresAt: Date.now() + ttlMs
    });
    return true;
  }

  private releaseMemory(redisKey: string): void {
    const current = this.memoryLocks.get(redisKey);
    if (!current) return;
    if (current.value !== this.instanceToken) return;
    this.memoryLocks.delete(redisKey);
  }

  private purgeExpiredMemory(redisKey: string): void {
    const current = this.memoryLocks.get(redisKey);
    if (current && current.expiresAt <= Date.now()) {
      this.memoryLocks.delete(redisKey);
    }
  }
}
