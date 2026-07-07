import { Injectable } from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  MerchantProductDisabledReason,
  MerchantProductStatus,
  MerchantSubscriptionTier
} from "@prisma/client";
import { PushNotificationsService } from "../push-notifications/push-notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { MerchantSubscriptionService } from "./merchant-subscription.service";
import type { DeleteMerchantProductAdminDto } from "./dto/merchant-shop.dto";

@Injectable()
export class MerchantModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushNotificationsService,
    private readonly subscription: MerchantSubscriptionService
  ) {}

  async listAllProducts() {
    const rows = await this.prisma.merchantProduct.findMany({
      include: {
        category: { select: { id: true, name: true } },
        shop: {
          select: {
            id: true,
            name: true,
            merchantProfile: {
              select: {
                user: { select: { id: true, email: true, fullName: true } }
              }
            }
          }
        }
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
    });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      price: Number(p.price),
      stock: p.stock,
      categoryName: p.category.name,
      shopName: p.shop.name,
      merchantUserId: p.shop.merchantProfile.user.id,
      merchantEmail: p.shop.merchantProfile.user.email,
      merchantName: p.shop.merchantProfile.user.fullName,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      updatedAt: p.updatedAt.toISOString()
    }));
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

    await this.prisma.$transaction([
      this.prisma.merchantProduct.update({
        where: { id: product.id },
        data: {
          status: MerchantProductStatus.moderated_removed,
          disabledAt: new Date(),
          disabledReason: MerchantProductDisabledReason.moderation
        }
      }),
      this.prisma.merchantProductModerationLog.create({
        data: {
          productId: product.id,
          adminUserId: admin.id,
          reason: dto.reason.trim(),
          productSnapshot: snapshot
        }
      })
    ]);

    const sellerId = product.shop.merchantProfile.userId;
    void this.push.sendToUser(
      sellerId,
      "Produit supprimé",
      `Votre produit « ${product.name} » a été retiré du marketplace. Motif : ${dto.reason.trim()}`,
      { type: "merchant_product_removed", productId: product.id }
    );

    return { ok: true };
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
