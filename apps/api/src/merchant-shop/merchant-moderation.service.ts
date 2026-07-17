import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  MerchantProductDisabledReason,
  MerchantProductStatus,
  MerchantSubscriptionTier,
  ProfileType
} from "@prisma/client";
import { AuditService } from "../common/audit.service";
import { PushNotificationsService } from "../push-notifications/push-notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { allowMerchantCatalogHardDelete } from "./merchant-catalog-protection";
import {
  archiveShopInTransaction,
  countAnyOrdersForShop,
  countBlockingOrdersForShop,
  shopActiveOrdersConflict,
  shopOrderHistoryConflict
} from "./merchant-shop-archive";
import { MerchantSubscriptionService } from "./merchant-subscription.service";
import type {
  ArchiveMerchantShopAdminDto,
  DeleteMerchantProductAdminDto,
  RejectMerchantProductResubmissionDto
} from "./dto/merchant-shop.dto";

@Injectable()
export class MerchantModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushNotificationsService,
    private readonly subscription: MerchantSubscriptionService,
    private readonly audit: AuditService
  ) {}

  async listAllProducts(opts?: { status?: MerchantProductStatus }) {
    const rows = await this.prisma.merchantProduct.findMany({
      where: opts?.status ? { status: opts.status } : undefined,
      include: {
        category: { select: { id: true, name: true } },
        shop: {
          select: {
            id: true,
            name: true,
            archivedAt: true,
            merchantProfile: {
              select: {
                user: { select: { id: true, email: true, fullName: true } }
              }
            }
          }
        },
        _count: { select: { orders: true } }
      },
      orderBy:
        opts?.status === MerchantProductStatus.resubmission_review
          ? [{ resubmittedAt: "desc" }, { updatedAt: "desc" }]
          : [{ status: "asc" }, { updatedAt: "desc" }]
    });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      price: Number(p.price),
      stock: p.stock,
      categoryName: p.category.name,
      shopId: p.shop.id,
      shopName: p.shop.name,
      shopArchivedAt: p.shop.archivedAt?.toISOString() ?? null,
      merchantUserId: p.shop.merchantProfile.user.id,
      merchantEmail: p.shop.merchantProfile.user.email,
      merchantName: p.shop.merchantProfile.user.fullName,
      moderationReason: p.moderationReason,
      moderatedAt: p.moderatedAt?.toISOString() ?? null,
      resubmissionCount: p.resubmissionCount,
      resubmittedAt: p.resubmittedAt?.toISOString() ?? null,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      updatedAt: p.updatedAt.toISOString(),
      orderCount: p._count.orders
    }));
  }

  async listAllShops() {
    const rows = await this.prisma.merchantShop.findMany({
      include: {
        merchantProfile: {
          select: {
            id: true,
            userId: true,
            isActive: true,
            user: { select: { id: true, email: true, fullName: true } }
          }
        },
        products: {
          select: {
            id: true,
            status: true,
            _count: { select: { orders: true } }
          }
        }
      },
      orderBy: [{ archivedAt: "asc" }, { updatedAt: "desc" }]
    });

    return rows.map((shop) => {
      const orderCount = shop.products.reduce(
        (sum, p) => sum + p._count.orders,
        0
      );
      return {
        id: shop.id,
        name: shop.name,
        description: shop.description,
        locationLabel: shop.locationLabel,
        archivedAt: shop.archivedAt?.toISOString() ?? null,
        productCount: shop.products.length,
        publishedProductCount: shop.products.filter(
          (p) => p.status === MerchantProductStatus.published
        ).length,
        orderCount,
        hasOrderHistory: orderCount > 0,
        merchantProfileId: shop.merchantProfile.id,
        merchantUserId: shop.merchantProfile.user.id,
        merchantEmail: shop.merchantProfile.user.email,
        merchantName: shop.merchantProfile.user.fullName,
        createdAt: shop.createdAt.toISOString(),
        updatedAt: shop.updatedAt.toISOString()
      };
    });
  }

  async deleteProduct(
    admin: User,
    productId: string,
    dto: DeleteMerchantProductAdminDto
  ) {
    const product = await this.prisma.merchantProduct.findUnique({
      where: { id: productId },
      include: {
        shop: {
          select: {
            merchantProfile: { select: { userId: true } }
          }
        }
      }
    });
    if (!product) {
      return { ok: false };
    }

    const snapshot = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: Number(product.price),
      stock: product.stock,
      status: product.status,
      photoUrls: product.photoUrls
    };

    const reason = dto.reason.trim();
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.merchantProduct.update({
        where: { id: product.id },
        data: {
          status: MerchantProductStatus.moderated_removed,
          disabledAt: now,
          disabledReason: MerchantProductDisabledReason.moderation,
          moderationReason: reason,
          moderatedAt: now
        }
      }),
      this.prisma.merchantProductModerationLog.create({
        data: {
          productId: product.id,
          adminUserId: admin.id,
          reason,
          productSnapshot: snapshot
        }
      })
    ]);

    await this.audit.record({
      actorUserId: admin.id,
      action: "merchant_product.moderate_remove",
      resourceType: "MerchantProduct",
      resourceId: product.id,
      metadata: { reason, productName: product.name }
    });

    const sellerId = product.shop.merchantProfile.userId;
    void this.push.sendToUser(
      sellerId,
      "Produit supprimé",
      `Votre produit « ${product.name} » a été retiré du marketplace. Motif : ${reason}`,
      { type: "merchant_product_removed", productId: product.id }
    );

    return { ok: true };
  }

  async approveResubmission(admin: User, productId: string) {
    const product = await this.prisma.merchantProduct.findUnique({
      where: { id: productId },
      include: {
        shop: {
          select: {
            merchantProfile: { select: { userId: true } }
          }
        }
      }
    });
    if (!product) {
      throw new NotFoundException("Produit introuvable");
    }
    if (product.status !== MerchantProductStatus.resubmission_review) {
      throw new ConflictException(
        "Seuls les produits en attente de re-validation peuvent être approuvés"
      );
    }

    const nextStatus =
      product.stock > 0
        ? MerchantProductStatus.published
        : MerchantProductStatus.draft;
    const now = new Date();

    const updated = await this.prisma.merchantProduct.update({
      where: { id: product.id },
      data: {
        status: nextStatus,
        publishedAt:
          nextStatus === MerchantProductStatus.published
            ? (product.publishedAt ?? now)
            : null,
        disabledAt: null,
        disabledReason: null,
        moderationReason: null,
        moderatedAt: null
      }
    });

    await this.audit.record({
      actorUserId: admin.id,
      action: "merchant_product.approve_resubmission",
      resourceType: "MerchantProduct",
      resourceId: product.id,
      metadata: {
        productName: product.name,
        status: nextStatus,
        resubmissionCount: product.resubmissionCount
      }
    });

    void this.push.sendToUser(
      product.shop.merchantProfile.userId,
      "Produit revalidé",
      nextStatus === MerchantProductStatus.published
        ? `Votre produit « ${product.name} » a été revalidé et est de nouveau visible.`
        : `Votre produit « ${product.name} » a été revalidé. Ajoutez du stock pour le publier.`,
      {
        type: "merchant_product_resubmission_approved",
        productId: product.id,
        status: nextStatus
      }
    );

    return {
      ok: true as const,
      id: updated.id,
      status: updated.status
    };
  }

  async rejectResubmission(
    admin: User,
    productId: string,
    dto: RejectMerchantProductResubmissionDto
  ) {
    const product = await this.prisma.merchantProduct.findUnique({
      where: { id: productId },
      include: {
        shop: {
          select: {
            merchantProfile: { select: { userId: true } }
          }
        }
      }
    });
    if (!product) {
      throw new NotFoundException("Produit introuvable");
    }
    if (product.status !== MerchantProductStatus.resubmission_review) {
      throw new ConflictException(
        "Seuls les produits en attente de re-validation peuvent être rejetés"
      );
    }

    const reason = dto.reason.trim();
    const now = new Date();
    const snapshot = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: Number(product.price),
      stock: product.stock,
      status: product.status,
      photoUrls: product.photoUrls
    };

    await this.prisma.$transaction([
      this.prisma.merchantProduct.update({
        where: { id: product.id },
        data: {
          status: MerchantProductStatus.moderated_removed,
          disabledAt: now,
          disabledReason: MerchantProductDisabledReason.moderation,
          moderationReason: reason,
          moderatedAt: now
        }
      }),
      this.prisma.merchantProductModerationLog.create({
        data: {
          productId: product.id,
          adminUserId: admin.id,
          reason,
          productSnapshot: snapshot
        }
      })
    ]);

    await this.audit.record({
      actorUserId: admin.id,
      action: "merchant_product.reject_resubmission",
      resourceType: "MerchantProduct",
      resourceId: product.id,
      metadata: {
        reason,
        productName: product.name,
        resubmissionCount: product.resubmissionCount
      }
    });

    void this.push.sendToUser(
      product.shop.merchantProfile.userId,
      "Re-soumission refusée",
      `Votre produit « ${product.name} » n’a pas été revalidé. Motif : ${reason}`,
      { type: "merchant_product_resubmission_rejected", productId: product.id }
    );

    return { ok: true as const, id: product.id };
  }

  async archiveShop(
    admin: User,
    shopId: string,
    dto: ArchiveMerchantShopAdminDto
  ) {
    const shop = await this.prisma.merchantShop.findUnique({
      where: { id: shopId },
      include: {
        merchantProfile: {
          select: { userId: true, user: { select: { fullName: true } } }
        }
      }
    });
    if (!shop) {
      throw new NotFoundException("Boutique introuvable");
    }

    const reason = dto.reason.trim();
    const result = await this.prisma.$transaction(async (tx) => {
      const blocking = await countBlockingOrdersForShop(tx, shop.id);
      if (blocking > 0) {
        throw shopActiveOrdersConflict(blocking);
      }
      return archiveShopInTransaction(tx, shop.id);
    });

    await this.audit.record({
      actorUserId: admin.id,
      action: "merchant_shop.archive",
      resourceType: "MerchantShop",
      resourceId: shop.id,
      metadata: {
        reason,
        unpublishedProductCount: result.productCount,
        merchantUserId: shop.merchantProfile.userId
      }
    });

    void this.push.sendToUser(
      shop.merchantProfile.userId,
      "Boutique archivée",
      `Votre boutique « ${shop.name} » a été archivée par l’administration. Motif : ${reason}`,
      { type: "merchant_shop_archived", shopId: shop.id }
    );

    return {
      ok: true as const,
      id: shop.id,
      unpublishedProductCount: result.productCount
    };
  }

  async hardDeleteShop(
    admin: User,
    shopId: string,
    dto: ArchiveMerchantShopAdminDto
  ) {
    const shop = await this.prisma.merchantShop.findUnique({
      where: { id: shopId },
      include: {
        merchantProfile: { select: { userId: true } },
        _count: { select: { products: true } }
      }
    });
    if (!shop) {
      throw new NotFoundException("Boutique introuvable");
    }

    const reason = dto.reason.trim();
    const productCount = shop._count.products;

    await this.prisma.$transaction(async (tx) => {
      const orders = await countAnyOrdersForShop(tx, shop.id);
      if (orders > 0) {
        throw shopOrderHistoryConflict(orders);
      }
      await allowMerchantCatalogHardDelete(tx);
      await tx.merchantShop.delete({ where: { id: shop.id } });
    });

    await this.audit.record({
      actorUserId: admin.id,
      action: "merchant_shop.hard_delete",
      resourceType: "MerchantShop",
      resourceId: shop.id,
      metadata: {
        reason,
        shopName: shop.name,
        productCount,
        merchantUserId: shop.merchantProfile.userId
      }
    });

    void this.push.sendToUser(
      shop.merchantProfile.userId,
      "Boutique supprimée",
      `Votre boutique « ${shop.name} » a été définitivement supprimée. Motif : ${reason}`,
      { type: "merchant_shop_deleted", shopId: shop.id }
    );

    return { ok: true as const, id: shop.id };
  }

  /**
   * Diagnostic incident « boutique disparue » :
   * - boutiques dont le user n’a plus de Profile merchant actif ;
   * - MerchantProfile inactif ;
   * - produits published sur boutique archivée ou orpheline.
   */
  async listOrphans() {
    const [merchantProfiles, publishedOnArchived] = await Promise.all([
      this.prisma.merchantProfile.findMany({
        select: {
          id: true,
          userId: true,
          isActive: true,
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              profiles: {
                where: { type: ProfileType.merchant },
                select: { id: true, profileStatus: true }
              }
            }
          },
          shops: {
            select: {
              id: true,
              name: true,
              archivedAt: true,
              merchantProfileId: true,
              products: {
                where: { status: MerchantProductStatus.published },
                select: { id: true, name: true, status: true }
              }
            }
          }
        }
      }),
      this.prisma.merchantProduct.findMany({
        where: {
          status: MerchantProductStatus.published,
          shop: { archivedAt: { not: null } }
        },
        select: {
          id: true,
          name: true,
          shop: { select: { id: true, name: true } }
        }
      })
    ]);

    const orphanShops: Array<{
      id: string;
      name: string;
      merchantProfileId: string;
      merchantUserId: string;
      merchantEmail: string | null;
      reason: string;
      archivedAt: string | null;
    }> = [];

    const publishedOnBadShop: Array<{
      id: string;
      name: string;
      shopId: string;
      shopName: string;
      reason: string;
    }> = [];

    for (const profile of merchantProfiles) {
      const merchantAppProfile = profile.user.profiles[0] ?? null;
      const noMerchantAppProfile =
        !merchantAppProfile || merchantAppProfile.profileStatus !== "active";
      const inactiveMerchant = !profile.isActive;

      for (const shop of profile.shops) {
        const reasons: string[] = [];
        if (noMerchantAppProfile) {
          reasons.push("missing_or_inactive_merchant_profile");
        }
        if (inactiveMerchant) {
          reasons.push("merchant_profile_inactive");
        }

        if (reasons.length > 0) {
          orphanShops.push({
            id: shop.id,
            name: shop.name,
            merchantProfileId: shop.merchantProfileId,
            merchantUserId: profile.userId,
            merchantEmail: profile.user.email,
            reason: reasons.join(","),
            archivedAt: shop.archivedAt?.toISOString() ?? null
          });
          for (const product of shop.products) {
            publishedOnBadShop.push({
              id: product.id,
              name: product.name,
              shopId: shop.id,
              shopName: shop.name,
              reason: `orphan_shop:${reasons.join(",")}`
            });
          }
        }
      }
    }

    for (const product of publishedOnArchived) {
      publishedOnBadShop.push({
        id: product.id,
        name: product.name,
        shopId: product.shop.id,
        shopName: product.shop.name,
        reason: "published_on_archived_shop"
      });
    }

    const productMap = new Map(publishedOnBadShop.map((p) => [p.id, p]));

    return {
      orphanShops,
      publishedOnArchivedOrOrphanShop: [...productMap.values()],
      counts: {
        orphanShops: orphanShops.length,
        publishedIssues: productMap.size
      }
    };
  }

  async setMerchantTier(userId: string, tier: MerchantSubscriptionTier) {
    await this.prisma.merchantProfile.upsert({
      where: { userId },
      create: {
        userId,
        subscriptionTier: tier,
        subscriptionChosenAt: new Date()
      },
      update: { subscriptionTier: tier }
    });
    if (tier === MerchantSubscriptionTier.free) {
      await this.subscription.downgradeToFree(userId);
    }
    return { ok: true };
  }
}
