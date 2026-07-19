import { Injectable } from "@nestjs/common";
import { Prisma, type PlatformSettings } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeWeightArbitrationThresholds } from "../marketplace/escrow/weight-arbitration.util";

const DEFAULT_MARKETPLACE_COMMISSION_RATE = 0.015;
const DEFAULT_SELLER_COMMISSION_RATE = 0.015;
const DEFAULT_VET_COMMISSION_RATE = 0.015;
const CACHE_TTL_MS = 60_000;
const DEFAULT_SETTINGS_ID = "default";

export type WeightArbitrationSettingsDto = {
  minDiffKg: number;
  cumulativeMinDiffKg: number;
  tolerancePercent: number;
};

export type SupportContactDto = {
  phone: string | null;
  telegramUrl: string | null;
};

/** Réponse admin : valeurs DB éditables + coordonnées effectives servies au mobile. */
export type PlatformSettingsAdminDto = PlatformSettings & {
  supportEffective: SupportContactDto;
};

@Injectable()
export class PlatformSettingsService {
  private cachedCommissionRate: number | null = null;
  private cachedAt = 0;
  private cachedSellerCommissionRate: number | null = null;
  private cachedSellerAt = 0;
  private cachedVetCommissionRate: number | null = null;
  private cachedVetAt = 0;
  private cachedSupport: SupportContactDto | null = null;
  private cachedSupportAt = 0;
  private cachedWeightArbitration: WeightArbitrationSettingsDto | null = null;
  private cachedWeightArbitrationAt = 0;
  /** Coalesce les upserts concurrents (ex. Promise.all sur GET /config/client). */
  private ensureDefaultRowInflight: Promise<PlatformSettings> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  invalidateCache(): void {
    this.cachedCommissionRate = null;
    this.cachedAt = 0;
    this.cachedSellerCommissionRate = null;
    this.cachedSellerAt = 0;
    this.cachedVetCommissionRate = null;
    this.cachedVetAt = 0;
    this.cachedSupport = null;
    this.cachedSupportAt = 0;
    this.cachedWeightArbitration = null;
    this.cachedWeightArbitrationAt = 0;
  }

