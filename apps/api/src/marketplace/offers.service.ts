import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { ListingStatus, OfferStatus, Prisma } from "@prisma/client";
import { AUDIT_ACTION } from "../common/audit.constants";
import { AuditService } from "../common/audit.service";
import { FarmAccessService } from "../common/farm-access.service";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOfferDto } from "./dto/create-offer.dto";

@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly audit: AuditService
  ) {}

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

  async create(user: User, listingId: string, dto: CreateOfferDto) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: listingId }
    });
    if (!listing) {
      throw new NotFoundException("Annonce introuvable");
    }
    if (listing.status !== ListingStatus.published) {
      throw new BadRequestException("Annonce non disponible aux offres");
    }
    if (listing.sellerUserId === user.id) {
      throw new ForbiddenException(
        "Vous ne pouvez pas offrir sur votre propre annonce"
      );
    }
    return this.prisma.marketplaceOffer.create({
      data: {
        listingId,
        buyerUserId: user.id,
        offeredPrice: new Prisma.Decimal(dto.offeredPrice),
        quantity: dto.quantity ?? null,
        message: dto.message ?? null
      }
    });
  }

  async listMine(user: User) {
    return this.prisma.marketplaceOffer.findMany({
      where: { buyerUserId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        listing: {
          include: {
            seller: { select: { id: true, fullName: true } },
            farm: { select: { id: true, name: true } },
            animal: { select: { id: true, publicId: true, tagCode: true } }
          }
        }
      }
    });
  }

  async accept(user: User, listingId: string, offerId: string) {
    const listing = await this.prisma.marketplaceListing.findFirst({
      where: { id: listingId, sellerUserId: user.id }
    });
    if (!listing) {
      throw new NotFoundException("Annonce introuvable");
    }
    await this.requireMarketplaceWriteIfFarmListing(user.id, listing.farmId);
    if (listing.status !== ListingStatus.published) {
      throw new BadRequestException("Annonce non eligible");
    }
    const offer = await this.prisma.marketplaceOffer.findFirst({
      where: { id: offerId, listingId }
    });
    if (!offer) {
      throw new NotFoundException("Offre introuvable");
    }
    if (offer.status !== OfferStatus.pending) {
      throw new BadRequestException("Offre non modifiable");
    }

    await this.prisma.$transaction([
      this.prisma.marketplaceOffer.update({
        where: { id: offerId },
        data: { status: OfferStatus.accepted }
      }),
      this.prisma.marketplaceOffer.updateMany({
        where: {
          listingId,
          id: { not: offerId },
          status: OfferStatus.pending
        },
        data: { status: OfferStatus.rejected }
      }),
      this.prisma.marketplaceListing.update({
        where: { id: listingId },
        data: { status: ListingStatus.sold }
      })
    ]);

    await this.audit.record({
      actorUserId: user.id,
      farmId: listing.farmId,
      action: AUDIT_ACTION.marketplaceOfferAccepted,
      resourceType: "MarketplaceOffer",
      resourceId: offerId,
      metadata: {
        listingId,
        buyerUserId: offer.buyerUserId,
        offeredPrice: offer.offeredPrice.toString(),
        quantity: offer.quantity ?? undefined
      }
    });

    return this.prisma.marketplaceListing.findUnique({
      where: { id: listingId },
      include: {
        offers: {
          orderBy: { createdAt: "desc" },
          include: {
            buyer: { select: { id: true, fullName: true, email: true } }
          }
        }
      }
    });
  }

  async reject(user: User, listingId: string, offerId: string) {
    const listing = await this.prisma.marketplaceListing.findFirst({
      where: { id: listingId, sellerUserId: user.id }
    });
    if (!listing) {
      throw new NotFoundException("Annonce introuvable");
    }
    await this.requireMarketplaceWriteIfFarmListing(user.id, listing.farmId);
    const offer = await this.prisma.marketplaceOffer.findFirst({
      where: { id: offerId, listingId }
    });
    if (!offer) {
      throw new NotFoundException("Offre introuvable");
    }
    if (offer.status !== OfferStatus.pending) {
      throw new BadRequestException("Offre non modifiable");
    }
    return this.prisma.marketplaceOffer.update({
      where: { id: offerId },
      data: { status: OfferStatus.rejected }
    });
  }

  async withdraw(user: User, offerId: string) {
    const offer = await this.prisma.marketplaceOffer.findFirst({
      where: { id: offerId, buyerUserId: user.id }
    });
    if (!offer) {
      throw new NotFoundException("Offre introuvable");
    }
    if (offer.status !== OfferStatus.pending) {
      throw new BadRequestException("Offre non retirable");
    }
    return this.prisma.marketplaceOffer.update({
      where: { id: offerId },
      data: { status: OfferStatus.withdrawn }
    });
  }
}
