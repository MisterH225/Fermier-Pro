import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { ListingStatus, OfferStatus, Prisma } from "@prisma/client";
import { FarmAccessService } from "../common/farm-access.service";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { PrismaService } from "../prisma/prisma.service";
import { CreateListingDto } from "./dto/create-listing.dto";
import { PickupListingDto } from "./dto/pickup-listing.dto";
import { UpdateListingDto } from "./dto/update-listing.dto";

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService
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
        status: ListingStatus.draft
      }
    });
  }

  async list(user: User, mine?: boolean, status?: ListingStatus) {
    if (mine) {
      return this.prisma.marketplaceListing.findMany({
        where: {
          sellerUserId: user.id,
          ...(status ? { status } : {})
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
    return this.prisma.marketplaceListing.findMany({
      where: {
        status: publicStatus
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

    if (listing.sellerUserId === user.id) {
      const offers = await this.prisma.marketplaceOffer.findMany({
        where: { listingId: id },
        orderBy: { createdAt: "desc" },
        include: {
          buyer: { select: { id: true, fullName: true, email: true } }
        }
      });
      return { ...listing, offers };
    }

    const myOffers = await this.prisma.marketplaceOffer.findMany({
      where: { listingId: id, buyerUserId: user.id },
      orderBy: { createdAt: "desc" }
    });
    return { ...listing, myOffers };
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
