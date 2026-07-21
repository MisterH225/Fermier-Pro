import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  MerchantOrderStatus,
  MerchantProductDisabledReason,
  MerchantProductStatus,
  MerchantSubscriptionTier,
  Prisma
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  MERCHANT_ERROR,
  MERCHANT_FREE_MAX_ACTIVE_PRODUCTS,
  MERCHANT_PRODUCT_MAX_RESUBMISSIONS,
  MERCHANT_SHOP_ARCHIVE_BLOCKING_STATUSES
} from "./merchant-shop.constants";
import { MerchantProfilesService } from "./merchant-profiles.service";
import type {
  CreateMerchantProductDto,
  UpdateMerchantProductDto
} from "./dto/merchant-shop.dto";

/** Commandes comptées comme achats marketplace (hors échecs / annulations). */
const PURCHASE_COUNTED_STATUSES: MerchantOrderStatus[] = [
  MerchantOrderStatus.paid,
  MerchantOrderStatus.confirmed,
  MerchantOrderStatus.shipping,
  MerchantOrderStatus.delivered,
  MerchantOrderStatus.completed
];

type ProductStats = {
  favoriteCount?: number;
  purchaseCount?: number;
  unitsSold?: number;
};

@Injectable()
export class MerchantProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: MerchantProfilesService
  ) {}

  private serializeProduct(
    product: {
      id: string;
      shopId: string;
      categoryId: string;
      name: string;
      description: string | null;
      unitLabel?: string | null;
      price: Prisma.Decimal;
      currency: string;
      photoUrls: unknown;
      stock: number;
      viewCount?: number;
      status: MerchantProductStatus;
      publishedAt: Date | null;
      disabledAt: Date | null;
      disabledReason: MerchantProductDisabledReason | null;
      moderationReason?: string | null;
      moderatedAt?: Date | null;
      resubmissionCount?: number;
      resubmittedAt?: Date | null;
      createdAt: Date;
      updatedAt: Date;
      category?: { id: string; name: string; slug: string };
      shop?: { id: string; name: string };
      _count?: { favorites?: number };
    },
    stats?: ProductStats
  ) {
    const photos = Array.isArray(product.photoUrls)
      ? product.photoUrls.filter((u): u is string => typeof u === "string")
      : [];
    return {
      id: product.id,
      shopId: product.shopId,
      shopName: product.shop?.name ?? null,
      categoryId: product.categoryId,
      categoryName: product.category?.name ?? null,
      name: product.name,
      description: product.description,
      unitLabel: product.unitLabel?.trim() || null,
      price: Number(product.price),
      currency: product.currency,
      photoUrls: photos,
      stock: product.stock,
      viewCount: product.viewCount ?? 0,
      favoriteCount: stats?.favoriteCount ?? product._count?.favorites ?? 0,
      purchaseCount: stats?.purchaseCount ?? 0,
      unitsSold: stats?.unitsSold ?? 0,
      status: product.status,
      publishedAt: product.publishedAt?.toISOString() ?? null,
      disabledAt: product.disabledAt?.toISOString() ?? null,
      disabledReason: product.disabledReason,
      moderationReason: product.moderationReason ?? null,
      moderatedAt: product.moderatedAt?.toISOString() ?? null,
      resubmissionCount: product.resubmissionCount ?? 0,
      resubmittedAt: product.resubmittedAt?.toISOString() ?? null,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString()
    };
  }

  private async salesByProductIds(
    productIds: string[]
  ): Promise<Map<string, { purchaseCount: number; unitsSold: number }>> {
    const map = new Map<string, { purchaseCount: number; unitsSold: number }>();
    if (productIds.length === 0) {
      return map;
    }
    const rows = await this.prisma.merchantOrder.groupBy({
      by: ["productId"],
      where: {
        productId: { in: productIds },
        status: { in: PURCHASE_COUNTED_STATUSES }
      },
      _count: { _all: true },
      _sum: { quantity: true }
    });
    for (const row of rows) {
      map.set(row.productId, {
        purchaseCount: row._count._all,
        unitsSold: row._sum.quantity ?? 0
      });
    }
    return map;
  }

  private async serializeOwnedProduct(product: {
    id: string;
    shopId: string;
    categoryId: string;
    name: string;
    description: string | null;
    unitLabel?: string | null;
    price: Prisma.Decimal;
    currency: string;
    photoUrls: unknown;
    stock: number;
    viewCount?: number;
    status: MerchantProductStatus;
    publishedAt: Date | null;
    disabledAt: Date | null;
    disabledReason: MerchantProductDisabledReason | null;
    moderationReason?: string | null;
    moderatedAt?: Date | null;
    resubmissionCount?: number;
    resubmittedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    category?: { id: string; name: string; slug: string };
    shop?: { id: string; name: string };
    _count?: { favorites?: number };
  }) {
    const salesMap = await this.salesByProductIds([product.id]);
    const sales = salesMap.get(product.id);
    const favoriteCount =
      product._count?.favorites ??
      (await this.prisma.buyerMerchantFavorite.count({
        where: { productId: product.id }
      }));
    return this.serializeProduct(product, {
      favoriteCount,
      purchaseCount: sales?.purchaseCount ?? 0,
      unitsSold: sales?.unitsSold ?? 0
    });
  }

  async listMine(user: User) {
    const profile = await this.profiles.requireProfile(user.id);
    const shopIds = profile.shops
      .filter((s) => s.archivedAt == null)
      .map((s) => s.id);
    const products = await this.prisma.merchantProduct.findMany({
      where: { shopId: { in: shopIds } },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        shop: { select: { id: true, name: true } },
        _count: { select: { favorites: true } }
      },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }]
    });
    // Filtre JS : évite un WHERE enum qui casse getMe/list si la migration
    // `merchant_deleted` n'est pas encore appliquée en base.
    const visible = products.filter(
      (p) =>
        p.disabledReason !== MerchantProductDisabledReason.merchant_deleted
    );
    const salesMap = await this.salesByProductIds(visible.map((p) => p.id));
    return visible.map((p) => {
      const sales = salesMap.get(p.id);
      return this.serializeProduct(p, {
        favoriteCount: p._count.favorites,
        purchaseCount: sales?.purchaseCount ?? 0,
        unitsSold: sales?.unitsSold ?? 0
      });
    });
  }

  async getMine(user: User, productId: string) {
    const product = await this.requireOwnedProduct(user.id, productId);
    if (
      product.disabledReason === MerchantProductDisabledReason.merchant_deleted
    ) {
      throw new NotFoundException("Produit introuvable");
    }
    const full = await this.prisma.merchantProduct.findUniqueOrThrow({
      where: { id: product.id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        shop: { select: { id: true, name: true } },
        _count: { select: { favorites: true } }
      }
    });
    const salesMap = await this.salesByProductIds([full.id]);
    const sales = salesMap.get(full.id);
    return this.serializeProduct(full, {
      favoriteCount: full._count.favorites,
      purchaseCount: sales?.purchaseCount ?? 0,
      unitsSold: sales?.unitsSold ?? 0
    });
  }

  async create(user: User, shopId: string, dto: CreateMerchantProductDto) {
    await this.requireOwnedShop(user.id, shopId);
    const category = await this.requireActiveCategory(dto.categoryId);

    const product = await this.prisma.merchantProduct.create({
      data: {
        shopId,
        categoryId: category.id,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        unitLabel: dto.unitLabel?.trim() || null,
        price: new Prisma.Decimal(dto.price),
        photoUrls: dto.photoUrls ?? [],
        stock: dto.stock
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        shop: { select: { id: true, name: true } },
        _count: { select: { favorites: true } }
      }
    });

    await this.prisma.merchantProfile.update({
      where: { userId: user.id },
      data: { productSkipped: false }
    });

    return this.serializeProduct(product, {
      favoriteCount: 0,
      purchaseCount: 0,
      unitsSold: 0
    });
  }

  async update(user: User, productId: string, dto: UpdateMerchantProductDto) {
    const product = await this.requireOwnedProduct(user.id, productId);
    if (dto.categoryId) {
      await this.requireActiveCategory(dto.categoryId);
    }

    const updated = await this.prisma.merchantProduct.update({
      where: { id: product.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() || null }
          : {}),
        ...(dto.unitLabel !== undefined
          ? { unitLabel: dto.unitLabel?.trim() || null }
          : {}),
        ...(dto.price !== undefined
          ? { price: new Prisma.Decimal(dto.price) }
          : {}),
        ...(dto.photoUrls !== undefined ? { photoUrls: dto.photoUrls } : {}),
        ...(dto.stock !== undefined ? { stock: dto.stock } : {})
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        shop: { select: { id: true, name: true } },
        _count: { select: { favorites: true } }
      }
    });
    const salesMap = await this.salesByProductIds([updated.id]);
    const sales = salesMap.get(updated.id);
    return this.serializeProduct(updated, {
      favoriteCount: updated._count.favorites,
      purchaseCount: sales?.purchaseCount ?? 0,
      unitsSold: sales?.unitsSold ?? 0
    });
  }

  async publish(user: User, productId: string) {
    const tier = await this.profiles.assertSubscriptionChosen(user.id);
    const product = await this.requireOwnedProduct(user.id, productId);

    if (
      product.status === MerchantProductStatus.published ||
      product.status === MerchantProductStatus.moderated_removed ||
      product.status === MerchantProductStatus.resubmission_review
    ) {
      throw new ConflictException(
        "Produit déjà publié, retiré par modération ou en attente de re-validation"
      );
    }

    if (tier === MerchantSubscriptionTier.free) {
      const activeCount = await this.countActiveProductsForUser(user.id);
      if (activeCount >= MERCHANT_FREE_MAX_ACTIVE_PRODUCTS) {
        throw new ForbiddenException({
          statusCode: 403,
          code: MERCHANT_ERROR.ACTIVE_PRODUCT_LIMIT,
          message: "Limite de 5 produits actifs atteinte (abonnement Free)"
        });
      }
    }

    if (product.stock <= 0) {
      throw new ForbiddenException("Stock insuffisant pour publication");
    }

    const updated = await this.prisma.merchantProduct.update({
      where: { id: product.id },
      data: {
        status: MerchantProductStatus.published,
        publishedAt: new Date(),
        disabledAt: null,
        disabledReason: null
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        shop: { select: { id: true, name: true } }
      }
    });

    await this.prisma.merchantProfile.update({
      where: { userId: user.id },
      data: { onboardingComplete: true, productSkipped: false }
    });

    return this.serializeOwnedProduct(updated);
  }

  /**
   * Re-soumission après retrait modération — pas de republication libre :
   * le produit passe en file superadmin (resubmission_review).
   */
  async resubmit(user: User, productId: string) {
    const product = await this.requireOwnedProduct(user.id, productId);

    if (product.status !== MerchantProductStatus.moderated_removed) {
      throw new ConflictException({
        statusCode: 409,
        code: MERCHANT_ERROR.RESUBMISSION_INVALID_STATUS,
        message: "Seuls les produits retirés par modération peuvent être re-soumis"
      });
    }

    if (product.resubmissionCount >= MERCHANT_PRODUCT_MAX_RESUBMISSIONS) {
      throw new ForbiddenException({
        statusCode: 403,
        code: MERCHANT_ERROR.RESUBMISSION_LIMIT,
        message:
          "Limite de re-soumissions atteinte. Contactez le support pour une nouvelle revue."
      });
    }

    const now = new Date();
    const updated = await this.prisma.merchantProduct.update({
      where: { id: product.id },
      data: {
        status: MerchantProductStatus.resubmission_review,
        resubmissionCount: { increment: 1 },
        resubmittedAt: now,
        disabledAt: null,
        disabledReason: null
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        shop: { select: { id: true, name: true } }
      }
    });

    return this.serializeOwnedProduct(updated);
  }

  async unpublish(user: User, productId: string) {
    const product = await this.requireOwnedProduct(user.id, productId);
    if (product.status !== MerchantProductStatus.published) {
      throw new ConflictException("Seuls les produits publiés peuvent être dépubliés");
    }
    const updated = await this.prisma.merchantProduct.update({
      where: { id: product.id },
      data: {
        status: MerchantProductStatus.draft,
        publishedAt: null,
        disabledAt: null,
        disabledReason: null
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        shop: { select: { id: true, name: true } }
      }
    });
    return this.serializeOwnedProduct(updated);
  }

  /**
   * Soft-delete commerçant : retire le produit du catalogue et de la liste boutique.
   * Refus 409 s’il reste des commandes bloquantes sur ce produit.
   */
  async remove(user: User, productId: string) {
    const product = await this.requireOwnedProduct(user.id, productId);

    const blocking = await this.prisma.merchantOrder.count({
      where: {
        productId: product.id,
        status: {
          in: [
            ...MERCHANT_SHOP_ARCHIVE_BLOCKING_STATUSES
          ] as MerchantOrderStatus[]
        }
      }
    });
    if (blocking > 0) {
      throw new ConflictException({
        statusCode: 409,
        code: MERCHANT_ERROR.PRODUCT_HAS_ACTIVE_ORDERS,
        message:
          `Impossible de supprimer le produit : ${blocking} commande(s) encore en cours. ` +
          `Finalisez ou résolvez-les avant.`,
        activeOrderCount: blocking
      });
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.merchantProduct.update({
        where: { id: product.id },
        data: {
          status: MerchantProductStatus.disabled,
          publishedAt: null,
          disabledAt: now,
          disabledReason: MerchantProductDisabledReason.merchant_deleted
        }
      }),
      this.prisma.buyerMerchantFavorite.deleteMany({
        where: { productId: product.id }
      })
    ]);

    return {
      ok: true as const,
      id: product.id,
      deletedAt: now.toISOString()
    };
  }

  async swapActive(user: User, productId: string) {
    const tier = await this.profiles.assertSubscriptionChosen(user.id);
    if (tier !== MerchantSubscriptionTier.free) {
      throw new ForbiddenException(
        "Le swap actif/désactivé est réservé à l'abonnement Free"
      );
    }

    const product = await this.requireOwnedProduct(user.id, productId);
    const profile = await this.profiles.requireProfile(user.id);
    const shopIds = profile.shops.map((s) => s.id);

    if (product.status === MerchantProductStatus.published) {
      const updated = await this.prisma.merchantProduct.update({
        where: { id: product.id },
        data: {
          status: MerchantProductStatus.disabled,
          disabledAt: new Date(),
          disabledReason: MerchantProductDisabledReason.swap
        },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          shop: { select: { id: true, name: true } }
        }
      });
      return this.serializeOwnedProduct(updated);
    }

    if (product.status !== MerchantProductStatus.disabled) {
      throw new ConflictException("Seuls les produits désactivés peuvent être réactivés");
    }

    return this.prisma.$transaction(async (tx) => {
      const active = await tx.merchantProduct.findMany({
        where: {
          shopId: { in: shopIds },
          status: MerchantProductStatus.published
        },
        orderBy: { createdAt: "asc" }
      });

      if (active.length >= MERCHANT_FREE_MAX_ACTIVE_PRODUCTS) {
        const oldest = active[0]!;
        await tx.merchantProduct.update({
          where: { id: oldest.id },
          data: {
            status: MerchantProductStatus.disabled,
            disabledAt: new Date(),
            disabledReason: MerchantProductDisabledReason.swap
          }
        });
      }

      const updated = await tx.merchantProduct.update({
        where: { id: product.id },
        data: {
          status: MerchantProductStatus.published,
          publishedAt: product.publishedAt ?? new Date(),
          disabledAt: null,
          disabledReason: null
        },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          shop: { select: { id: true, name: true } }
        }
      });
      return this.serializeOwnedProduct(updated);
    });
  }

  async listCatalog(opts?: {
    categoryId?: string;
    cursor?: string;
    limit?: number;
    q?: string;
    sort?: "recent" | "price_asc" | "price_desc" | "popular";
  }) {
    const limit = Math.min(opts?.limit ?? 30, 50);
    const search = opts?.q?.trim();
    const sort = opts?.sort ?? "recent";

    const orderBy: Prisma.MerchantProductOrderByWithRelationInput[] =
      sort === "price_asc"
        ? [{ price: "asc" }, { id: "desc" }]
        : sort === "price_desc"
          ? [{ price: "desc" }, { id: "desc" }]
          : sort === "popular"
            ? [{ viewCount: "desc" as const }, { publishedAt: "desc" }, { id: "desc" }]
            : [{ publishedAt: "desc" }, { id: "desc" }];

    const rows = await this.prisma.merchantProduct.findMany({
      where: {
        status: MerchantProductStatus.published,
        stock: { gt: 0 },
        shop: {
          archivedAt: null,
          merchantProfile: {
            isActive: true,
            user: {
              profiles: {
                some: {
                  type: "merchant",
                  profileStatus: "active"
                }
              }
            }
          }
        },
        ...(opts?.categoryId ? { categoryId: opts.categoryId } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        shop: {
          select: {
            id: true,
            name: true,
            locationLabel: true,
            merchantProfile: {
              select: { user: { select: { fullName: true } } }
            }
          }
        }
      },
      orderBy,
      take: limit + 1,
      ...(opts?.cursor
        ? { cursor: { id: opts.cursor }, skip: 1 }
        : {})
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: page.map((p) => ({
        ...this.serializeProduct(p),
        shopLocation: p.shop.locationLabel,
        merchantName: p.shop.merchantProfile.user.fullName
      })),
      nextCursor: hasMore ? page[page.length - 1]!.id : null
    };
  }

  async getCatalogProduct(productId: string) {
    const product = await this.prisma.merchantProduct.findFirst({
      where: {
        id: productId,
        status: MerchantProductStatus.published,
        stock: { gt: 0 },
        shop: {
          archivedAt: null,
          merchantProfile: {
            isActive: true,
            user: {
              profiles: {
                some: {
                  type: "merchant",
                  profileStatus: "active"
                }
              }
            }
          }
        }
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        shop: {
          select: {
            id: true,
            name: true,
            description: true,
            locationLabel: true,
            merchantProfile: {
              select: { user: { select: { id: true, fullName: true } } }
            }
          }
        }
      }
    });
    if (!product) {
      throw new NotFoundException("Produit introuvable");
    }
    void this.prisma.merchantProduct
      .update({
        where: { id: product.id },
        data: { viewCount: { increment: 1 } }
      })
      .catch(() => undefined);
    return {
      ...this.serializeProduct(product),
      shopId: product.shop.id,
      shopName: product.shop.name,
      shopDescription: product.shop.description,
      shopLocation: product.shop.locationLabel,
      sellerUserId: product.shop.merchantProfile.user.id,
      merchantName: product.shop.merchantProfile.user.fullName
    };
  }

  private async countActiveProductsForUser(userId: string) {
    const profile = await this.profiles.requireProfile(userId);
    const shopIds = profile.shops.map((s) => s.id);
    return this.prisma.merchantProduct.count({
      where: {
        shopId: { in: shopIds },
        status: MerchantProductStatus.published
      }
    });
  }

  private async requireOwnedShop(userId: string, shopId: string) {
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

  async requireOwnedProduct(userId: string, productId: string) {
    const product = await this.prisma.merchantProduct.findFirst({
      where: {
        id: productId,
        shop: { merchantProfile: { userId } }
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        shop: { select: { id: true, name: true } }
      }
    });
    if (
      !product ||
      product.disabledReason === MerchantProductDisabledReason.merchant_deleted
    ) {
      throw new NotFoundException("Produit introuvable");
    }
    return product;
  }

  private async requireActiveCategory(categoryId: string) {
    const category = await this.prisma.merchantProductCategory.findFirst({
      where: { id: categoryId, isActive: true }
    });
    if (!category) {
      throw new ForbiddenException({
        statusCode: 403,
        code: MERCHANT_ERROR.CATEGORY_INACTIVE,
        message: "Catégorie invalide ou inactive"
      });
    }
    return category;
  }
}
