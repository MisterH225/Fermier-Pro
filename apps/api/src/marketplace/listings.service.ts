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
import { PrismaService } from "../prisma/prisma.service";
import { CreateListingDto } from "./dto/create-listing.dto";
import { FarmRatingsService } from "./farm-ratings.service";
import { PickupListingDto } from "./dto/pickup-listing.dto";
import { UpdateListingDto } from "./dto/update-listing.dto";

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly farmRatings: FarmRatingsService
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

  async create(user: User, dto: CreateListingDto) {
    const refs = await this.resolveFarmAndAnimal(user, dto);
    const photoUrls = dto.photoUrls ?? [];
    const animalIds = dto.animalIds ?? [];
    return this.prisma.marketplaceListing.create({
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
        category: dto.category ?? undefined,
        photoUrls: photoUrls as Prisma.InputJsonValue,
        animalIds: animalIds as Prisma.InputJsonValue,
        totalWeightKg:
          dto.totalWeightKg != null
            ? new Prisma.Decimal(dto.totalWeightKg)
            : null,
        pricePerKg:
          dto.pricePerKg != null ? new Prisma.Decimal(dto.pricePerKg) : null,
        totalPrice:
          dto.totalPrice != null ? new Prisma.Decimal(dto.totalPrice) : null,
        breedLabel: dto.breedLabel,
        status: ListingStatus.draft
      }
    });
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
      return this.prisma.marketplaceListing.findMany({
        where: {
          sellerUserId: user.id,
          ...(status ? { status } : {}),
          ...(category ? { category } : {}),
          ...textFilter
        },
        orderBy: { updatedAt: "desc" },
        include: {
          farm: { select: { id: true, name: true } },
          animal: { select: { id: true, publicId: true, tagCode: true } }
        }
      });
    }
    const publicStatus =
      status && status !== ListingStatus.draft
        ? status
        : ListingStatus.published;
    const now = new Date();
    return this.prisma.marketplaceListing.findMany({
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
        animal: { select: { id: true, publicId: true, tagCode: true } }
      }
    });
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

  private async enrichListingPayload(listing: { farmId: string | null }) {
    let healthSnapshot: Awaited<
      ReturnType<ListingsService["farmHealthSnapshot"]>
    > | null = null;
    let farmRatingSummary: { avg: number | null; count: number } | null = null;
    if (listing.farmId) {
      healthSnapshot = await this.farmHealthSnapshot(listing.farmId);
      farmRatingSummary = await this.farmRatings.averageForFarm(
        listing.farmId
      );
    }
    return { healthSnapshot, farmRatingSummary };
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
            status: true
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

    const extra = await this.enrichListingPayload(listing);

    if (listing.sellerUserId === user.id) {
      const offers = await this.prisma.marketplaceOffer.findMany({
        where: { listingId: id },
        orderBy: { createdAt: "desc" },
        include: {
          buyer: { select: { id: true, fullName: true, email: true } }
        }
      });
      return { ...listing, ...extra, offers };
    }

    const myOffers = await this.prisma.marketplaceOffer.findMany({
      where: { listingId: id, buyerUserId: user.id },
      orderBy: { createdAt: "desc" }
    });
    return { ...listing, ...extra, myOffers };
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
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.photoUrls !== undefined
          ? { photoUrls: dto.photoUrls as Prisma.InputJsonValue }
          : {}),
        ...(dto.animalIds !== undefined
          ? { animalIds: dto.animalIds as Prisma.InputJsonValue }
          : {}),
        ...(dto.totalWeightKg !== undefined
          ? {
              totalWeightKg:
                dto.totalWeightKg != null
                  ? new Prisma.Decimal(dto.totalWeightKg)
                  : null
            }
          : {}),
        ...(dto.pricePerKg !== undefined
          ? {
              pricePerKg:
                dto.pricePerKg != null
                  ? new Prisma.Decimal(dto.pricePerKg)
                  : null
            }
          : {}),
        ...(dto.totalPrice !== undefined
          ? {
              totalPrice:
                dto.totalPrice != null
                  ? new Prisma.Decimal(dto.totalPrice)
                  : null
            }
          : {}),
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

  async publish(user: User, id: string) {
    const listing = await this.requireOwnerEditable(user, id);
    await this.requireMarketplaceWriteIfFarmListing(user.id, listing.farmId);
    if (listing.status !== ListingStatus.draft) {
      throw new BadRequestException("Publication impossible dans cet etat");
    }
    return this.prisma.marketplaceListing.update({
      where: { id },
      data: {
        status: ListingStatus.published,
        publishedAt: new Date()
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

  /** Vendeur : apres retrait effectif, marque l'annonce comme vendue (hors encaissement in-app). */
  async completeHandover(user: User, listingId: string) {
    const listing = await this.requireOwnerEditable(user, listingId);
    await this.requireMarketplaceWriteIfFarmListing(user.id, listing.farmId);
    if (listing.status !== ListingStatus.reserved) {
      throw new BadRequestException(
        "Cloture possible uniquement pour une annonce reservee (retrait d'abord convenu)"
      );
    }
    return this.prisma.marketplaceListing.update({
      where: { id: listingId },
      data: { status: ListingStatus.sold }
    });
  }
}
