import { ForbiddenException, Injectable } from "@nestjs/common";
import {
  FarmInvitationStatus,
  FarmStatus,
  MembershipRole,
  MerchantProductDisabledReason,
  MerchantProductStatus,
  MerchantSubscriptionTier,
  type PlatformSettings
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  SUBSCRIPTION_LIMIT_ERROR,
  forbiddenLimit
} from "./subscription-limit.errors";

export type SubscriptionTierLimits = {
  producerStandardMaxFarms: number | null;
  producerPremiumMaxFarms: number | null;
  merchantStandardMaxShops: number | null;
  merchantStandardMaxProductsPerShop: number | null;
  merchantPremiumMaxShops: number | null;
  merchantPremiumMaxProductsPerShop: number | null;
};

const DEFAULT_LIMITS: SubscriptionTierLimits = {
  producerStandardMaxFarms: 1,
  producerPremiumMaxFarms: null,
  merchantStandardMaxShops: 1,
  merchantStandardMaxProductsPerShop: 3,
  merchantPremiumMaxShops: 3,
  merchantPremiumMaxProductsPerShop: null
};

@Injectable()
export class SubscriptionLimitsService {
  constructor(private readonly prisma: PrismaService) {}

  async loadLimits(): Promise<SubscriptionTierLimits> {
    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: "default" }
    });
    return this.limitsFromSettings(settings);
  }

  limitsFromSettings(
    settings: PlatformSettings | null | undefined
  ): SubscriptionTierLimits {
    if (!settings) {
      return { ...DEFAULT_LIMITS };
    }
    // null field = unlimited (do not coalesce to defaults)
    return {
      producerStandardMaxFarms: settings.producerStandardMaxFarms,
      producerPremiumMaxFarms: settings.producerPremiumMaxFarms,
      merchantStandardMaxShops: settings.merchantStandardMaxShops,
      merchantStandardMaxProductsPerShop:
        settings.merchantStandardMaxProductsPerShop,
      merchantPremiumMaxShops: settings.merchantPremiumMaxShops,
      merchantPremiumMaxProductsPerShop:
        settings.merchantPremiumMaxProductsPerShop
    };
  }

  /** null = unlimited */
  resolveMaxFarms(
    tier: MerchantSubscriptionTier | null | undefined,
    limits: SubscriptionTierLimits
  ): number | null {
    if (tier === MerchantSubscriptionTier.premium) {
      return limits.producerPremiumMaxFarms;
    }
    return limits.producerStandardMaxFarms;
  }

  resolveMaxShops(
    tier: MerchantSubscriptionTier | null | undefined,
    limits: SubscriptionTierLimits
  ): number | null {
    if (tier === MerchantSubscriptionTier.premium) {
      return limits.merchantPremiumMaxShops;
    }
    return limits.merchantStandardMaxShops;
  }

  resolveMaxProductsPerShop(
    tier: MerchantSubscriptionTier | null | undefined,
    limits: SubscriptionTierLimits
  ): number | null {
    if (tier === MerchantSubscriptionTier.premium) {
      return limits.merchantPremiumMaxProductsPerShop;
    }
    return limits.merchantStandardMaxProductsPerShop;
  }

  assertWithinLimit(current: number, max: number | null, code: string, message: string): void {
    if (max === null) {
      return;
    }
    if (current >= max) {
      throw forbiddenLimit(
        code as (typeof SUBSCRIPTION_LIMIT_ERROR)[keyof typeof SUBSCRIPTION_LIMIT_ERROR],
        message
      );
    }
  }

  async assertFarmCreate(userId: string): Promise<void> {
    const limits = await this.loadLimits();
    const profile = await this.prisma.producerProfile.findUnique({
      where: { userId },
      select: { subscriptionTier: true }
    });
    const max = this.resolveMaxFarms(profile?.subscriptionTier, limits);
    const activeFarmCount = await this.prisma.farm.count({
      where: { ownerId: userId, status: FarmStatus.active }
    });
    this.assertWithinLimit(
      activeFarmCount,
      max,
      SUBSCRIPTION_LIMIT_ERROR.FARM_LIMIT_REACHED,
      max == null
        ? "Limite de projets actifs atteinte."
        : `Limite de ${max} projet${max > 1 ? "s" : ""} actif${max > 1 ? "s" : ""} atteinte. Archivez un projet pour en créer un nouveau.`
    );
  }

  async assertShopCreate(merchantProfileId: string): Promise<void> {
    const limits = await this.loadLimits();
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { id: merchantProfileId },
      select: { subscriptionTier: true }
    });
    const max = this.resolveMaxShops(profile?.subscriptionTier, limits);
    const activeShopCount = await this.prisma.merchantShop.count({
      where: { merchantProfileId, archivedAt: null }
    });
    this.assertWithinLimit(
      activeShopCount,
      max,
      SUBSCRIPTION_LIMIT_ERROR.SHOP_LIMIT_REACHED,
      "Limite de boutiques atteinte pour votre abonnement"
    );
  }

  async assertProductPublish(
    shopId: string,
    tier: MerchantSubscriptionTier | null
  ): Promise<void> {
    const shop = await this.prisma.merchantShop.findUnique({
      where: { id: shopId },
      select: { writeLockedAt: true, archivedAt: true }
    });
    if (!shop || shop.archivedAt != null) {
      throw new ForbiddenException("Boutique introuvable ou archivée");
    }
    if (shop.writeLockedAt != null) {
      throw new ForbiddenException(
        "Boutique en lecture seule (limite d'abonnement)."
      );
    }

    const limits = await this.loadLimits();
    const max = this.resolveMaxProductsPerShop(tier, limits);
    const activeCount = await this.prisma.merchantProduct.count({
      where: { shopId, status: MerchantProductStatus.published }
    });
    this.assertWithinLimit(
      activeCount,
      max,
      SUBSCRIPTION_LIMIT_ERROR.PRODUCT_LIMIT_REACHED,
      max == null
        ? "Limite de produits actifs atteinte pour cette boutique"
        : `Limite de ${max} produit${max > 1 ? "s" : ""} actif${max > 1 ? "s" : ""} atteinte pour cette boutique`
    );
  }

  /**
   * Premium → free : oldest active farms stay writable; excess locked;
   * non-owner memberships archived; pending invitations expired.
   */
  async applyProducerDemotion(userId: string): Promise<void> {
    const limits = await this.loadLimits();
    const maxFarms = limits.producerStandardMaxFarms;

    const farms = await this.prisma.farm.findMany({
      where: { ownerId: userId, status: FarmStatus.active },
      select: { id: true },
      orderBy: { createdAt: "asc" }
    });
    const farmIds = farms.map((f) => f.id);
    if (farmIds.length === 0) {
      return;
    }

    const keepIds =
      maxFarms === null ? farmIds : farmIds.slice(0, Math.max(0, maxFarms));
    const lockIds = farmIds.filter((id) => !keepIds.includes(id));
    const now = new Date();

    await this.prisma.$transaction([
      ...(lockIds.length > 0
        ? [
            this.prisma.farm.updateMany({
              where: { id: { in: lockIds } },
              data: { writeLockedAt: now }
            })
          ]
        : []),
      this.prisma.farm.updateMany({
        where: { id: { in: keepIds }, writeLockedAt: { not: null } },
        data: { writeLockedAt: null }
      }),
      // Excess farms: archive non-owner memberships (and all non-owners on owned farms for team revoke)
      this.prisma.farmMembership.updateMany({
        where: {
          farmId: { in: farmIds },
          role: { not: MembershipRole.owner }
        },
        data: { archived: true }
      }),
      this.prisma.farmInvitation.updateMany({
        where: {
          farmId: { in: farmIds },
          status: {
            in: [FarmInvitationStatus.pending, FarmInvitationStatus.accepted]
          }
        },
        data: { status: FarmInvitationStatus.expired }
      })
    ]);

    // Also archive on archived owned farms (team revoke covers all owned farms)
    const allOwned = await this.prisma.farm.findMany({
      where: { ownerId: userId },
      select: { id: true }
    });
    const allIds = allOwned.map((f) => f.id);
    const missing = allIds.filter((id) => !farmIds.includes(id));
    if (missing.length > 0) {
      await this.prisma.$transaction([
        this.prisma.farmMembership.updateMany({
          where: {
            farmId: { in: missing },
            role: { not: MembershipRole.owner }
          },
          data: { archived: true }
        }),
        this.prisma.farmInvitation.updateMany({
          where: {
            farmId: { in: missing },
            status: {
              in: [FarmInvitationStatus.pending, FarmInvitationStatus.accepted]
            }
          },
          data: { status: FarmInvitationStatus.expired }
        })
      ]);
    }
  }

  async restoreProducerPremium(userId: string): Promise<void> {
    const ownedFarms = await this.prisma.farm.findMany({
      where: { ownerId: userId },
      select: { id: true }
    });
    const farmIds = ownedFarms.map((f) => f.id);
    if (farmIds.length === 0) {
      return;
    }

    await this.prisma.$transaction([
      this.prisma.farm.updateMany({
        where: { id: { in: farmIds }, writeLockedAt: { not: null } },
        data: { writeLockedAt: null }
      }),
      this.prisma.farmMembership.updateMany({
        where: {
          farmId: { in: farmIds },
          role: { not: MembershipRole.owner },
          archived: true
        },
        data: { archived: false }
      })
    ]);
  }

  /**
   * Premium → free : keep oldest shops within standard max; lock excess + unpublish
   * their products; in kept shops, unpublish products beyond standard per-shop max.
   */
  async applyMerchantDemotion(merchantProfileId: string): Promise<void> {
    const limits = await this.loadLimits();
    const maxShops = limits.merchantStandardMaxShops;
    const maxProducts = limits.merchantStandardMaxProductsPerShop;

    const shops = await this.prisma.merchantShop.findMany({
      where: { merchantProfileId, archivedAt: null },
      select: {
        id: true,
        products: {
          where: { status: MerchantProductStatus.published },
          select: { id: true },
          orderBy: { createdAt: "asc" }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    const keepShops =
      maxShops === null ? shops : shops.slice(0, Math.max(0, maxShops));
    const lockShops = shops.filter((s) => !keepShops.some((k) => k.id === s.id));
    const now = new Date();
    const productIdsToDisable: string[] = [];

    for (const shop of lockShops) {
      for (const p of shop.products) {
        productIdsToDisable.push(p.id);
      }
    }

    for (const shop of keepShops) {
      if (maxProducts === null) {
        continue;
      }
      const excess = shop.products.slice(Math.max(0, maxProducts));
      for (const p of excess) {
        productIdsToDisable.push(p.id);
      }
    }

    await this.prisma.$transaction([
      ...(lockShops.length > 0
        ? [
            this.prisma.merchantShop.updateMany({
              where: { id: { in: lockShops.map((s) => s.id) } },
              data: { writeLockedAt: now }
            })
          ]
        : []),
      this.prisma.merchantShop.updateMany({
        where: {
          id: { in: keepShops.map((s) => s.id) },
          writeLockedAt: { not: null }
        },
        data: { writeLockedAt: null }
      }),
      ...(productIdsToDisable.length > 0
        ? [
            this.prisma.merchantProduct.updateMany({
              where: { id: { in: productIdsToDisable } },
              data: {
                status: MerchantProductStatus.disabled,
                disabledAt: now,
                disabledReason: MerchantProductDisabledReason.downgrade
              }
            })
          ]
        : [])
    ]);
  }

  async restoreMerchantPremium(merchantProfileId: string): Promise<void> {
    const shops = await this.prisma.merchantShop.findMany({
      where: { merchantProfileId },
      select: { id: true }
    });
    const shopIds = shops.map((s) => s.id);

    await this.prisma.$transaction([
      ...(shopIds.length > 0
        ? [
            this.prisma.merchantShop.updateMany({
              where: { id: { in: shopIds }, writeLockedAt: { not: null } },
              data: { writeLockedAt: null }
            })
          ]
        : []),
      ...(shopIds.length > 0
        ? [
            this.prisma.merchantProduct.updateMany({
              where: {
                shopId: { in: shopIds },
                status: MerchantProductStatus.disabled,
                disabledReason: {
                  in: [
                    MerchantProductDisabledReason.downgrade,
                    MerchantProductDisabledReason.limit_free
                  ]
                }
              },
              data: {
                status: MerchantProductStatus.published,
                publishedAt: new Date(),
                disabledAt: null,
                disabledReason: null
              }
            })
          ]
        : [])
    ]);
  }
}
