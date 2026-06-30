import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  health() {
    return {
      service: "fermier-api",
      status: "ok",
      version: "0.1.0",
      gitCommit:
        process.env.RAILWAY_GIT_COMMIT_SHA?.trim() ||
        process.env.GIT_COMMIT?.trim() ||
        null
    };
  }

  async healthWithDb() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      service: "fermier-api",
      status: "ok",
      database: "connected",
      version: "0.1.0",
      gitCommit:
        process.env.RAILWAY_GIT_COMMIT_SHA?.trim() ||
        process.env.GIT_COMMIT?.trim() ||
        null
    };
  }
}
