import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_MARKETPLACE_COMMISSION_RATE = 0.05;
const CACHE_TTL_MS = 60_000;

export type SupportContactDto = {
  phone: string | null;
  telegramUrl: string | null;
};

@Injectable()
export class PlatformSettingsService {
  private cachedCommissionRate: number | null = null;
  private cachedAt = 0;
  private cachedSupport: SupportContactDto | null = null;
  private cachedSupportAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  invalidateCache(): void {
    this.cachedCommissionRate = null;
    this.cachedAt = 0;
    this.cachedSupport = null;
    this.cachedSupportAt = 0;
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

  async getSupportContact(): Promise<SupportContactDto> {
    const now = Date.now();
    if (
      this.cachedSupport != null &&
      now - this.cachedSupportAt < CACHE_TTL_MS
    ) {
      return this.cachedSupport;
    }

    let row = await this.prisma.platformSettings.findUnique({
      where: { id: "default" },
      select: { supportPhone: true, supportTelegramUrl: true }
    });
    if (!row) {
      row = await this.prisma.platformSettings.create({
        data: { id: "default" },
        select: { supportPhone: true, supportTelegramUrl: true }
      });
    }

    const phone =
      normalizePhone(row.supportPhone) ??
      normalizePhone(process.env.SUPPORT_PHONE) ??
      null;
    const telegramUrl =
      normalizeTelegramUrl(row.supportTelegramUrl) ??
      normalizeTelegramUrl(process.env.SUPPORT_TELEGRAM_URL) ??
      null;

    const contact = { phone, telegramUrl };
    this.cachedSupport = contact;
    this.cachedSupportAt = now;
    return contact;
  }
}

function normalizePhone(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }
  const digits = trimmed.replace(/[^\d+]/g, "");
  return digits.length >= 6 ? digits : null;
}

function normalizeTelegramUrl(
  raw: string | null | undefined
): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }
  if (/^tg:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith("@")) {
    const username = trimmed.slice(1).replace(/[^a-zA-Z0-9_]/g, "");
    return username ? `https://t.me/${username}` : null;
  }
  const username = trimmed.replace(/^t\.me\//i, "").replace(/[^a-zA-Z0-9_]/g, "");
  return username ? `https://t.me/${username}` : null;
}