  /**
   * Upsert singleton `default` résistant aux courses P2002
   * (plusieurs lecteurs parallèles au premier démarrage / e2e).
   */
  private async upsertDefaultRow(): Promise<PlatformSettings> {
    try {
      return await this.prisma.platformSettings.upsert({
        where: { id: DEFAULT_SETTINGS_ID },
        create: { id: DEFAULT_SETTINGS_ID },
        update: {}
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        const row = await this.prisma.platformSettings.findUnique({
          where: { id: DEFAULT_SETTINGS_ID }
        });
        if (row) {
          return row;
        }
      }
      throw e;
    }
  }

  async getOrCreateSettingsRow(): Promise<PlatformSettings> {
    if (!this.ensureDefaultRowInflight) {
      this.ensureDefaultRowInflight = this.upsertDefaultRow().finally(() => {
        this.ensureDefaultRowInflight = null;
      });
    }
    return this.ensureDefaultRowInflight;
  }

  async getMarketplaceCommissionRate(): Promise<number> {
    const now = Date.now();
    if (
      this.cachedCommissionRate != null &&
      now - this.cachedAt < CACHE_TTL_MS
    ) {
      return this.cachedCommissionRate;
    }

    const row = await this.getOrCreateSettingsRow();
    const n = Number(row.marketplaceCommissionRate);
    const rate =
      Number.isFinite(n) && n >= 0 && n < 1
        ? n
        : DEFAULT_MARKETPLACE_COMMISSION_RATE;

    this.cachedCommissionRate = rate;
    this.cachedAt = now;
    return rate;
  }

  async getSellerMarketplaceCommissionRate(): Promise<number> {
    const now = Date.now();
    if (
      this.cachedSellerCommissionRate != null &&
      now - this.cachedSellerAt < CACHE_TTL_MS
    ) {
      return this.cachedSellerCommissionRate;
    }
    const row = await this.getOrCreateSettingsRow();
    const n = Number(row.sellerMarketplaceCommissionRate);
    const rate =
      Number.isFinite(n) && n >= 0 && n < 1 ? n : DEFAULT_SELLER_COMMISSION_RATE;
    this.cachedSellerCommissionRate = rate;
    this.cachedSellerAt = now;
    return rate;
  }

  async getVetCommissionRate(): Promise<number> {
    const now = Date.now();
    if (
      this.cachedVetCommissionRate != null &&
      now - this.cachedVetAt < CACHE_TTL_MS
    ) {
      return this.cachedVetCommissionRate;
    }
    const row = await this.getOrCreateSettingsRow();
    const n = Number(row.vetCommissionRate);
    const rate =
      Number.isFinite(n) && n >= 0 && n < 1 ? n : DEFAULT_VET_COMMISSION_RATE;
    this.cachedVetCommissionRate = rate;
    this.cachedVetAt = now;
    return rate;
  }

  /** Taux publics pour aperçu frais côté mobile (sans auth). */
  async getPublicFeeRates(): Promise<{
    marketplaceBuyerCommissionRate: number;
    marketplaceSellerCommissionRate: number;
    vetCommissionRate: number;
  }> {
    const row = await this.getOrCreateSettingsRow();
    const buyer = Number(row.marketplaceCommissionRate);
    const seller = Number(row.sellerMarketplaceCommissionRate);
    const vet = Number(row.vetCommissionRate);
    const now = Date.now();

    const marketplaceBuyerCommissionRate =
      Number.isFinite(buyer) && buyer >= 0 && buyer < 1
        ? buyer
        : DEFAULT_MARKETPLACE_COMMISSION_RATE;
    const marketplaceSellerCommissionRate =
      Number.isFinite(seller) && seller >= 0 && seller < 1
        ? seller
        : DEFAULT_SELLER_COMMISSION_RATE;
    const vetCommissionRate =
      Number.isFinite(vet) && vet >= 0 && vet < 1
        ? vet
        : DEFAULT_VET_COMMISSION_RATE;

    this.cachedCommissionRate = marketplaceBuyerCommissionRate;
    this.cachedAt = now;
    this.cachedSellerCommissionRate = marketplaceSellerCommissionRate;
    this.cachedSellerAt = now;
    this.cachedVetCommissionRate = vetCommissionRate;
    this.cachedVetAt = now;

    return {
      marketplaceBuyerCommissionRate,
      marketplaceSellerCommissionRate,
      vetCommissionRate
    };
  }

  async getWeightArbitrationThresholds(): Promise<WeightArbitrationSettingsDto> {
    const now = Date.now();
    if (
      this.cachedWeightArbitration != null &&
      now - this.cachedWeightArbitrationAt < CACHE_TTL_MS
    ) {
      return this.cachedWeightArbitration;
    }
    const row = await this.getOrCreateSettingsRow();
    const thresholds = normalizeWeightArbitrationThresholds(row);
    this.cachedWeightArbitration = thresholds;
    this.cachedWeightArbitrationAt = now;
    return thresholds;
  }

  /** Valeurs DB + `supportEffective` (même logique que `GET /config/client`). */
  async getAdminSettingsView(): Promise<PlatformSettingsAdminDto> {
    const row = await this.getOrCreateSettingsRow();
    const supportEffective = await this.getSupportContact();
    return { ...row, supportEffective };
  }

  sanitizeSupportPhoneForStorage(
    raw: string | null | undefined
  ): string | null {
    const trimmed = raw?.trim();
    if (!trimmed) {
      return null;
    }
    return normalizePhone(trimmed) ?? trimmed;
  }

  sanitizeSupportTelegramForStorage(
    raw: string | null | undefined
  ): string | null {
    const trimmed = raw?.trim();
    if (!trimmed) {
      return null;
    }
    return normalizeTelegramUrl(trimmed) ?? trimmed;
  }

  async getSupportContact(): Promise<SupportContactDto> {
    const now = Date.now();
    if (
      this.cachedSupport != null &&
      now - this.cachedSupportAt < CACHE_TTL_MS
    ) {
      return this.cachedSupport;
    }

    const row = await this.getOrCreateSettingsRow();

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
