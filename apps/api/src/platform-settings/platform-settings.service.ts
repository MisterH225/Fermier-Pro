import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_MARKETPLACE_COMMISSION_RATE = 0.05;
const CACHE_TTL_MS = 60_000;

@Injectable()
export class PlatformSettingsService {
  private cachedCommissionRate: number | null = null;
  private cachedAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  invalidateCache(): void {
    this.cachedCommissionRate = null;
    this.cachedAt = 0;
  }

  async getMarketplaceCommissionRate(): Promise<number> {
    const now = Date.now();
    if (
      this.cachedCommissionRate != null &&
      now - this.cachedAt < CACHE_TTL_MS
    ) {
      return this.cachedCommissionRate;
    }

    let row = await this.prisma.platformSettings.findUnique({
      where: { id: "default" },
      select: { marketplaceCommissionRate: true }
    });
    if (!row) {
      row = await this.prisma.platformSettings.create({
        data: { id: "default" },
        select: { marketplaceCommissionRate: true }
      });
    }

    const n = Number(row.marketplaceCommissionRate);
    const rate =
      Number.isFinite(n) && n >= 0 && n < 1
        ? n
        : DEFAULT_MARKETPLACE_COMMISSION_RATE;

    this.cachedCommissionRate = rate;
    this.cachedAt = now;
    return rate;
  }
}
