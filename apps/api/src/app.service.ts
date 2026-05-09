import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  health() {
    return {
      service: "fermier-api",
      status: "ok",
      version: "0.1.0"
    };
  }

  async healthWithDb() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      service: "fermier-api",
      status: "ok",
      database: "connected",
      version: "0.1.0"
    };
  }
}
