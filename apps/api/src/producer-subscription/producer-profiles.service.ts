import { Injectable, NotFoundException } from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  MerchantSubscriptionInvoiceStatus,
  MerchantSubscriptionTier
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { shouldExposePendingSubscription } from "../merchant-shop/merchant-pending-subscription.util";
import { applyPromoPercent } from "../merchant-shop/merchant-subscription.constants";
import { resolveProducerPremiumBillingConfig } from "./producer-premium-billing-config";
import { ProducerTeamAccessService } from "./producer-team-access.service";

@Injectable()
export class ProducerProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamAccess: ProducerTeamAccessService
  ) {}

  async ensureProfile(userId: string) {
    return this.prisma.producerProfile.upsert({
      where: { userId },
      create: { userId },
      update: {}
    });
  }

  async requireProfile(userId: string) {
    const profile = await this.prisma.producerProfile.findUnique({
      where: { userId }
    });
    if (!profile) {
      throw new NotFoundException("Profil producteur introuvable");
    }
    return profile;
  }

  async getMe(user: User) {
    let profile = await this.ensureProfile(user.id);
    // Remise code promo : ne s'applique qu'à un Premium actif, pas après annulation
    if (
      profile.subscriptionTier !== MerchantSubscriptionTier.premium &&
      profile.promoPercentOffApplied != null
    ) {
      await this.prisma.producerProfile.update({
        where: { id: profile.id },
        data: { promoPercentOffApplied: null }
      });
      profile = await this.ensureProfile(user.id);
    }
    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: "default" }
    });
    const billing = resolveProducerPremiumBillingConfig(settings);
    const stickyPromo =
      profile.subscriptionTier === MerchantSubscriptionTier.premium
        ? profile.promoPercentOffApplied
        : null;
    const premiumPrice =
      stickyPromo != null
        ? applyPromoPercent(billing.fullPriceXof, stickyPromo)
        : billing.effectivePriceXof;

    const pendingInvoice = await this.prisma.producerSubscriptionInvoice.findFirst({
      where: {
        producerProfileId: profile.id,
        status: MerchantSubscriptionInvoiceStatus.pending
      },
      orderBy: { dueDate: "desc" }
    });

    const trialAvailable =
      billing.trialEnabled &&
      profile.subscriptionTier !== MerchantSubscriptionTier.premium;

    const teamPremiumActive = this.teamAccess.isPremiumActive(profile);

    return {
      subscriptionTier: profile.subscriptionTier,
      subscriptionStatus: profile.subscriptionStatus,
      subscriptionChosenAt: profile.subscriptionChosenAt?.toISOString() ?? null,
      premiumPaidAt: profile.premiumPaidAt?.toISOString() ?? null,
      nextBillingAt: profile.nextBillingAt?.toISOString() ?? null,
      graceEndsAt: profile.graceEndsAt?.toISOString() ?? null,
      trialEndsAt: profile.trialEndsAt?.toISOString() ?? null,
      promoPercentOffApplied: stickyPromo,
      teamPremiumActive,
      pendingRenewal:
        pendingInvoice &&
        profile.subscriptionTier === MerchantSubscriptionTier.premium
          ? {
              invoiceId: pendingInvoice.id,
              amount: Number(pendingInvoice.amount),
              currency: pendingInvoice.currency,
              paymentUrl: pendingInvoice.paymentUrl,
              providerRef: pendingInvoice.providerRef,
              dueDate: pendingInvoice.dueDate.toISOString()
            }
          : null,
      pendingSubscription:
        pendingInvoice &&
        shouldExposePendingSubscription(profile.subscriptionTier)
          ? {
              invoiceId: pendingInvoice.id,
              amount: Number(pendingInvoice.amount),
              currency: pendingInvoice.currency,
              paymentUrl: pendingInvoice.paymentUrl,
              providerRef: pendingInvoice.providerRef,
              dueDate: pendingInvoice.dueDate.toISOString()
            }
          : null,
      premiumPriceXof: premiumPrice,
      premiumFullPriceXof: billing.fullPriceXof,
      billingUnit: billing.billingUnit,
      billingInterval: billing.billingInterval,
      graceDays: billing.graceDays,
      trialAvailable,
      trialUnits: billing.trialUnits,
      promoEnabled: billing.promoEnabled,
      promoPercentOff: billing.promoPercentOff
    };
  }
}
