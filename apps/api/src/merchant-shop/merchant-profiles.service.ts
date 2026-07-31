import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  MerchantKind,
  MerchantProductDisabledReason,
  MerchantProductStatus,
  MerchantSubscriptionInvoiceStatus,
  MerchantSubscriptionTier,
  Prisma
} from "@prisma/client";
import { PlatformFeatureFlagsService } from "../feature-flags/platform-feature-flags.service";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionLimitsService } from "../subscription-limits/subscription-limits.service";
import type {
  PatchMerchantOnboardingDto,
  PatchMerchantProfileDto
} from "./dto/merchant-shop.dto";
import { resolveMerchantPremiumBillingConfig } from "./merchant-premium-billing-config";
import { shouldExposePendingSubscription } from "./merchant-pending-subscription.util";
import { applyPromoPercent } from "./merchant-subscription.constants";

@Injectable()
export class MerchantProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionLimits: SubscriptionLimitsService,
    private readonly platformFlags: PlatformFeatureFlagsService
  ) {}

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

  /** Produits visibles boutique (hors soft-delete commerçant). Filtre JS — pas de WHERE enum. */
  visibleProducts<
    T extends { disabledReason: MerchantProductDisabledReason | null }
  >(products: T[]): T[] {
    return products.filter(
      (p) => p.disabledReason !== MerchantProductDisabledReason.merchant_deleted
    );
  }

  countActiveProducts(
    products: { status: MerchantProductStatus }[]
  ): number {
    return products.filter((p) => p.status === MerchantProductStatus.published)
      .length;
  }

  maxShopsForTier(
    tier: MerchantSubscriptionTier | null,
    limits: ReturnType<SubscriptionLimitsService["limitsFromSettings"]>
  ): number | null {
    return this.subscriptionLimits.resolveMaxShops(tier, limits);
  }

  maxActiveProductsForTier(
    tier: MerchantSubscriptionTier | null,
    limits: ReturnType<SubscriptionLimitsService["limitsFromSettings"]>
  ): number | null {
    return this.subscriptionLimits.resolveMaxProductsPerShop(tier, limits);
  }

  /**
   * Accepte `mill` uniquement si le flag `mills` est actif pour l'utilisateur.
   * Le passage standard→mill (et mill→standard) n'efface aucune donnée.
   */
  async assertMerchantKindAllowed(
    userId: string,
    merchantKind: MerchantKind
  ): Promise<void> {
    if (merchantKind !== MerchantKind.mill) {
      return;
    }
    const millsActive = await this.platformFlags.isModuleActiveForUser(
      "mills",
      userId
    );
    if (!millsActive) {
      throw new ForbiddenException({
        statusCode: 403,
        code: "MILLS_MODULE_INACTIVE",
        message:
          "Le type Moulin n'est disponible que lorsque le module moulins est actif"
      });
    }
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
    const limits = this.subscriptionLimits.limitsFromSettings(settings);
    const premiumMaxShops = limits.merchantPremiumMaxShops;
    const billing = resolveMerchantPremiumBillingConfig(settings);
    const stickyPromo =
      profile.subscriptionTier === MerchantSubscriptionTier.premium
        ? profile.promoPercentOffApplied
        : null;
    const premiumPrice =
      stickyPromo != null
        ? applyPromoPercent(billing.fullPriceXof, stickyPromo)
        : billing.effectivePriceXof;

    const activeShops = profile.shops.filter((shop) => shop.archivedAt == null);
    const shops = activeShops.map((shop) => {
      const products = this.visibleProducts(shop.products);
      return {
        id: shop.id,
        name: shop.name,
        description: shop.description,
        locationLabel: shop.locationLabel,
        productCount: products.length,
        activeProductCount: this.countActiveProducts(products),
        writeLockedAt: shop.writeLockedAt?.toISOString() ?? null,
        createdAt: shop.createdAt.toISOString()
      };
    });

    const allProducts = activeShops.flatMap((s) =>
      this.visibleProducts(s.products)
    );
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
      merchantKind: profile.merchantKind,
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
      shopCount: activeShops.length,
      activeProductCount,
      maxShops: this.maxShopsForTier(profile.subscriptionTier, limits),
      maxActiveProducts: this.maxActiveProductsForTier(
        profile.subscriptionTier,
        limits
      ),
      standardMaxShops: limits.merchantStandardMaxShops,
      standardMaxProductsPerShop: limits.merchantStandardMaxProductsPerShop,
      premiumMaxProductsPerShop: limits.merchantPremiumMaxProductsPerShop,
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
      needsShopNudge: profile.shopSkipped && activeShops.length === 0,
      needsProductNudge:
        activeShops.length > 0 &&
        profile.productSkipped &&
        allProducts.length === 0
    };
  }

  async patchOnboarding(user: User, dto: PatchMerchantOnboardingDto) {
    await this.ensureProfile(user.id);
    if (dto.merchantKind !== undefined) {
      await this.assertMerchantKindAllowed(user.id, dto.merchantKind);
    }
    const data: Prisma.MerchantProfileUpdateInput = {};
    if (dto.shopSkipped !== undefined) data.shopSkipped = dto.shopSkipped;
    if (dto.productSkipped !== undefined) data.productSkipped = dto.productSkipped;
    if (dto.onboardingComplete !== undefined) {
      data.onboardingComplete = dto.onboardingComplete;
    }
    if (dto.merchantKind !== undefined) {
      data.merchantKind = dto.merchantKind;
    }
    await this.prisma.merchantProfile.update({
      where: { userId: user.id },
      data
    });
    return this.getMe(user);
  }

  /**
   * Paramètres profil/boutique.
   * Passage standard→mill autorisé si flag `mills` actif — aucune donnée effacée.
   */
  async patchProfile(user: User, dto: PatchMerchantProfileDto) {
    await this.ensureProfile(user.id);
    if (dto.merchantKind === undefined) {
      return this.getMe(user);
    }
    await this.assertMerchantKindAllowed(user.id, dto.merchantKind);
    await this.prisma.merchantProfile.update({
      where: { userId: user.id },
      data: { merchantKind: dto.merchantKind }
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
