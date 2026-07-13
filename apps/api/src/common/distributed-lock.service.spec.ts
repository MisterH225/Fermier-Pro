import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import Redis from "ioredis";
import {
  DISTRIBUTED_LOCK_DEFAULT_TTL_MS,
  DistributedLockService
} from "./distributed-lock.service";

type RedisStore = Map<string, { value: string; expiresAt: number }>;

/** Mock ioredis minimal (SET NX PX + EVAL compare-and-delete). */
function createRedisMock(store: RedisStore) {
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue("OK"),
    disconnect: jest.fn(),
    set: jest.fn(
      async (
        key: string,
        value: string,
        pxToken?: string,
        ttlMs?: number,
        nxToken?: string
      ) => {
        if (pxToken !== "PX" || nxToken !== "NX" || ttlMs == null) {
          throw new Error("SET attendu avec PX ttl NX");
        }
        const now = Date.now();
        const existing = store.get(key);
        if (existing && existing.expiresAt > now) {
          return null;
        }
        store.set(key, { value, expiresAt: now + ttlMs });
        return "OK";
      }
    ),
    eval: jest.fn(async (_script: string, _n: number, key: string, token: string) => {
      const now = Date.now();
      const existing = store.get(key);
      if (!existing || existing.expiresAt <= now) {
        store.delete(key);
        return 0;
      }
      if (existing.value !== token) {
        return 0;
      }
      store.delete(key);
      return 1;
    })
  };
}

jest.mock("ioredis", () => {
  return jest.fn();
});

describe("DistributedLockService", () => {
  const envKeys = [
    "APP_ENV",
    "NODE_ENV",
    "REDIS_URL",
    "ALLOW_NO_REDIS_LOCKS"
  ] as const;
  const originals: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of envKeys) {
      originals[key] = process.env[key];
      delete process.env[key];
    }
    process.env.NODE_ENV = "test";
    jest.clearAllMocks();
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (originals[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originals[key];
      }
    }
  });

  async function createService(
    configValues: Record<string, string | undefined>
  ): Promise<DistributedLockService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DistributedLockService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => configValues[key]
          }
        }
      ]
    }).compile();
    const service = module.get(DistributedLockService);
    service.onModuleInit();
    return service;
  }

  describe("fallback sans REDIS_URL", () => {
    it("autorise le mode mémoire en non-production", async () => {
      process.env.APP_ENV = "development";
      const service = await createService({});
      await expect(service.tryAcquire("cron:test")).resolves.toBe(true);
      await service.release("cron:test");
    });

    it("throw en production sans ALLOW_NO_REDIS_LOCKS", async () => {
      process.env.APP_ENV = "production";
      await expect(createService({})).rejects.toThrow(/REDIS_URL manquant/);
    });

    it("autorise le mode mémoire en production si ALLOW_NO_REDIS_LOCKS=true", async () => {
      process.env.APP_ENV = "production";
      const service = await createService({
        ALLOW_NO_REDIS_LOCKS: "true"
      });
      await expect(service.tryAcquire("cron:mono")).resolves.toBe(true);
      await service.release("cron:mono");
    });
  });

  describe("mode mémoire (mono-instance)", () => {
    let service: DistributedLockService;

    beforeEach(async () => {
      process.env.APP_ENV = "development";
      service = await createService({});
    });

    it("refuse une acquisition concurrente (2e appel)", async () => {
      expect(await service.tryAcquire("cron:escrow")).toBe(true);
      expect(await service.tryAcquire("cron:escrow")).toBe(false);
    });

    it("expire après le TTL", async () => {
      jest.useFakeTimers();
      try {
        expect(await service.tryAcquire("cron:ttl", 1_000)).toBe(true);
        expect(await service.tryAcquire("cron:ttl", 1_000)).toBe(false);
        jest.advanceTimersByTime(1_001);
        expect(await service.tryAcquire("cron:ttl", 1_000)).toBe(true);
        await service.release("cron:ttl");
      } finally {
        jest.useRealTimers();
      }
    });

    it("withLock exécute fn puis libère", async () => {
      let ran = false;
      const ok = await service.withLock("cron:with", async () => {
        ran = true;
        expect(await service.tryAcquire("cron:with")).toBe(false);
      });
      expect(ok).toBe(true);
      expect(ran).toBe(true);
      expect(await service.tryAcquire("cron:with")).toBe(true);
      await service.release("cron:with");
    });

    it("withLock retourne false si verrou déjà pris", async () => {
      expect(await service.tryAcquire("cron:busy")).toBe(true);
      const ok = await service.withLock("cron:busy", async () => {
        throw new Error("ne doit pas s'exécuter");
      });
      expect(ok).toBe(false);
      await service.release("cron:busy");
    });

    it("withLock libère même si fn throw", async () => {
      await expect(
        service.withLock("cron:err", async () => {
          throw new Error("boom");
        })
      ).rejects.toThrow("boom");
      expect(await service.tryAcquire("cron:err")).toBe(true);
      await service.release("cron:err");
    });

    it("utilise le TTL par défaut (120s) si non précisé", async () => {
      jest.useFakeTimers();
      try {
        expect(await service.tryAcquire("cron:default-ttl")).toBe(true);
        jest.advanceTimersByTime(DISTRIBUTED_LOCK_DEFAULT_TTL_MS - 1);
        expect(await service.tryAcquire("cron:default-ttl")).toBe(false);
        jest.advanceTimersByTime(2);
        expect(await service.tryAcquire("cron:default-ttl")).toBe(true);
        await service.release("cron:default-ttl");
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe("mode Redis", () => {
    let store: RedisStore;
    let a: DistributedLockService;
    let b: DistributedLockService;

    beforeEach(async () => {
      process.env.APP_ENV = "development";
      store = new Map();
      (Redis as unknown as jest.Mock).mockImplementation(() =>
        createRedisMock(store)
      );
      a = await createService({ REDIS_URL: "redis://localhost:6379" });
      b = await createService({ REDIS_URL: "redis://localhost:6379" });
    });

    it("refuse une acquisition concurrente (2e appel)", async () => {
      expect(await a.tryAcquire("cron:escrow")).toBe(true);
      expect(await b.tryAcquire("cron:escrow")).toBe(false);
    });

    it("release ne supprime pas le verrou d'une autre instance", async () => {
      expect(await a.tryAcquire("cron:escrow")).toBe(true);
      await b.release("cron:escrow");
      expect(await b.tryAcquire("cron:escrow")).toBe(false);
      await a.release("cron:escrow");
      expect(await b.tryAcquire("cron:escrow")).toBe(true);
      await b.release("cron:escrow");
    });

    it("expire après le TTL", async () => {
      jest.useFakeTimers();
      try {
        expect(await a.tryAcquire("cron:ttl", 500)).toBe(true);
        expect(await b.tryAcquire("cron:ttl", 500)).toBe(false);
        jest.advanceTimersByTime(501);
        expect(await b.tryAcquire("cron:ttl", 500)).toBe(true);
        await b.release("cron:ttl");
      } finally {
        jest.useRealTimers();
      }
    });

    it("SET NX PX avec le TTL demandé", async () => {
      const mock = (Redis as unknown as jest.Mock).mock.results[0]
        .value as ReturnType<typeof createRedisMock>;
      await a.tryAcquire("cron:px", 42_000);
      expect(mock.set).toHaveBeenCalledWith(
        "lock:cron:px",
        expect.any(String),
        "PX",
        42_000,
        "NX"
      );
    });
  });
});
