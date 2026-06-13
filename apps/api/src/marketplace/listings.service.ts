import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  FarmHealthRecordKind,
  ListingMarketCategory,
  ListingStatus,
  LivestockExitKind,
  OfferStatus,
  Prisma
} from "@prisma/client";
import { FarmAccessService } from "../common/farm-access.service";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { ensureFarmFinanceBootstrap } from "../finance/finance-bootstrap";
import {
  decrementLivestockBatchHeadcount,
  resolveBatchIdForAnimalExit,
  syncLivestockBatchHeadcountFromMembers
} from "../livestock/livestock-batch-headcount.helper";
import { PrismaService } from "../prisma/prisma.service";
import { PushNotificationsService } from "../push-notifications/push-notifications.service";
import { CompleteHandoverDto } from "./dto/complete-handover.dto";
import { CreateListingDto } from "./dto/create-listing.dto";
import { PublishListingDto } from "./dto/publish-listing.dto";
import { RenewListingDto } from "./dto/renew-listing.dto";
import { FarmRatingsService } from "./farm-ratings.service";
import { FarmMarketplaceLifecycleService } from "./farm-marketplace-lifecycle.service";
import { MarketplacePigPriceIndexService } from "./pig-price-index.service";
import {
  buildListingFarmInfo,
  buildListingHealthData
} from "./listing-detail-health.helper";
import { PickupListingDto } from "./dto/pickup-listing.dto";
import { UpdateListingDto } from "./dto/update-listing.dto";
import {
  listingHeadcount,
  resolveFlatListingPricing,
  resolveListingCreditEnabled,
  resolveListingMarketCategory,
  usesFlatListingPrice
} from "./marketplace-listing-category.helper";
import { LISTING_EDIT_LOCK_STATUSES } from "./escrow/transaction.utils";
import { ListingAnimalSyncService } from "./listing-animal-sync.service";
import { ProducerScoreService } from "../producer-score/producer-score.service";

function privacyDisplayName(fullName: string | null | undefined): string {
  const raw = fullName?.trim();
  if (!raw) {
    return "—";
  }
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return parts[0] ?? "—";
  }
  const lastInitial = parts[parts.length - 1]![0]?.toUpperCase() ?? "";
  return lastInitial ? `${parts[0]} ${lastInitial}.` : parts[0]!;
}

function jsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (x): x is string => typeof x === "string" && x.trim().length > 0
  );
}

