import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MERCHANT_ERROR } from "./merchant-shop.constants";
import { MerchantProfilesService } from "./merchant-profiles.service";
import type {
  CreateMerchantShopDto,
  UpdateMerchantShopDto
} from "./dto/merchant-shop.dto";

@Injectable()
export class MerchantShopsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: MerchantProfilesService
  ) {}

  async list(user: User) {
    const profile = await this.profiles.requireProfile(user.id);
    return profile.shops.map((shop) => ({
      id: shop.id,
      name: shop.name,
      description: shop.description,
      locationLabel: shop.locationLabel,
      productCount: shop.products.length,
      activeProductCount: this.profiles.countActiveProducts(shop.products),
      createdAt: shop.createdAt.toISOString(),
      updatedAt: shop.updatedAt.toISOString()
    }));
  }

  async create(user: User, dto: CreateMerchantShopDto) {
    const profile = await this.profiles.requireProfile(user.id);
    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: "default" }
    });
    const maxShops = this.profiles.maxShopsForTier(
      profile.subscriptionTier,
      settings?.merchantPremiumMaxShops ?? 3
    );
    if (profile.shops.length >= maxShops) {
      throw new ForbiddenException({
        statusCode: 403,
        code: MERCHANT_ERROR.SHOP_LIMIT,
        message: "Limite de boutiques atteinte pour votre abonnement"
      });
    }

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

  private async requireOwnedShop(userId: string, shopId: string) {
    const shop = await this.prisma.merchantShop.findFirst({
      where: {
        id: shopId,
        merchantProfile: { userId }
      }
    });
    if (!shop) {
      throw new NotFoundException("Boutique introuvable");
    }
    return shop;
  }
}
