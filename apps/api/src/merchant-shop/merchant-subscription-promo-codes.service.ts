import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  MerchantSubscriptionPromoCodeType,
  MerchantSubscriptionTier,
  type MerchantSubscriptionPromoCode
} from "@prisma/client";
import { randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import {
  applyPromoPercent,
  type MerchantPremiumBillingUnit
} from "./merchant-subscription.constants";
import { resolveMerchantPremiumBillingConfig } from "./merchant-premium-billing-config";

export type PromoCodeBenefit = {
  codeId: string;
  code: string;
  type: MerchantSubscriptionPromoCodeType;
  label: string | null;
  percentOff: number | null;
  trialUnits: number | null;
  discountedPriceXof: number | null;
  fullPriceXof: number;
};

export function normalizePromoCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function generatePromoCodeValue(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  const bytes = randomBytes(8);
  for (let i = 0; i < 8; i += 1) {
    suffix += alphabet[bytes[i]! % alphabet.length];
  }
  return `FP-${suffix}`;
}

@Injectable()
export class MerchantSubscriptionPromoCodesService {
  constructor(private readonly prisma: PrismaService) {}

  async listAdmin(params?: { activeOnly?: boolean }) {
    const rows = await this.prisma.merchantSubscriptionPromoCode.findMany({
      where: params?.activeOnly ? { isActive: true } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        _count: { select: { redemptions: true } }
      }
    });
    return rows.map((row) => this.serializeAdmin(row, row._count.redemptions));
  }

  async createAdmin(input: {
    type: MerchantSubscriptionPromoCodeType;
    label?: string;
    code?: string;
    percentOff?: number;
    trialUnits?: number;
    maxRedemptions?: number;
    expiresAt?: Date | null;
    createdByUserId?: string;
  }) {
    this.assertCreatePayload(input);
    const code = normalizePromoCode(input.code?.trim() || generatePromoCodeValue());
    const existing = await this.prisma.merchantSubscriptionPromoCode.findUnique({
      where: { code }
    });
    if (existing) {
      throw new BadRequestException("Ce code existe déjà");
    }
    const row = await this.prisma.merchantSubscriptionPromoCode.create({
      data: {
        code,
        type: input.type,
        label: input.label?.trim() || null,
        percentOff:
          input.type === MerchantSubscriptionPromoCodeType.trial
            ? null
            : Math.min(100, Math.max(0, Math.floor(input.percentOff ?? 0))),
        trialUnits:
          input.type === MerchantSubscriptionPromoCodeType.trial
            ? Math.max(1, Math.floor(input.trialUnits ?? 1))
            : null,
        maxRedemptions:
          input.maxRedemptions != null
            ? Math.max(1, Math.floor(input.maxRedemptions))
            : null,
        expiresAt: input.expiresAt ?? null,
        createdByUserId: input.createdByUserId ?? null
      }
    });
    return this.serializeAdmin(row, 0);
  }

  async deactivateAdmin(id: string) {
    const row = await this.prisma.merchantSubscriptionPromoCode.update({
      where: { id },
      data: { isActive: false }
    });
    // Profils free/annulés : ne plus afficher la remise d'un code désactivé
    const redemptions =
      await this.prisma.merchantSubscriptionPromoRedemption.findMany({
        where: { promoCodeId: id },
        select: { merchantProfileId: true }
      });
    const profileIds = redemptions.map((r) => r.merchantProfileId);
    if (profileIds.length > 0) {
      await this.prisma.merchantProfile.updateMany({
        where: {
          id: { in: profileIds },
          subscriptionTier: { not: MerchantSubscriptionTier.premium }
        },
        data: { promoPercentOffApplied: null }
      });
    }
    const count = await this.prisma.merchantSubscriptionPromoRedemption.count({
      where: { promoCodeId: id }
    });
    return this.serializeAdmin(row, count);
  }

  async previewForMerchant(profileId: string, rawCode: string): Promise<PromoCodeBenefit> {
    const row = await this.loadValidCode(rawCode, profileId);
    return this.buildBenefit(row);
  }

  async redeemForMerchant(profileId: string, rawCode: string): Promise<PromoCodeBenefit> {
    const row = await this.loadValidCode(rawCode, profileId);
    await this.prisma.$transaction([
      this.prisma.merchantSubscriptionPromoRedemption.create({
        data: {
          promoCodeId: row.id,
          merchantProfileId: profileId
        }
      }),
      this.prisma.merchantSubscriptionPromoCode.update({
        where: { id: row.id },
        data: { redemptionCount: { increment: 1 } }
      })
    ]);
    return this.buildBenefit(row);
  }

  private async loadValidCode(
    rawCode: string,
    profileId: string
  ): Promise<MerchantSubscriptionPromoCode> {
    const code = normalizePromoCode(rawCode);
    if (!code || code.length < 4) {
      throw new BadRequestException("Code invalide");
    }

    const profile = await this.prisma.merchantProfile.findUnique({
      where: { id: profileId }
    });
    if (!profile) {
      throw new NotFoundException("Profil commerçant introuvable");
    }
    if (profile.subscriptionTier === MerchantSubscriptionTier.premium) {
      throw new BadRequestException(
        "Code utilisable uniquement avant souscription Premium"
      );
    }

    const row = await this.prisma.merchantSubscriptionPromoCode.findUnique({
      where: { code }
    });
    if (!row || !row.isActive) {
      throw new BadRequestException("Code introuvable ou inactif");
    }
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("Code expiré");
    }
    if (
      row.maxRedemptions != null &&
      row.redemptionCount >= row.maxRedemptions
    ) {
      throw new BadRequestException("Code épuisé");
    }

    const already = await this.prisma.merchantSubscriptionPromoRedemption.findUnique({
      where: {
        promoCodeId_merchantProfileId: {
          promoCodeId: row.id,
          merchantProfileId: profileId
        }
      }
    });
    if (already) {
      throw new BadRequestException("Code déjà utilisé sur ce compte");
    }

    return row;
  }

  private async buildBenefit(
    row: MerchantSubscriptionPromoCode
  ): Promise<PromoCodeBenefit> {
    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: "default" }
    });
    const billing = resolveMerchantPremiumBillingConfig(settings);
    const fullPriceXof = billing.fullPriceXof;
    let discountedPriceXof: number | null = null;
    if (
      row.type === MerchantSubscriptionPromoCodeType.discount ||
      row.type === MerchantSubscriptionPromoCodeType.promo
    ) {
      discountedPriceXof = applyPromoPercent(
        fullPriceXof,
        row.percentOff ?? 0
      );
    }
    return {
      codeId: row.id,
      code: row.code,
      type: row.type,
      label: row.label,
      percentOff: row.percentOff,
      trialUnits: row.trialUnits,
      discountedPriceXof,
      fullPriceXof
    };
  }

  private assertCreatePayload(input: {
    type: MerchantSubscriptionPromoCodeType;
    percentOff?: number;
    trialUnits?: number;
  }) {
    if (input.type === MerchantSubscriptionPromoCodeType.trial) {
      if (!input.trialUnits || input.trialUnits < 1) {
        throw new BadRequestException("trialUnits requis pour un code essai");
      }
      return;
    }
    if (input.percentOff == null || input.percentOff < 1 || input.percentOff > 100) {
      throw new BadRequestException("percentOff requis (1–100) pour remise/promo");
    }
  }

  private serializeAdmin(
    row: MerchantSubscriptionPromoCode,
    redemptionCount: number
  ) {
    return {
      id: row.id,
      code: row.code,
      type: row.type,
      label: row.label,
      percentOff: row.percentOff,
      trialUnits: row.trialUnits,
      maxRedemptions: row.maxRedemptions,
      redemptionCount,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString()
    };
  }
}

export type { MerchantPremiumBillingUnit };
