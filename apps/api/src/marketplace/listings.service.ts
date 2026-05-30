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
import { PrismaService } from "../prisma/prisma.service";
import { PushNotificationsService } from "../push-notifications/push-notifications.service";
import { CompleteHandoverDto } from "./dto/complete-handover.dto";
import { CreateListingDto } from "./dto/create-listing.dto";
import { PublishListingDto } from "./dto/publish-listing.dto";
import { RenewListingDto } from "./dto/renew-listing.dto";
import { FarmRatingsService } from "./farm-ratings.service";
import {
  buildListingFarmInfo,
  buildListingHealthData
} from "./listing-detail-health.helper";
import { PickupListingDto } from "./dto/pickup-listing.dto";
import { UpdateListingDto } from "./dto/update-listing.dto";
import {
  listingHeadcount,
  resolveListingMarketCategory,
  usesFlatListingPrice
} from "./marketplace-listing-category.helper";

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
    private readonly push: PushNotificationsService
  ) {}

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

  private normalizeListingPricing(
    category: ListingMarketCategory | undefined,
    totalWeightKg: number | null | undefined,
    pricePerKg: number | null | undefined,
    totalPrice: number | null | undefined
  ): {
    totalWeightKg: number | null;
    pricePerKg: number | null;
    totalPrice: number;
  } {
    if (category && usesFlatListingPrice(category)) {
      if (totalPrice == null || totalPrice <= 0 || !Number.isFinite(totalPrice)) {
        throw new BadRequestException(
          "Prix forfaitaire requis pour un porcelet ou un reproducteur."
        );
      }
      const weight =
        totalWeightKg != null && totalWeightKg > 0 ? totalWeightKg : null;
      return {
        totalWeightKg: weight,
        pricePerKg: null,
        totalPrice
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
      totalPrice: resolvedTotal
    };
  }

  async create(user: User, dto: CreateListingDto) {
    const refs = await this.resolveFarmAndAnimal(user, dto);
    const photoUrls = dto.photoUrls ?? [];
    const animalIds = dto.animalIds ?? [];
    const category = this.resolvedListingCategory(
      dto.category,
      dto.totalWeightKg ?? null,
      animalIds,
      refs.animalId,
      dto.quantity
    );
    const pricing = this.normalizeListingPricing(
      category,
      dto.totalWeightKg ?? null,
      dto.pricePerKg ?? null,
      dto.totalPrice ?? null
    );
    const created = await this.prisma.marketplaceListing.create({
      data: {
        sellerUserId: user.id,
        farmId: refs.farmId,
        animalId: refs.animalId,
        title: dto.title,
        description: dto.description,
        unitPrice:
          dto.unitPrice != null ? new Prisma.Decimal(dto.unitPrice) : null,
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
    const publicStatus =
      status && status !== ListingStatus.draft
        ? status
        : ListingStatus.published;
    const now = new Date();
    const rows = await this.prisma.marketplaceListing.findMany({
      where: {
        status: publicStatus,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
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

    return { healthData, farmInfo, farmRatingSummary };
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

    if (listing.status === ListingStatus.reserved) {
      const accepted = await this.prisma.marketplaceOffer.findFirst({
        where: {
          listingId: id,
          buyerUserId: user.id,
          status: OfferStatus.accepted
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

    const pricingFieldsPresent =
      dto.category !== undefined ||
      dto.totalWeightKg !== undefined ||
      dto.pricePerKg !== undefined ||
      dto.totalPrice !== undefined ||
      dto.quantity !== undefined ||
      dto.animalIds !== undefined;

    let pricingUpdate: {
      category?: ListingMarketCategory | undefined;
      totalWeightKg?: Prisma.Decimal | null;
      pricePerKg?: Prisma.Decimal | null;
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
      const pricing = this.normalizeListingPricing(
        normalizedCategory,
        nextWeight,
        nextPricePerKg,
        nextTotalPrice
      );

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
        totalPrice: new Prisma.Decimal(pricing.totalPrice)
      };
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
        ...(dto.breedLabel !== undefined ? { breedLabel: dto.breedLabel } : {})
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
    const pricing = this.normalizeListingPricing(
      normalizedCategory,
      listing.totalWeightKg != null ? Number(listing.totalWeightKg) : null,
      listing.pricePerKg != null ? Number(listing.pricePerKg) : null,
      listing.totalPrice != null ? Number(listing.totalPrice) : null
    );

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
        totalPrice: new Prisma.Decimal(pricing.totalPrice),
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
    if (listing.status !== ListingStatus.reserved) {
      throw new BadRequestException(
        "Cloture possible uniquement pour une annonce reservee"
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
    const pricePerAnimal =
      animalIds.length > 0 ? dto.totalPrice / animalIds.length : dto.totalPrice;

    const result = await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.marketplaceListing.findUnique({
        where: { id: listingId }
      });
      if (!fresh || fresh.status !== ListingStatus.reserved) {
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
            penPlacements: { where: { endedAt: null } }
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

        await tx.livestockExit.create({
          data: {
            farmId: listing.farmId!,
            animalId,
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
}
