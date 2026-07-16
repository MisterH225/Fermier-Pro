import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  MerchantProductStatus,
  MerchantSubscriptionInvoiceStatus,
  MerchantSubscriptionTier,
  Prisma
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  MERCHANT_FREE_MAX_ACTIVE_PRODUCTS,
  MERCHANT_FREE_MAX_SHOPS
} from "./merchant-shop.constants";
import type { PatchMerchantOnboardingDto } from "./dto/merchant-shop.dto";
import { resolveMerchantPremiumBillingConfig } from "./merchant-premium-billing-config";
import { shouldExposePendingSubscription } from "./merchant-pending-subscription.util";
import { applyPromoPercent } from "./merchant-subscription.constants";

@Injectable()
export class MerchantProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureProfile(userId: string) {
    return this.prisma.merchantProfile.upsert({
      where: { userId },
      create: { userId },
      update: {}
    });
  }

  async requireProfile(userId: string) {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { userId },
      include: {
        shops: {
          include: {
            products: {
              orderBy: { createdAt: "asc" }
            }
          }
        }
      }
    });
    if (!profile) {
      throw new NotFoundException("Profil commerçant introuvable");
    }
    return profile;
  }

  countActiveProducts(
    products: { status: MerchantProductStatus }[]
  ): number {
    return products.filter((p) => p.status === MerchantProductStatus.published)
      .length;
  }

  maxShopsForTier(
    tier: MerchantSubscriptionTier | null,
    premiumMaxShops: number
  ): number {
    if (tier === MerchantSubscriptionTier.premium) {
      return Math.max(1, premiumMaxShops);
    }
    return MERCHANT_FREE_MAX_SHOPS;
  }

  maxActiveProductsForTier(tier: MerchantSubscriptionTier | null): number | null {
    if (tier === MerchantSubscriptionTier.premium) {
      return null;
    }
    return MERCHANT_FREE_MAX_ACTIVE_PRODUCTS;
  }

  async getMe(user: User) {
    await this.ensureProfile(user.id);
    let profile = await this.requireProfile(user.id);
    // Remise code promo : ne s'applique qu'à un Premium actif, pas après annulation
    if (
      profile.subscriptionTier !== MerchantSubscriptionTier.premium &&
      profile.promoPercentOffApplied != null
    ) {
      await this.prisma.merchantProfile.update({
        where: { id: profile.id },
        data: { promoPercentOffApplied: null }
      });
      profile = await this.requireProfile(user.id);
    }
    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: "default" }
    });
    const premiumMaxShops = settings?.merchantPremiumMaxShops ?? 3;
    const billing = resolveMerchantPremiumBillingConfig(settings);
    const stickyPromo =
      profile.subscriptionTier === MerchantSubscriptionTier.premium
        ? profile.promoPercentOffApplied
        : null;
    const premiumPrice =
      stickyPromo != null
        ? applyPromoPercent(billing.fullPriceXof, stickyPromo)
        : billing.effectivePriceXof;

    const shops = profile.shops.map((shop) => ({
      id: shop.id,
      name: shop.name,
      description: shop.description,
      locationLabel: shop.locationLabel,
      productCount: shop.products.length,
      activeProductCount: this.countActiveProducts(shop.products),
      createdAt: shop.createdAt.toISOString()
    }));

    const allProducts = profile.shops.flatMap((s) => s.products);
    const activeProductCount = this.countActiveProducts(allProducts);

    const pendingInvoice = await this.prisma.merchantSubscriptionInvoice.findFirst({
      where: {
        merchantProfileId: profile.id,
        status: MerchantSubscriptionInvoiceStatus.pending
      },
      orderBy: { dueDate: "desc" }
    });

    const trialAvailable =
      billing.trialEnabled &&
      profile.subscriptionTier !== MerchantSubscriptionTier.premium;

    return {
      subscriptionTier: profile.subscriptionTier,
      subscriptionStatus: profile.subscriptionStatus,
      subscriptionChosenAt: profile.subscriptionChosenAt?.toISOString() ?? null,
      premiumPaidAt: profile.premiumPaidAt?.toISOString() ?? null,
      nextBillingAt: profile.nextBillingAt?.toISOString() ?? null,
      graceEndsAt: profile.graceEndsAt?.toISOString() ?? null,
      trialEndsAt: profile.trialEndsAt?.toISOString() ?? null,
      promoPercentOffApplied: stickyPromo,
      pendingRenewal:
        pendingInvoice && profile.subscriptionTier === MerchantSubscriptionTier.premium
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
      shopSkipped: profile.shopSkipped,
      productSkipped: profile.productSkipped,
      onboardingComplete: profile.onboardingComplete,
      shopCount: profile.shops.length,
      activeProductCount,
      maxShops: this.maxShopsForTier(profile.subscriptionTier, premiumMaxShops),
      maxActiveProducts: this.maxActiveProductsForTier(profile.subscriptionTier),
      premiumPriceXof: premiumPrice,
      premiumFullPriceXof: billing.fullPriceXof,
      premiumMaxShops,
      billingUnit: billing.billingUnit,
      billingInterval: billing.billingInterval,
      graceDays: billing.graceDays,
      trialAvailable,
      trialUnits: billing.trialUnits,
      promoEnabled: billing.promoEnabled,
      promoPercentOff: billing.promoPercentOff,
      shops,
      needsShopNudge: profile.shopSkipped && profile.shops.length === 0,
      needsProductNudge:
        profile.shops.length > 0 &&
        profile.productSkipped &&
        allProducts.length === 0
    };
  }

  async patchOnboarding(user: User, dto: PatchMerchantOnboardingDto) {
    await this.ensureProfile(user.id);
    const data: Prisma.MerchantProfileUpdateInput = {};
    if (dto.shopSkipped !== undefined) data.shopSkipped = dto.shopSkipped;
    if (dto.productSkipped !== undefined) data.productSkipped = dto.productSkipped;
    if (dto.onboardingComplete !== undefined) {
      data.onboardingComplete = dto.onboardingComplete;
    }
    await this.prisma.merchantProfile.update({
      where: { userId: user.id },
      data
    });
    return this.getMe(user);
  }

  async assertSubscriptionChosen(userId: string) {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { userId },
      select: { subscriptionTier: true }
    });
    if (!profile?.subscriptionTier) {
      throw new ForbiddenException({
        statusCode: 403,
        code: "SUBSCRIPTION_REQUIRED",
        message: "Choisissez un abonnement avant publication"
      });
    }
    return profile.subscriptionTier;
  }
}
