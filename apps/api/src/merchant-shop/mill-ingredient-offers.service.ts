import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { MerchantProductStatus, Prisma } from "@prisma/client";
import { FeedIngredientsService } from "../feed-ingredients/feed-ingredients.service";
import { PlatformFeatureFlagsService } from "../feature-flags/platform-feature-flags.service";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateMillIngredientOfferDto,
  UpdateMillIngredientOfferDto
} from "./dto/mill-ingredient-offer.dto";
import { isMill } from "./merchant-kind.util";
import { MerchantCategoriesService } from "./merchant-categories.service";
import { MerchantProfilesService } from "./merchant-profiles.service";
import {
  packagingUnitLabel,
  pricePerKg,
  resolveUnitToKg
} from "./mill-ingredient-packaging.util";

/**
 * Offres d'intrants moulin.
 *
 * Stratégie marketplace : synchronisation vers MerchantProduct quand
 * isPubliclyListed=true — réutilise le flux commande / modération existant.
 * Les offres privées (composition) ne créent jamais de produit public.
 * Une seule source de prix : MillIngredientOffer (pas de double saisie).
 */
@Injectable()
export class MillIngredientOffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: MerchantProfilesService,
    private readonly categories: MerchantCategoriesService,
    private readonly feedIngredients: FeedIngredientsService,
    private readonly platformFlags: PlatformFeatureFlagsService
  ) {}

  private async assertMillAccess(userId: string) {
    const millsActive = await this.platformFlags.isModuleActiveForUser(
      "mills",
      userId
    );
    if (!millsActive) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        code: "MODULE_INACTIVE",
        moduleId: "mills",
        message: "Module moulins indisponible"
      });
    }
    await this.profiles.ensureProfile(userId);
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { userId },
      select: { id: true, userId: true, merchantKind: true }
    });
    if (!profile || !isMill(profile)) {
      throw new ForbiddenException({
        statusCode: 403,
        code: "MILL_PROFILE_REQUIRED",
        message: "Réservé aux profils moulin"
      });
    }
    return profile;
  }

  async searchIngredients(user: User, q?: string) {
    await this.assertMillAccess(user.id);
    return this.feedIngredients.list({ q, includeInactive: false });
  }

  async listMine(user: User) {
    const mill = await this.assertMillAccess(user.id);
    const rows = await this.prisma.millIngredientOffer.findMany({
      where: { millProfileId: mill.id },
      include: {
        feedIngredient: {
          select: {
            id: true,
            canonicalName: true,
            aliases: true,
            category: true,
            imageUrl: true,
            iconKey: true
          }
        },
        merchantProduct: {
          select: { id: true, status: true, stock: true }
        }
      },
      orderBy: [{ updatedAt: "desc" }]
    });
    return rows.map((r) => this.toDto(r));
  }

  async listAdmin(opts?: { millProfileId?: string; publiclyListedOnly?: boolean }) {
    const rows = await this.prisma.millIngredientOffer.findMany({
      where: {
        ...(opts?.millProfileId ? { millProfileId: opts.millProfileId } : {}),
        ...(opts?.publiclyListedOnly ? { isPubliclyListed: true } : {})
      },
      include: {
        feedIngredient: {
          select: {
            id: true,
            canonicalName: true,
            category: true
          }
        },
        millProfile: {
          select: {
            id: true,
            merchantKind: true,
            user: { select: { id: true, email: true, fullName: true } }
          }
        },
        merchantProduct: {
          select: { id: true, status: true, stock: true, moderationReason: true }
        }
      },
      orderBy: [{ updatedAt: "desc" }]
    });
    return rows.map((r) => ({
      ...this.toDto(r),
      millUserId: r.millProfile.user.id,
      millEmail: r.millProfile.user.email,
      millName: r.millProfile.user.fullName,
      merchantProductStatus: r.merchantProduct?.status ?? null,
      moderationReason: r.merchantProduct?.moderationReason ?? null
    }));
  }

  async create(user: User, dto: CreateMillIngredientOfferDto) {
    const mill = await this.assertMillAccess(user.id);
    await this.feedIngredients.getById(dto.feedIngredientId);

    const unitToKg = resolveUnitToKg(dto.packaging, dto.unitToKg);
    try {
      const created = await this.prisma.millIngredientOffer.create({
        data: {
          millProfileId: mill.id,
          feedIngredientId: dto.feedIngredientId,
          pricePerUnit: new Prisma.Decimal(dto.pricePerUnit),
          packaging: dto.packaging,
          unitToKg: new Prisma.Decimal(unitToKg),
          stockQuantity: new Prisma.Decimal(dto.stockQuantity),
          mixingCostPerKg:
            dto.mixingCostPerKg != null
              ? new Prisma.Decimal(dto.mixingCostPerKg)
              : null,
          isPubliclyListed: dto.isPubliclyListed ?? false
        }
      });
      await this.syncMarketplaceProduct(user, created.id);
      return this.getMineById(mill.id, created.id);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException(
          "Une offre existe déjà pour cet intrant et ce conditionnement"
        );
      }
      throw e;
    }
  }

  async update(user: User, offerId: string, dto: UpdateMillIngredientOfferDto) {
    const mill = await this.assertMillAccess(user.id);
    const existing = await this.prisma.millIngredientOffer.findFirst({
      where: { id: offerId, millProfileId: mill.id }
    });
    if (!existing) {
      throw new NotFoundException("Offre d'intrant introuvable");
    }

    const packaging = dto.packaging ?? existing.packaging;
    const unitToKg = resolveUnitToKg(
      packaging,
      dto.unitToKg ?? Number(existing.unitToKg)
    );

    await this.prisma.millIngredientOffer.update({
      where: { id: offerId },
      data: {
        ...(dto.pricePerUnit !== undefined
          ? { pricePerUnit: new Prisma.Decimal(dto.pricePerUnit) }
          : {}),
        ...(dto.packaging !== undefined ? { packaging: dto.packaging } : {}),
        unitToKg: new Prisma.Decimal(unitToKg),
        ...(dto.stockQuantity !== undefined
          ? { stockQuantity: new Prisma.Decimal(dto.stockQuantity) }
          : {}),
        ...(dto.mixingCostPerKg !== undefined
          ? {
              mixingCostPerKg:
                dto.mixingCostPerKg == null
                  ? null
                  : new Prisma.Decimal(dto.mixingCostPerKg)
            }
          : {}),
        ...(dto.isPubliclyListed !== undefined
          ? { isPubliclyListed: dto.isPubliclyListed }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {})
      }
    });

    await this.syncMarketplaceProduct(user, offerId);
    return this.getMineById(mill.id, offerId);
  }

  async deactivate(user: User, offerId: string) {
    return this.update(user, offerId, {
      isActive: false,
      isPubliclyListed: false
    });
  }

  /**
   * Synchronise (ou dépublie) le MerchantProduct lié.
   * Réutilise le flux commande : le produit public est un MerchantProduct normal.
   */
  async syncMarketplaceProduct(user: User, offerId: string) {
    const offer = await this.prisma.millIngredientOffer.findUnique({
      where: { id: offerId },
      include: {
        feedIngredient: {
          select: {
            canonicalName: true,
            category: true,
            imageUrl: true,
            iconKey: true
          }
        },
        millProfile: { select: { userId: true, subscriptionTier: true } }
      }
    });
    if (!offer) return;

    const shouldList =
      offer.isActive &&
      offer.isPubliclyListed &&
      Number(offer.stockQuantity) > 0;

    /** Photo réelle si dispo, sinon marqueur pictogramme pour l'UI mobile/marketplace. */
    const photoUrls = resolveIngredientPhotoUrls(offer.feedIngredient);

    if (!shouldList) {
      if (offer.merchantProductId) {
        await this.prisma.merchantProduct.update({
          where: { id: offer.merchantProductId },
          data: {
            status: MerchantProductStatus.draft,
            stock: Math.max(0, Math.floor(Number(offer.stockQuantity))),
            price: offer.pricePerUnit,
            unitLabel: packagingUnitLabel(offer.packaging),
            photoUrls
          }
        });
      }
      if (!offer.isPubliclyListed || !offer.isActive) {
        // Offre privée / inactive : on garde le lien produit (historique commandes)
        // mais le statut draft le retire du feed.
      }
      return;
    }

    const shopId = await this.ensureMillShop(offer.millProfileId, user.id);
    const categories = await this.categories.listPublic();
    const alimentation =
      categories.find((c) => c.slug === "alimentation") ?? categories[0];
    if (!alimentation) {
      throw new ConflictException("Catégorie alimentation indisponible");
    }

    const stock = Math.max(0, Math.floor(Number(offer.stockQuantity)));
    const name = offer.feedIngredient.canonicalName;
    const unitLabel = packagingUnitLabel(offer.packaging);
    const description = `Intrant en gros — ${name} (${unitLabel})`;

    let productId = offer.merchantProductId;
    if (productId) {
      await this.prisma.merchantProduct.update({
        where: { id: productId },
        data: {
          name,
          description,
          unitLabel,
          price: offer.pricePerUnit,
          stock,
          categoryId: alimentation.id,
          shopId,
          photoUrls
        }
      });
    } else {
      const created = await this.prisma.merchantProduct.create({
        data: {
          shopId,
          categoryId: alimentation.id,
          name,
          description,
          unitLabel,
          price: offer.pricePerUnit,
          stock,
          photoUrls,
          status: MerchantProductStatus.draft
        }
      });
      productId = created.id;
      await this.prisma.millIngredientOffer.update({
        where: { id: offerId },
        data: { merchantProductId: productId }
      });
    }

    // Publication si abonnement choisi (sinon reste draft — cohérent avec le flux marchand).
    if (offer.millProfile.subscriptionTier && stock > 0) {
      const product = await this.prisma.merchantProduct.findUnique({
        where: { id: productId }
      });
      if (
        product &&
        product.status !== MerchantProductStatus.moderated_removed &&
        product.status !== MerchantProductStatus.resubmission_review
      ) {
        await this.prisma.merchantProduct.update({
          where: { id: productId },
          data: {
            status: MerchantProductStatus.published,
            publishedAt: product.publishedAt ?? new Date(),
            disabledAt: null,
            disabledReason: null
          }
        });
      }
    }
  }

  private async ensureMillShop(millProfileId: string, userId: string) {
    const existing = await this.prisma.merchantShop.findFirst({
      where: { merchantProfileId: millProfileId, archivedAt: null },
      orderBy: { createdAt: "asc" }
    });
    if (existing) return existing.id;

    const created = await this.prisma.merchantShop.create({
      data: {
        merchantProfileId: millProfileId,
        name: "Boutique moulin",
        description: "Vente en gros d'intrants"
      }
    });
    await this.prisma.merchantProfile.update({
      where: { userId },
      data: { shopSkipped: false }
    });
    return created.id;
  }

  private async getMineById(millProfileId: string, offerId: string) {
    const row = await this.prisma.millIngredientOffer.findFirst({
      where: { id: offerId, millProfileId },
      include: {
        feedIngredient: {
          select: {
            id: true,
            canonicalName: true,
            aliases: true,
            category: true,
            imageUrl: true,
            iconKey: true
          }
        },
        merchantProduct: {
          select: { id: true, status: true, stock: true }
        }
      }
    });
    if (!row) {
      throw new NotFoundException("Offre d'intrant introuvable");
    }
    return this.toDto(row);
  }

  private toDto(row: {
    id: string;
    millProfileId: string;
    feedIngredientId: string;
    pricePerUnit: Prisma.Decimal | number;
    packaging: import("@prisma/client").MillIngredientPackaging;
    unitToKg: Prisma.Decimal | number;
    stockQuantity: Prisma.Decimal | number;
    mixingCostPerKg: Prisma.Decimal | number | null;
    isPubliclyListed: boolean;
    isActive: boolean;
    merchantProductId: string | null;
    createdAt: Date;
    updatedAt: Date;
    feedIngredient?: {
      id: string;
      canonicalName: string;
      aliases?: string[];
      category: string;
      imageUrl?: string | null;
      iconKey?: string | null;
    };
    merchantProduct?: { id: string; status: string; stock: number } | null;
  }) {
    const price = Number(row.pricePerUnit);
    const unitToKg = Number(row.unitToKg);
    const iconKey =
      row.feedIngredient?.iconKey?.trim() ||
      row.feedIngredient?.category ||
      null;
    return {
      id: row.id,
      millProfileId: row.millProfileId,
      feedIngredientId: row.feedIngredientId,
      feedIngredientName: row.feedIngredient?.canonicalName ?? null,
      feedIngredientAliases: row.feedIngredient?.aliases ?? [],
      feedIngredientCategory: row.feedIngredient?.category ?? null,
      feedIngredientImageUrl: row.feedIngredient?.imageUrl ?? null,
      feedIngredientIconKey: iconKey,
      pricePerUnit: price,
      packaging: row.packaging,
      unitToKg,
      pricePerKg: pricePerKg(price, unitToKg),
      stockQuantity: Number(row.stockQuantity),
      mixingCostPerKg:
        row.mixingCostPerKg == null ? null : Number(row.mixingCostPerKg),
      isPubliclyListed: row.isPubliclyListed,
      isActive: row.isActive,
      merchantProductId: row.merchantProductId,
      merchantProductStatus: row.merchantProduct?.status ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }
}

/** URL photo ou marqueur `fermier-icon:<key>` pour pictogramme de catégorie. */
export function resolveIngredientPhotoUrls(ing: {
  imageUrl?: string | null;
  iconKey?: string | null;
  category?: string | null;
}): string[] {
  const image = ing.imageUrl?.trim();
  if (image) return [image];
  const key = ing.iconKey?.trim() || ing.category?.trim();
  if (key) return [`fermier-icon:${key}`];
  return [];
}
