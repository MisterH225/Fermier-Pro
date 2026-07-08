import { Injectable, NotFoundException } from "@nestjs/common";
import {
  MerchantSubscriptionStatus,
  MerchantSubscriptionTier,
  Prisma
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MerchantSubscriptionBillingService } from "../merchant-shop/merchant-subscription-billing.service";
import { resolveMerchantPremiumBillingConfig } from "../merchant-shop/merchant-premium-billing-config";

@Injectable()
export class AdminMerchantSubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: MerchantSubscriptionBillingService
  ) {}

  async list(params: { status?: string; q?: string; take?: number }) {
    const take = Math.min(100, Math.max(1, params.take ?? 50));
    const where: Prisma.MerchantProfileWhereInput = {};
    if (params.status === "none") {
      where.subscriptionTier = null;
    } else if (params.status) {
      where.subscriptionStatus = params.status as MerchantSubscriptionStatus;
    }
    if (params.q?.trim()) {
      const q = params.q.trim();
      where.user = {
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } }
        ]
      };
    }

    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: "default" }
    });
    const billing = resolveMerchantPremiumBillingConfig(settings);

    const rows = await this.prisma.merchantProfile.findMany({
      where,
      take,
      orderBy: { updatedAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true
          }
        },
        shops: { select: { id: true } }
      }
    });

    return {
      billing: {
        fullPriceXof: billing.fullPriceXof,
        effectivePriceXof: billing.effectivePriceXof,
        billingUnit: billing.billingUnit,
        billingInterval: billing.billingInterval,
        graceDays: billing.graceDays,
        trialEnabled: billing.trialEnabled,
        trialUnits: billing.trialUnits,
        promoEnabled: billing.promoEnabled,
        promoPercentOff: billing.promoPercentOff
      },
      items: rows.map((p) => ({
        profileId: p.id,
        userId: p.user.id,
        fullName: p.user.fullName,
        email: p.user.email,
        phone: p.user.phone,
        shopCount: p.shops.length,
        subscriptionTier: p.subscriptionTier,
        subscriptionStatus: p.subscriptionStatus,
        nextBillingAt: p.nextBillingAt?.toISOString() ?? null,
        trialEndsAt: p.trialEndsAt?.toISOString() ?? null,
        promoPercentOffApplied: p.promoPercentOffApplied,
        suspendedAt: p.suspendedAt?.toISOString() ?? null,
        suspensionReason: p.suspensionReason,
        cancelledAt: p.cancelledAt?.toISOString() ?? null,
        premiumPaidAt: p.premiumPaidAt?.toISOString() ?? null
      }))
    };
  }

  async suspend(profileId: string, reason?: string) {
    await this.billing.suspendProfile(profileId, reason);
    return this.getOne(profileId);
  }

  async resume(profileId: string) {
    await this.billing.resumeProfile(profileId);
    return this.getOne(profileId);
  }

  async cancel(profileId: string, reason?: string) {
    await this.billing.cancelProfile(profileId, reason);
    return this.getOne(profileId);
  }

  async grantTrial(profileId: string, units?: number) {
    await this.billing.grantTrial(profileId, units);
    return this.getOne(profileId);
  }

  async applyPromo(profileId: string, percentOff: number) {
    await this.billing.applyPromoOverride(profileId, percentOff);
    return this.getOne(profileId);
  }

  private async getOne(profileId: string) {
    const p = await this.prisma.merchantProfile.findUnique({
      where: { id: profileId },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true }
        },
        shops: { select: { id: true } }
      }
    });
    if (!p) {
      throw new NotFoundException("Profil commerçant introuvable");
    }
    return {
      profileId: p.id,
      userId: p.user.id,
      fullName: p.user.fullName,
      email: p.user.email,
      phone: p.user.phone,
      shopCount: p.shops.length,
      subscriptionTier: p.subscriptionTier,
      subscriptionStatus: p.subscriptionStatus,
      nextBillingAt: p.nextBillingAt?.toISOString() ?? null,
      trialEndsAt: p.trialEndsAt?.toISOString() ?? null,
      promoPercentOffApplied: p.promoPercentOffApplied,
      suspendedAt: p.suspendedAt?.toISOString() ?? null,
      suspensionReason: p.suspensionReason,
      cancelledAt: p.cancelledAt?.toISOString() ?? null,
      premiumPaidAt: p.premiumPaidAt?.toISOString() ?? null
    };
  }
}
