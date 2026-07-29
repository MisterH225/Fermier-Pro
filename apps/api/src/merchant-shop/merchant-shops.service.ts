import { Injectable, NotFoundException } from "@nestjs/common";
import type { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionLimitsService } from "../subscription-limits/subscription-limits.service";
import {
  archiveShopInTransaction,
  countBlockingOrdersForShop,
  shopActiveOrdersConflict
} from "./merchant-shop-archive";
import { MerchantProfilesService } from "./merchant-profiles.service";
import type {
  CreateMerchantShopDto,
  UpdateMerchantShopDto
} from "./dto/merchant-shop.dto";

@Injectable()
export class MerchantShopsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: MerchantProfilesService,
    private readonly subscriptionLimits: SubscriptionLimitsService
  ) {}

  async list(user: User) {
    const profile = await this.profiles.requireProfile(user.id);
    const shops = profile.shops.filter((shop) => shop.archivedAt == null);
    return shops.map((shop) => {
      const products = this.profiles.visibleProducts(shop.products);
      return {
        id: shop.id,
        name: shop.name,
        description: shop.description,
        locationLabel: shop.locationLabel,
        productCount: products.length,
        activeProductCount: this.profiles.countActiveProducts(products),
        createdAt: shop.createdAt.toISOString(),
        updatedAt: shop.updatedAt.toISOString()
      };
    });
  }

  async create(user: User, dto: CreateMerchantShopDto) {
    const profile = await this.profiles.requireProfile(user.id);
    await this.subscriptionLimits.assertShopCreate(profile.id);

    const shop = await this.prisma.merchantShop.create({
      data: {
        merchantProfileId: profile.id,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        locationLabel: dto.locationLabel?.trim() || null
      }
    });

    await this.prisma.merchantProfile.update({
      where: { id: profile.id },
      data: { shopSkipped: false }
    });

    return {
      id: shop.id,
      name: shop.name,
      description: shop.description,
      locationLabel: shop.locationLabel,
      createdAt: shop.createdAt.toISOString()
    };
  }

  async update(user: User, shopId: string, dto: UpdateMerchantShopDto) {
    const shop = await this.requireOwnedShop(user.id, shopId);
    const updated = await this.prisma.merchantShop.update({
      where: { id: shop.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() || null }
          : {}),
        ...(dto.locationLabel !== undefined
          ? { locationLabel: dto.locationLabel.trim() || null }
          : {})
      }
    });
    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      locationLabel: updated.locationLabel,
      updatedAt: updated.updatedAt.toISOString()
    };
  }

  /**
   * Archive la boutique (soft-delete) + dépublie ses produits.
   * Refus 409 s’il reste des commandes bloquantes.
   */
  async archiveShop(user: User, shopId: string) {
    const shop = await this.requireOwnedShop(user.id, shopId);
    return this.prisma.$transaction(async (tx) => {
      const blocking = await countBlockingOrdersForShop(tx, shop.id);
      if (blocking > 0) {
        throw shopActiveOrdersConflict(blocking);
      }
      const archivedAt = new Date();
      const { productCount } = await archiveShopInTransaction(
        tx,
        shop.id,
        archivedAt
      );
      return {
        ok: true as const,
        id: shop.id,
        archivedAt: archivedAt.toISOString(),
        unpublishedProductCount: productCount
      };
    });
  }

  async requireOwnedShop(userId: string, shopId: string) {
    const shop = await this.prisma.merchantShop.findFirst({
      where: {
        id: shopId,
        archivedAt: null,
        merchantProfile: { userId }
      }
    });
    if (!shop) {
      throw new NotFoundException("Boutique introuvable");
    }
    return shop;
  }
}
