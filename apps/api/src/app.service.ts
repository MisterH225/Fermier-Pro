import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { getPhoneAuthReadiness } from "./auth/sms/phone-auth-config";
import { PrismaService } from "./prisma/prisma.service";

const APP_VERSION = "0.1.0";

export type HealthCheckResult = {
  status: "ok" | "degraded" | "error";
  db: "ok" | "error";
  redis: "ok" | "error" | "skipped";
  version: string;
  service: string;
  gitCommit: string | null;
  phoneAuth: ReturnType<typeof getPhoneAuthReadiness>;
};

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  /**
   * Healthcheck public pour uptime monitors externes.
   * Vérifie Prisma (`SELECT 1`) et Redis si REDIS_URL est configuré.
   */
  async health(): Promise<HealthCheckResult> {
    let db: "ok" | "error" = "ok";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = "error";
    }

    const redis = await this.checkRedis();

    let status: HealthCheckResult["status"] = "ok";
    if (db === "error") {
      status = "error";
    } else if (redis === "error") {
      status = "degraded";
    }

    return {
      status,
      db,
      redis,
      version: APP_VERSION,
      service: "fermier-api",
      gitCommit:
        process.env.RAILWAY_GIT_COMMIT_SHA?.trim() ||
        process.env.GIT_COMMIT?.trim() ||
        null,
      phoneAuth: getPhoneAuthReadiness()
    };
  }

  async healthWithDb() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      service: "fermier-api",
      status: "ok",
      database: "connected",
      version: APP_VERSION,
      gitCommit:
        process.env.RAILWAY_GIT_COMMIT_SHA?.trim() ||
        process.env.GIT_COMMIT?.trim() ||
        null
    };
  }

  private async checkRedis(): Promise<"ok" | "error" | "skipped"> {
    const redisUrl = this.config.get<string>("REDIS_URL")?.trim();
    if (!redisUrl) {
      return "skipped";
    }
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
      lazyConnect: true,
      enableOfflineQueue: false
    });
    try {
      await client.connect();
      const pong = await client.ping();
      return pong === "PONG" ? "ok" : "error";
    } catch {
      return "error";
    } finally {
      try {
        client.disconnect();
      } catch {
        /* ignore */
      }
    }
  }
}