type ListingAnimalPick = {
  id: string;
  photoUrl: string | null;
};

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly farmRatings: FarmRatingsService,
    private readonly push: PushNotificationsService,
    private readonly marketplaceLifecycle: FarmMarketplaceLifecycleService,
    private readonly pigPriceIndex: MarketplacePigPriceIndexService,
    private readonly listingAnimalSync: ListingAnimalSyncService,
    private readonly producerScore: ProducerScoreService
  ) {}

  private async assertProducerMayEnableCredit(
    user: User,
    creditEnabled: boolean
  ): Promise<void> {
    if (creditEnabled) {
      await this.producerScore.assertSellerCreditSalesAllowed(user.id);
    }
  }

  private async resolveFarmAndAnimal(
    user: User,
    dto: { farmId?: string; animalId?: string }
  ): Promise<{ farmId: string | null; animalId: string | null }> {
    if (dto.animalId) {
      const animal = await this.prisma.animal.findUnique({
        where: { id: dto.animalId }
      });
      if (!animal) {
        throw new BadRequestException("Animal inconnu");
      }
      await this.farmAccess.requireFarmAccess(user.id, animal.farmId);
      await this.farmAccess.requireFarmScopes(user.id, animal.farmId, [
        FARM_SCOPE.marketplaceWrite
      ]);
      if (dto.farmId && dto.farmId !== animal.farmId) {
        throw new BadRequestException(
          "farmId incoherent avec l'animal selectionne"
        );
      }
      return { farmId: animal.farmId, animalId: animal.id };
    }
    if (dto.farmId) {
      await this.farmAccess.requireFarmAccess(user.id, dto.farmId);
      await this.farmAccess.requireFarmScopes(user.id, dto.farmId, [
        FARM_SCOPE.marketplaceWrite
      ]);
      return { farmId: dto.farmId, animalId: null };
    }
    return { farmId: null, animalId: null };
  }

  private async requireMarketplaceWriteIfFarmListing(
    userId: string,
    farmId: string | null
  ) {
    if (!farmId) {
      return;
    }
    await this.farmAccess.requireFarmScopes(userId, farmId, [
      FARM_SCOPE.marketplaceWrite
    ]);
  }

  private collectPrimaryAnimalIdsForPhotoFallback(
    rows: Array<{
      animalId: string | null;
      animalIds: unknown;
      photoUrls: unknown;
      animal?: ListingAnimalPick | null;
    }>
  ): string[] {
    const ids = new Set<string>();
    for (const row of rows) {
      if (jsonStringArray(row.photoUrls).length > 0) {
        continue;
      }
      const linked = jsonStringArray(row.animalIds);
      const primary = row.animalId ?? linked[0] ?? null;
      if (!primary) {
        continue;
      }
      if (row.animal?.id === primary) {
        continue;
      }
      ids.add(primary);
    }
    return [...ids];
  }

  private async loadAnimalPhotoMap(
    animalIds: string[]
  ): Promise<Map<string, string | null>> {
    if (!animalIds.length) {
      return new Map();
    }
    const animals = await this.prisma.animal.findMany({
      where: { id: { in: animalIds } },
      select: { id: true, photoUrl: true }
    });
    return new Map(animals.map((a) => [a.id, a.photoUrl]));
  }

  private formatListingForApi<
    T extends {
      photoUrls: unknown;
      animalIds: unknown;
      animalId: string | null;
      animal?: ListingAnimalPick | null;
    }
  >(row: T, animalPhotoById: Map<string, string | null>) {
    const photoUrls = jsonStringArray(row.photoUrls);
    const animalIds = jsonStringArray(row.animalIds);
    const primaryAnimalId = row.animalId ?? animalIds[0] ?? null;
    let fallbackPhotoUrl: string | null = null;
    if (photoUrls.length === 0 && primaryAnimalId) {
      if (row.animal?.id === primaryAnimalId) {
        fallbackPhotoUrl = row.animal.photoUrl ?? null;
      } else {
        fallbackPhotoUrl = animalPhotoById.get(primaryAnimalId) ?? null;
      }
    }
    return {
      ...row,
      photoUrls,
      animalIds,
      fallbackPhotoUrl
    };
  }

  private async formatListingsForApi<
    T extends {
      photoUrls: unknown;
      animalIds: unknown;
      animalId: string | null;
      animal?: ListingAnimalPick | null;
    }
  >(rows: T[]) {
    const needIds = this.collectPrimaryAnimalIdsForPhotoFallback(rows);
    const photoMap = await this.loadAnimalPhotoMap(needIds);
    return rows.map((row) => this.formatListingForApi(row, photoMap));
  }

  private resolvedListingCategory(
    sellerCategory: ListingMarketCategory | null | undefined,
    totalWeightKg: number | null | undefined,
    animalIds: string[],
    animalId: string | null,
    quantity?: number | null
  ): ListingMarketCategory | undefined {
    const resolved = resolveListingMarketCategory(
      sellerCategory,
      totalWeightKg,
      listingHeadcount(animalIds, animalId, quantity)
    );
    return resolved ?? undefined;
  }

  private normalizeListingPricing(params: {
    category: ListingMarketCategory | undefined;
    totalWeightKg: number | null | undefined;
    pricePerKg: number | null | undefined;
    totalPrice: number | null | undefined;
    unitPrice: number | null | undefined;
    headcount: number;
  }): {
    totalWeightKg: number | null;
    pricePerKg: number | null;
    unitPrice: number | null;
    totalPrice: number;
  } {
    const {
      category,
      totalWeightKg,
      pricePerKg,
      totalPrice,
      unitPrice,
      headcount
    } = params;

    if (category && usesFlatListingPrice(category)) {
      let flat: { unitPrice: number; totalPrice: number };
      try {
        flat = resolveFlatListingPricing({
          unitPrice,
          totalPrice,
          headcount
        });
      } catch {
        throw new BadRequestException(
          "Prix forfaitaire à la tête requis pour un porcelet ou un reproducteur."
        );
      }
      const weight =
        totalWeightKg != null && totalWeightKg > 0 ? totalWeightKg : null;
      return {
        totalWeightKg: weight,
        pricePerKg: null,
        unitPrice: flat.unitPrice,
        totalPrice: flat.totalPrice
      };
    }

    if (totalWeightKg == null || totalWeightKg <= 0) {
      throw new BadRequestException("Poids total requis.");
    }
    if (pricePerKg == null || pricePerKg <= 0) {
      throw new BadRequestException("Prix au kg requis.");
    }
    const resolvedTotal =
      totalPrice != null && totalPrice > 0
        ? totalPrice
        : totalWeightKg * pricePerKg;
    if (resolvedTotal <= 0) {
      throw new BadRequestException("Prix total invalide.");
    }
    return {
      totalWeightKg,
      pricePerKg,
      unitPrice: null,
      totalPrice: resolvedTotal
    };
  }

  async create(user: User, dto: CreateListingDto) {
    const refs = await this.resolveFarmAndAnimal(user, dto);
    const photoUrls = dto.photoUrls ?? [];
    const animalIds =
      dto.animalIds ??
      (refs.animalId ? [refs.animalId] : []);
    const category = this.resolvedListingCategory(
      dto.category,
      dto.totalWeightKg ?? null,
      animalIds,
      refs.animalId,
      dto.quantity
    );
    const pricing = this.normalizeListingPricing({
      category,
      totalWeightKg: dto.totalWeightKg ?? null,
      pricePerKg: dto.pricePerKg ?? null,
      totalPrice: dto.totalPrice ?? null,
      unitPrice: dto.unitPrice ?? null,
      headcount: listingHeadcount(animalIds, refs.animalId, dto.quantity)
    });
    await this.listingAnimalSync.assertListingAnimalRules({
      category,
      animalIds
    });
    const creditEnabled = resolveListingCreditEnabled(category, dto.creditEnabled);
    await this.assertProducerMayEnableCredit(user, creditEnabled);
    const created = await this.prisma.marketplaceListing.create({
      data: {
        sellerUserId: user.id,
        farmId: refs.farmId,
        animalId: refs.animalId,
        title: dto.title,
        description: dto.description,
        unitPrice:
          pricing.unitPrice != null
            ? new Prisma.Decimal(pricing.unitPrice)
            : null,
        quantity: dto.quantity,
        currency: dto.currency ?? "XOF",
        locationLabel: dto.locationLabel,
        category,
        photoUrls: photoUrls as Prisma.InputJsonValue,
        animalIds: animalIds as Prisma.InputJsonValue,
        totalWeightKg:
          pricing.totalWeightKg != null
            ? new Prisma.Decimal(pricing.totalWeightKg)
            : null,
        pricePerKg:
          pricing.pricePerKg != null
            ? new Prisma.Decimal(pricing.pricePerKg)
            : null,
        totalPrice: new Prisma.Decimal(pricing.totalPrice),
        breedLabel: dto.breedLabel,
        creditEnabled,
        status: ListingStatus.draft
      },
      include: {
        farm: { select: { id: true, name: true } },
        animal: {
          select: {
            id: true,
            publicId: true,
            tagCode: true,
            photoUrl: true
          }
        }
      }
    });
    const [formatted] = await this.formatListingsForApi([created]);
    return formatted;
  }

  async list(
    user: User,
    mine?: boolean,
    status?: ListingStatus,
    category?: ListingMarketCategory,
    q?: string
  ) {
    const qTrim = q?.trim();
    const textFilter: Prisma.MarketplaceListingWhereInput = qTrim
      ? {
          OR: [
            { title: { contains: qTrim, mode: "insensitive" } },
            { locationLabel: { contains: qTrim, mode: "insensitive" } },
            { breedLabel: { contains: qTrim, mode: "insensitive" } },
            { farm: { is: { name: { contains: qTrim, mode: "insensitive" } } } }
          ]
        }
      : {};

    if (mine) {
      const rows = await this.prisma.marketplaceListing.findMany({
        where: {
          sellerUserId: user.id,
          archived: false,
          ...(status ? { status } : {}),
          ...(category ? { category } : {}),
          ...textFilter
        },
        orderBy: { updatedAt: "desc" },
        include: {
          farm: { select: { id: true, name: true } },
          animal: {
            select: {
              id: true,
              publicId: true,
              tagCode: true,
              photoUrl: true
            }
          }
        }
      });
      return this.formatListingsForApi(rows);
    }
    const now = new Date();
    const publicStatus =
      status && status !== ListingStatus.draft
        ? status
        : ListingStatus.published;
    const rows = await this.prisma.marketplaceListing.findMany({
      where: {
        ...(publicStatus === ListingStatus.published
          ? this.marketplaceLifecycle.publicListingWhere(now)
          : {
              status: publicStatus,
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
            }),
        ...(category ? { category } : {}),
        ...textFilter
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      include: {
        seller: {
          select: { id: true, fullName: true }
        },
        farm: { select: { id: true, name: true } },
        animal: {
          select: {
            id: true,
            publicId: true,
            tagCode: true,
            photoUrl: true
          }
        }
      }
    });
    return this.formatListingsForApi(rows);
  }

  private async farmHealthSnapshot(farmId: string) {
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const lastVac = await this.prisma.farmHealthRecord.findFirst({
      where: { farmId, kind: FarmHealthRecordKind.vaccination },
      orderBy: { occurredAt: "desc" },
      include: { vaccination: true }
    });
    const lastVet = await this.prisma.farmHealthRecord.findFirst({
      where: { farmId, kind: FarmHealthRecordKind.vet_visit },
      orderBy: { occurredAt: "desc" },
      include: { vetVisit: true }
    });
    const recentDisease = await this.prisma.farmHealthRecord.findFirst({
      where: {
        farmId,
        kind: FarmHealthRecordKind.disease,
        occurredAt: { gte: since30 }
      },
      orderBy: { occurredAt: "desc" },
      include: { disease: true }
    });
    const mortalAgg = await this.prisma.livestockExit.aggregate({
      where: {
        farmId,
        kind: LivestockExitKind.mortality,
        occurredAt: { gte: since30 }
      },
      _sum: { headcountAffected: true }
    });
    const dead = mortalAgg._sum.headcountAffected ?? 0;
    const activeHead = await this.prisma.animal.count({
      where: { farmId, status: "active" }
    });
    const ratePct =
      activeHead + dead > 0
        ? ((dead / Math.max(1, activeHead + dead)) * 100).toFixed(2)
        : "0";

    return {
      vaccinesUpToDate: Boolean(lastVac?.vaccination?.vaccineName),
      lastVaccinationAt: lastVac?.occurredAt.toISOString() ?? null,
      lastVetVisitAt: lastVet?.occurredAt.toISOString() ?? null,
      lastVetReason: lastVet?.vetVisit?.reason ?? null,
      recentDiseaseSummary: recentDisease?.disease?.diagnosis ?? null,
      mortalityRate30dPct: ratePct
    };
  }

  private async enrichListingPayload(
    listing: {
      farmId: string | null;
      animalId: string | null;
      animalIds: unknown;
      locationLabel: string | null;
      sellerUserId: string;
    },
    sellerFullName: string | null
  ) {
    let healthData: Awaited<ReturnType<typeof buildListingHealthData>> | null =
      null;
    let farmInfo: Awaited<ReturnType<typeof buildListingFarmInfo>> | null =
      null;
    let farmRatingSummary: { avg: number | null; count: number } | null = null;
    let sellerProducerScore: Awaited<
      ReturnType<ProducerScoreService["getForUser"]>
    > | null = null;

    if (listing.farmId) {
      const animalIds = this.resolveListingAnimalIds({
        animalId: listing.animalId,
        animalIds: listing.animalIds as Prisma.JsonValue
      });
      farmRatingSummary = await this.farmRatings.averageForFarm(listing.farmId);
      healthData = await buildListingHealthData(
        this.prisma,
        listing.farmId,
        animalIds
      );
      farmInfo = await buildListingFarmInfo(
        this.prisma,
        listing.farmId,
        privacyDisplayName(sellerFullName),
        listing.locationLabel,
        farmRatingSummary
      );
    }

    try {
      sellerProducerScore = await this.producerScore.getForUser(
        listing.sellerUserId
      );
    } catch {
      sellerProducerScore = null;
    }

    return { healthData, farmInfo, farmRatingSummary, sellerProducerScore };
  }

  async getById(user: User, id: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id },
      include: {
        seller: { select: { id: true, fullName: true, email: true } },
        farm: { select: { id: true, name: true } },
        animal: {
          select: {
            id: true,
            publicId: true,
            tagCode: true,
            sex: true,
            status: true,
            photoUrl: true
          }
        }
      }
    });
    if (!listing) {
      throw new NotFoundException("Annonce introuvable");
    }
    if (
      listing.status === ListingStatus.draft &&
      listing.sellerUserId !== user.id
    ) {
      throw new NotFoundException("Annonce introuvable");
    }

    const lockedForBuyer = [
      ListingStatus.reserved,
      ListingStatus.shipped,
      ListingStatus.delivered,
      ListingStatus.disputed
    ] as ListingStatus[];
    if (lockedForBuyer.includes(listing.status)) {
      const accepted = await this.prisma.marketplaceOffer.findFirst({
        where: {
          listingId: id,
          buyerUserId: user.id,
          status: { in: [OfferStatus.accepted, OfferStatus.completed] }
        }
      });
      if (listing.sellerUserId !== user.id && !accepted) {
        throw new NotFoundException("Annonce introuvable");
      }
    }

    const extra = await this.enrichListingPayload(
      listing,
      listing.seller.fullName
    );

    if (listing.sellerUserId === user.id) {
      const offers = await this.prisma.marketplaceOffer.findMany({
        where: { listingId: id },
        orderBy: { createdAt: "desc" },
        include: {
          buyer: { select: { id: true, fullName: true, email: true } }
        }
      });
      const [formatted] = await this.formatListingsForApi([listing]);
      const { seller: _ignoredSeller, ...listingRest } = formatted;
      const seller = this.sanitizeSellerForViewer(
        listing.seller,
        user.id,
        listing.sellerUserId
      );
      return { ...listingRest, ...extra, seller, offers };
    }

    const myOffers = await this.prisma.marketplaceOffer.findMany({
      where: { listingId: id, buyerUserId: user.id },
      orderBy: { createdAt: "desc" }
    });
    const [formatted] = await this.formatListingsForApi([listing]);
    const { seller: _ignoredSeller2, ...listingRest } = formatted;
    const seller = this.sanitizeSellerForViewer(
      listing.seller,
      user.id,
      listing.sellerUserId
    );
    return { ...listingRest, ...extra, seller, myOffers };
  }

  private sanitizeSellerForViewer(
    seller: { id: string; fullName: string | null; email: string | null },
    viewerUserId: string,
    sellerUserId: string
  ) {
    const isOwner = viewerUserId === sellerUserId;
    return {
      id: seller.id,
      fullName: seller.fullName,
      sellerDisplayName: privacyDisplayName(seller.fullName),
      ...(isOwner ? { email: seller.email } : {})
    };
  }

  async recordView(user: User, id: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id }
    });
    if (!listing || listing.status !== ListingStatus.published) {
      throw new NotFoundException("Annonce introuvable");
    }
    if (listing.sellerUserId === user.id) {
      return { ok: true, viewsCount: listing.viewsCount };
    }
    const updated = await this.prisma.marketplaceListing.update({
      where: { id },
      data: { viewsCount: { increment: 1 } },
      select: { viewsCount: true }
    });
    return { ok: true, viewsCount: updated.viewsCount };
  }

  async recordConsultation(user: User, id: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id }
    });
    if (!listing || listing.status !== ListingStatus.published) {
      throw new NotFoundException("Annonce introuvable");
    }
    if (listing.sellerUserId === user.id) {
      return { ok: true, consultationsCount: listing.consultationsCount };
    }
    const updated = await this.prisma.marketplaceListing.update({
      where: { id },
      data: { consultationsCount: { increment: 1 } },
      select: { consultationsCount: true }
    });
    return { ok: true, consultationsCount: updated.consultationsCount };
  }

  async update(user: User, id: string, dto: UpdateListingDto) {
    const listing = await this.requireOwnerEditable(user, id);
    await this.requireMarketplaceWriteIfFarmListing(user.id, listing.farmId);
    if (
      listing.status === ListingStatus.sold ||
      listing.status === ListingStatus.cancelled ||
      listing.status === ListingStatus.reserved
    ) {
      throw new BadRequestException(
        "Annonce non modifiable (réservée, vendue ou annulée)"
      );
    }

    const activeEscrow = await this.prisma.marketplaceTransaction.findFirst({
      where: {
        listingId: id,
        status: { in: LISTING_EDIT_LOCK_STATUSES }
      },
      select: { id: true, status: true }
    });
    if (activeEscrow) {
      throw new BadRequestException(
        "Annonce non modifiable pendant un paiement ou une transaction en cours"
      );
    }

    const effectiveAnimalIds =
      dto.animalIds !== undefined
        ? dto.animalIds
        : jsonStringArray(listing.animalIds);
    if (effectiveAnimalIds.length === 0 && listing.animalId) {
      effectiveAnimalIds.push(listing.animalId);
    }
    const effectiveCategory =
      dto.category !== undefined ? dto.category : listing.category;
    await this.listingAnimalSync.assertListingAnimalRules({
      category: effectiveCategory,
      animalIds: effectiveAnimalIds,
      excludeListingId: id
    });

    const pricingFieldsPresent =
      dto.category !== undefined ||
      dto.totalWeightKg !== undefined ||
      dto.pricePerKg !== undefined ||
      dto.totalPrice !== undefined ||
      dto.unitPrice !== undefined ||
      dto.quantity !== undefined ||
      dto.animalIds !== undefined;

    let pricingUpdate: {
      category?: ListingMarketCategory | undefined;
      totalWeightKg?: Prisma.Decimal | null;
      pricePerKg?: Prisma.Decimal | null;
      unitPrice?: Prisma.Decimal | null;
      totalPrice?: Prisma.Decimal;
    } = {};

    if (pricingFieldsPresent) {
      const nextAnimalIds =
        dto.animalIds !== undefined
          ? dto.animalIds
          : jsonStringArray(listing.animalIds);
      const nextAnimalId = listing.animalId;
      const nextWeight =
        dto.totalWeightKg !== undefined
          ? dto.totalWeightKg
          : listing.totalWeightKg != null
            ? Number(listing.totalWeightKg)
            : null;
      const nextQuantity =
        dto.quantity !== undefined ? dto.quantity : listing.quantity;
      const sellerCategory =
        dto.category !== undefined ? dto.category : listing.category;
      const normalizedCategory = this.resolvedListingCategory(
        sellerCategory,
        nextWeight,
        nextAnimalIds,
        nextAnimalId,
        nextQuantity
      );
      const nextPricePerKg =
        dto.pricePerKg !== undefined
          ? dto.pricePerKg
          : listing.pricePerKg != null
            ? Number(listing.pricePerKg)
            : null;
      const nextTotalPrice =
        dto.totalPrice !== undefined
          ? dto.totalPrice
          : listing.totalPrice != null
            ? Number(listing.totalPrice)
            : null;
      const nextUnitPrice =
        dto.unitPrice !== undefined
          ? dto.unitPrice
          : listing.unitPrice != null
            ? Number(listing.unitPrice)
            : null;
      const pricing = this.normalizeListingPricing({
        category: normalizedCategory,
        totalWeightKg: nextWeight,
        pricePerKg: nextPricePerKg,
        totalPrice: nextTotalPrice,
        unitPrice: nextUnitPrice,
        headcount: listingHeadcount(
          nextAnimalIds,
          nextAnimalId,
          nextQuantity
        )
      });

      pricingUpdate = {
        category: normalizedCategory,
        totalWeightKg:
          pricing.totalWeightKg != null
            ? new Prisma.Decimal(pricing.totalWeightKg)
            : null,
        pricePerKg:
          pricing.pricePerKg != null
            ? new Prisma.Decimal(pricing.pricePerKg)
            : null,
        unitPrice:
          pricing.unitPrice != null
            ? new Prisma.Decimal(pricing.unitPrice)
            : null,
        totalPrice: new Prisma.Decimal(pricing.totalPrice)
      };
    }

    const nextCategory = pricingUpdate.category ?? listing.category;
    const creditEnabledUpdate =
      dto.creditEnabled !== undefined ||
      dto.category !== undefined ||
      pricingFieldsPresent
        ? resolveListingCreditEnabled(
            nextCategory,
            dto.creditEnabled !== undefined
              ? dto.creditEnabled
              : listing.creditEnabled
          )
        : undefined;

    if (creditEnabledUpdate === true) {
      await this.assertProducerMayEnableCredit(user, true);
    }

    return this.prisma.marketplaceListing.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.unitPrice !== undefined
          ? {
              unitPrice:
                dto.unitPrice != null
                  ? new Prisma.Decimal(dto.unitPrice)
                  : null
            }
          : {}),
        ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.locationLabel !== undefined
          ? { locationLabel: dto.locationLabel }
          : {}),
        ...(dto.photoUrls !== undefined
          ? { photoUrls: dto.photoUrls as Prisma.InputJsonValue }
          : {}),
        ...(dto.animalIds !== undefined
          ? { animalIds: dto.animalIds as Prisma.InputJsonValue }
          : {}),
        ...pricingUpdate,
        ...(dto.breedLabel !== undefined ? { breedLabel: dto.breedLabel } : {}),
        ...(creditEnabledUpdate !== undefined
          ? { creditEnabled: creditEnabledUpdate }
          : {})
      }
    });
  }

  private async requireOwnerEditable(user: User, listingId: string) {
    const listing = await this.prisma.marketplaceListing.findFirst({
      where: { id: listingId, sellerUserId: user.id }
    });
    if (!listing) {
      throw new NotFoundException("Annonce introuvable");
    }
    return listing;
  }

  async publish(user: User, id: string, dto?: PublishListingDto) {
    const listing = await this.requireOwnerEditable(user, id);
    await this.requireMarketplaceWriteIfFarmListing(user.id, listing.farmId);
    if (listing.status !== ListingStatus.draft) {
      throw new BadRequestException("Publication impossible dans cet etat");
    }
    const durationDays = dto?.durationDays ?? 14;
    const expiresAt = new Date(
      Date.now() + durationDays * 24 * 60 * 60 * 1000
    );
    let healthSummary: Prisma.InputJsonValue | undefined;
    if (listing.farmId) {
      const snap = await this.farmHealthSnapshot(listing.farmId);
      healthSummary = snap as Prisma.InputJsonValue;
    }
    const animalIds = jsonStringArray(listing.animalIds);
    const normalizedCategory = this.resolvedListingCategory(
      listing.category,
      listing.totalWeightKg != null ? Number(listing.totalWeightKg) : null,
      animalIds,
      listing.animalId,
      listing.quantity
    );
    const pricing = this.normalizeListingPricing({
      category: normalizedCategory,
      totalWeightKg:
        listing.totalWeightKg != null ? Number(listing.totalWeightKg) : null,
      pricePerKg:
        listing.pricePerKg != null ? Number(listing.pricePerKg) : null,
      totalPrice:
        listing.totalPrice != null ? Number(listing.totalPrice) : null,
      unitPrice:
        listing.unitPrice != null ? Number(listing.unitPrice) : null,
      headcount: listingHeadcount(
        animalIds,
        listing.animalId,
        listing.quantity
      )
    });

    const publishCreditEnabled = resolveListingCreditEnabled(
      normalizedCategory,
      listing.creditEnabled
    );
    await this.assertProducerMayEnableCredit(user, publishCreditEnabled);

    return this.prisma.marketplaceListing.update({
      where: { id },
      data: {
        status: ListingStatus.published,
        publishedAt: new Date(),
        expiresAt,
        category: normalizedCategory,
        totalWeightKg:
          pricing.totalWeightKg != null
            ? new Prisma.Decimal(pricing.totalWeightKg)
            : null,
        pricePerKg:
          pricing.pricePerKg != null
            ? new Prisma.Decimal(pricing.pricePerKg)
            : null,
        unitPrice:
          pricing.unitPrice != null
            ? new Prisma.Decimal(pricing.unitPrice)
            : null,
        totalPrice: new Prisma.Decimal(pricing.totalPrice),
        creditEnabled: publishCreditEnabled,
        ...(healthSummary !== undefined ? { healthSummary } : {})
      }
    });
  }

  async renew(user: User, id: string, dto: RenewListingDto) {
    const listing = await this.requireOwnerEditable(user, id);
    await this.requireMarketplaceWriteIfFarmListing(user.id, listing.farmId);
    if (
      listing.status !== ListingStatus.expired &&
      listing.status !== ListingStatus.published
    ) {
      throw new BadRequestException(
        "Seules les annonces publiees ou expirees peuvent etre renouvelees"
      );
    }
    const expiresAt = new Date(
      Date.now() + dto.durationDays * 24 * 60 * 60 * 1000
    );
    return this.prisma.marketplaceListing.update({
      where: { id },
      data: {
        status: ListingStatus.published,
        expiresAt,
        publishedAt: listing.publishedAt ?? new Date()
      }
    });
  }

  async cancel(user: User, id: string) {
    const listing = await this.requireOwnerEditable(user, id);
    await this.requireMarketplaceWriteIfFarmListing(user.id, listing.farmId);
    if (
      listing.status === ListingStatus.sold ||
      listing.status === ListingStatus.cancelled
    ) {
      throw new BadRequestException("Annonce deja cloturee");
    }
    await this.prisma.$transaction([
      this.prisma.marketplaceOffer.updateMany({
        where: {
          listingId: id,
          status: { in: [OfferStatus.pending, OfferStatus.accepted] }
        },
        data: { status: OfferStatus.rejected }
      }),
      this.prisma.marketplaceListing.update({
        where: { id },
        data: { status: ListingStatus.cancelled }
      })
    ]);
    return this.prisma.marketplaceListing.findUnique({ where: { id } });
  }

  /**
   * Vendeur ou acheteur dont l'offre est acceptee : fixe le rendez-vous de retrait.
   * Pas de paiement in-app : la negociation aboutit sur une annonce `reserved`.
   */
  async patchPickup(user: User, listingId: string, dto: PickupListingDto) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: listingId }
    });
    if (!listing) {
      throw new NotFoundException("Annonce introuvable");
    }
    if (listing.status !== ListingStatus.reserved) {
      throw new BadRequestException(
        "Le rendez-vous de retrait ne s'applique qu'aux annonces reservees"
      );
    }
    const isSeller = listing.sellerUserId === user.id;
    const acceptedOffer = await this.prisma.marketplaceOffer.findFirst({
      where: {
        listingId,
        buyerUserId: user.id,
        status: OfferStatus.accepted
      }
    });
    if (!isSeller && !acceptedOffer) {
      throw new ForbiddenException(
        "Seul le vendeur ou l'acheteur retenu peut enregistrer le rendez-vous"
      );
    }
    if (isSeller) {
      await this.requireMarketplaceWriteIfFarmListing(user.id, listing.farmId);
    }
    return this.prisma.marketplaceListing.update({
      where: { id: listingId },
      data: {
        ...(dto.pickupAt !== undefined
          ? { pickupAt: dto.pickupAt ? new Date(dto.pickupAt) : null }
          : {}),
        ...(dto.pickupNote !== undefined ? { pickupNote: dto.pickupNote } : {})
      }
    });
  }

  /** Vendeur : conclut la vente — Cheptel + Finance + statut annonce (transaction atomique). */
  async completeHandover(
    user: User,
    listingId: string,
    dto: CompleteHandoverDto
  ) {
    const listing = await this.requireOwnerEditable(user, listingId);
    await this.requireMarketplaceWriteIfFarmListing(user.id, listing.farmId);
    if (
      listing.status !== ListingStatus.reserved &&
      listing.status !== ListingStatus.published &&
      listing.status !== ListingStatus.delivered
    ) {
      throw new BadRequestException(
        "Cloture possible uniquement pour une annonce en cours de vente"
      );
    }
    if (!listing.farmId) {
      throw new BadRequestException(
        "Annonce sans ferme : vente cheptel/finance impossible"
      );
    }

    const offer = await this.prisma.marketplaceOffer.findFirst({
      where: {
        id: dto.offerId,
        listingId,
        status: OfferStatus.accepted
      },
      include: {
        buyer: { select: { id: true, fullName: true } }
      }
    });
    if (!offer) {
      throw new BadRequestException("Offre acceptee introuvable pour cette annonce");
    }

    const soldAt = dto.soldAt ? new Date(dto.soldAt) : new Date();
    if (Number.isNaN(soldAt.getTime())) {
      throw new BadRequestException("Date de vente invalide");
    }

    const animalIds = this.resolveListingAnimalIds(listing);
    if (animalIds.length === 0) {
      throw new BadRequestException(
        "Aucun animal lie : associe au moins un animal avant de conclure la vente"
      );
    }

    await ensureFarmFinanceBootstrap(this.prisma, listing.farmId);

    const buyerName =
      offer.buyer.fullName?.trim() || offer.buyer.id.slice(0, 8);
    const weightPerAnimal =
      animalIds.length > 0 ? dto.soldWeightKg / animalIds.length : dto.soldWeightKg;
    const flatListing =
      listing.category != null && usesFlatListingPrice(listing.category);
    const unitPerHead =
      flatListing && listing.unitPrice != null
        ? Number(listing.unitPrice)
        : null;
    const pricePerAnimal =
      unitPerHead != null
        ? unitPerHead
        : animalIds.length > 0
          ? dto.totalPrice / animalIds.length
          : dto.totalPrice;

    const result = await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.marketplaceListing.findUnique({
        where: { id: listingId }
      });
      if (
        !fresh ||
        (fresh.status !== ListingStatus.reserved &&
          fresh.status !== ListingStatus.published &&
          fresh.status !== ListingStatus.delivered)
      ) {
        throw new BadRequestException("Annonce deja cloturee");
      }

      const finSettings = await tx.farmFinanceSettings.findUnique({
        where: { farmId: listing.farmId! }
      });
      const currency = finSettings?.currencyCode ?? listing.currency ?? "XOF";
      const financeCat = await tx.financeCategory.findFirst({
        where: { farmId: listing.farmId!, key: "animal_sales" }
      });

      const revenueIds: string[] = [];

      for (const animalId of animalIds) {
        const animal = await tx.animal.findFirst({
          where: { id: animalId, farmId: listing.farmId! },
          include: {
            breed: { select: { name: true } },
            penPlacements: {
              where: { endedAt: null },
              select: { id: true, penId: true }
            }
          }
        });
        if (!animal) {
          throw new BadRequestException(`Animal ${animalId} introuvable`);
        }
        if (animal.status !== "active") {
          throw new BadRequestException(
            `Animal ${animal.publicId} n'est plus actif`
          );
        }

        const tag = animal.tagCode ?? animal.publicId.slice(0, 8);
        const breedName = animal.breed?.name ?? "—";
        const label = `Vente Market ${tag} — ${breedName} — ${weightPerAnimal.toFixed(1)}kg`;
        const noteParts = [dto.notes?.trim(), `Acheteur : ${buyerName}`].filter(
          Boolean
        );

        await tx.animal.update({
          where: { id: animalId },
          data: {
            status: "sold",
            statusChangedAt: soldAt,
            soldAt,
            soldWeightKg: new Prisma.Decimal(weightPerAnimal),
            soldPrice: new Prisma.Decimal(pricePerAnimal),
            soldCurrency: currency,
            buyerName
          }
        });

        await tx.livestockStatusLog.create({
          data: {
            farmId: listing.farmId!,
            recordedByUserId: user.id,
            entityType: "animal",
            entityId: animalId,
            oldStatus: animal.status,
            newStatus: "sold",
            note: [label, `${pricePerAnimal} ${currency}`, buyerName]
              .filter(Boolean)
              .join(" · ")
          }
        });

        for (const pl of animal.penPlacements) {
          await tx.penPlacement.update({
            where: { id: pl.id },
            data: { endedAt: soldAt }
          });
        }

        const penIds = animal.penPlacements.map((pl) => pl.penId);
        const batchIdForExit = await resolveBatchIdForAnimalExit(tx, {
          farmId: listing.farmId!,
          animalId,
          livestockBatchId: animal.livestockBatchId,
          penIds
        });

        if (batchIdForExit) {
          await decrementLivestockBatchHeadcount(tx, {
            batchId: batchIdForExit,
            farmId: listing.farmId!,
            endedAt: soldAt
          });
          await syncLivestockBatchHeadcountFromMembers(
            tx,
            batchIdForExit,
            listing.farmId!
          );
        }

        await tx.livestockExit.create({
          data: {
            farmId: listing.farmId!,
            animalId,
            batchId: batchIdForExit,
            kind: LivestockExitKind.sale,
            occurredAt: soldAt,
            recordedByUserId: user.id,
            headcountAffected: 1,
            buyerName,
            price: new Prisma.Decimal(pricePerAnimal),
            currency,
            weightKg: new Prisma.Decimal(weightPerAnimal),
            note: noteParts.join(" · ") || null
          }
        });

        const revenue = await tx.farmRevenue.create({
          data: {
            farmId: listing.farmId!,
            amount: new Prisma.Decimal(pricePerAnimal),
            currency,
            label,
            category: "animal_sales",
            financeCategoryId: financeCat?.id ?? null,
            note: noteParts.join(" · ") || null,
            occurredAt: soldAt,
            createdByUserId: user.id,
            linkedEntityType: "animal",
            linkedEntityId: animalId,
            isAutoGenerated: true
          }
        });
        revenueIds.push(revenue.id);
      }

      await tx.marketplaceOffer.updateMany({
        where: {
          listingId,
          id: { not: offer.id },
          status: { in: [OfferStatus.pending, OfferStatus.countered] }
        },
        data: { status: OfferStatus.rejected }
      });

      const updatedListing = await tx.marketplaceListing.update({
        where: { id: listingId },
        data: {
          status: ListingStatus.sold,
          totalWeightKg: new Prisma.Decimal(dto.soldWeightKg),
          totalPrice: new Prisma.Decimal(dto.totalPrice)
        }
      });

      return { listing: updatedListing, revenueIds, buyerUserId: offer.buyerUserId };
    });

    const amountLabel = `${dto.totalPrice.toLocaleString("fr-FR")} ${listing.currency}`;
    void this.push.sendToUser(
      result.buyerUserId,
      "✅ Proposition acceptée",
      `Votre proposition pour « ${listing.title} » a été conclue.`,
      { type: "marketplace_sale", listingId }
    );
    void this.push.sendToUser(
      user.id,
      "🎉 Vente conclue",
      `${amountLabel} enregistré dans Finance.`,
      { type: "marketplace_sale", listingId }
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { completedTransactions: { increment: 1 } }
    });
    void this.pigPriceIndex.refreshSellerIndexWeight(user.id);

    const soldAnimalIds = this.resolveListingAnimalIds(listing);
    if (soldAnimalIds.length > 0) {
      await this.listingAnimalSync.cancelIndividualListingsForAnimals(
        soldAnimalIds,
        listingId
      );
    }

    return result.listing;
  }

  private resolveListingAnimalIds(listing: {
    animalId: string | null;
    animalIds: Prisma.JsonValue;
  }): string[] {
    const ids = new Set<string>();
    if (listing.animalId) {
      ids.add(listing.animalId);
    }
    if (Array.isArray(listing.animalIds)) {
      for (const raw of listing.animalIds) {
        if (typeof raw === "string" && raw.trim()) {
          ids.add(raw.trim());
        }
      }
    }
    return Array.from(ids);
  }

  /** Cron : expire les annonces publiees depassees. */
  async expireStaleListings(): Promise<number> {
    const now = new Date();
    const stale = await this.prisma.marketplaceListing.findMany({
      where: {
        status: ListingStatus.published,
        expiresAt: { lt: now }
      },
      select: { id: true, sellerUserId: true, title: true }
    });
    if (!stale.length) {
      return 0;
    }
    await this.prisma.marketplaceListing.updateMany({
      where: { id: { in: stale.map((s) => s.id) } },
      data: { status: ListingStatus.expired }
    });
    for (const row of stale) {
      void this.push.sendToUser(
        row.sellerUserId,
        "Annonce expirée",
        `« ${row.title} » n'est plus visible sur le marché. Vous pouvez la renouveler.`,
        { type: "marketplace_expired", listingId: row.id }
      );
    }
    return stale.length;
  }

  /** Détail annonce pour la console superadmin (sans restriction de visibilité). */
  async getForAdmin(id: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id },
      include: {
        seller: { select: { id: true, fullName: true, email: true } },
        farm: { select: { id: true, name: true } },
        animal: {
          select: {
            id: true,
            publicId: true,
            tagCode: true,
            sex: true,
            status: true,
            photoUrl: true
          }
        },
        reservedForBuyer: { select: { id: true, fullName: true, email: true } },
        offers: {
          orderBy: { createdAt: "desc" },
          include: {
            buyer: { select: { id: true, fullName: true, email: true } },
            transaction: { select: { id: true, status: true } }
          }
        },
        transactions: {
          orderBy: { updatedAt: "desc" },
          include: {
            buyer: { select: { id: true, fullName: true, email: true } },
            seller: { select: { id: true, fullName: true, email: true } }
          }
        }
      }
    });
    if (!listing) {
      throw new NotFoundException("Annonce introuvable");
    }

    const extra = await this.enrichListingPayload(
      listing,
      listing.seller.fullName
    );
    const [formatted] = await this.formatListingsForApi([listing]);
    const {
      seller: _seller,
      farm: _farm,
      animal: _animal,
      reservedForBuyer: _reserved,
      offers: _offers,
      transactions: _transactions,
      ...listingFields
    } = formatted;

    return {
      ...this.serializeListingScalars(listingFields),
      seller: listing.seller,
      farm: listing.farm,
      animal: listing.animal,
      reservedForBuyer: listing.reservedForBuyer,
      ...extra,
      offers: listing.offers.map((offer) => ({
        id: offer.id,
        status: offer.status,
        offerType: offer.offerType,
        offeredPrice: Number(offer.offeredPrice),
        message: offer.message,
        createdAt: offer.createdAt.toISOString(),
        buyer: offer.buyer,
        transaction: offer.transaction
      })),
      transactions: listing.transactions.map((tx) => ({
        id: tx.id,
        status: tx.status,
        blockedAmount: Number(tx.blockedAmount),
        finalAmount: tx.finalAmount != null ? Number(tx.finalAmount) : null,
        currency: tx.currency,
        updatedAt: tx.updatedAt.toISOString(),
        buyer: tx.buyer,
        seller: tx.seller
      }))
    };
  }

  private serializeListingScalars<
    T extends {
      totalWeightKg?: unknown;
      pricePerKg?: unknown;
      totalPrice?: unknown;
      unitPrice?: unknown;
      publishedAt?: Date | null;
      expiresAt?: Date | null;
      pickupAt?: Date | null;
      shippedAt?: Date | null;
      deliveredAt?: Date | null;
      disputedAt?: Date | null;
      createdAt?: Date;
      updatedAt?: Date;
    }
  >(row: T) {
    return {
      ...row,
      totalWeightKg:
        row.totalWeightKg != null ? Number(row.totalWeightKg) : null,
      pricePerKg: row.pricePerKg != null ? Number(row.pricePerKg) : null,
      totalPrice: row.totalPrice != null ? Number(row.totalPrice) : null,
      unitPrice: row.unitPrice != null ? Number(row.unitPrice) : null,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      pickupAt: row.pickupAt?.toISOString() ?? null,
      shippedAt: row.shippedAt?.toISOString() ?? null,
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
      disputedAt: row.disputedAt?.toISOString() ?? null,
      createdAt: row.createdAt?.toISOString() ?? null,
      updatedAt: row.updatedAt?.toISOString() ?? null
    };
  }
}
