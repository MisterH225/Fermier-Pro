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
import { ChatService } from "../chat/chat.service";
import { PushNotificationsService } from "../push-notifications/push-notifications.service";
import { CounterOfferDto } from "./dto/counter-offer.dto";
import { CreateOfferDto } from "./dto/create-offer.dto";

@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly audit: AuditService,
    private readonly push: PushNotificationsService,
    private readonly chat: ChatService
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
    const existingActive = await this.prisma.marketplaceOffer.findFirst({
      where: {
        listingId,
        buyerUserId: user.id,
        status: { in: [OfferStatus.pending, OfferStatus.countered] }
      }
    });
    if (existingActive) {
      throw new BadRequestException(
        "Vous avez deja une proposition active sur cette annonce"
      );
    }
    const hasTotal =
      dto.offeredPrice != null && Number.isFinite(dto.offeredPrice);
    const hasPerKg =
      dto.proposedPricePerKg != null &&
      listing.totalWeightKg != null &&
      Number.isFinite(dto.proposedPricePerKg);
    if (!hasTotal && !hasPerKg) {
      throw new BadRequestException(
        "Indique un prix total d'offre ou un prix/kg (l'annonce doit avoir un poids total pour le prix/kg)."
      );
    }
    const offeredNumber = hasPerKg
      ? dto.proposedPricePerKg! * listing.totalWeightKg!.toNumber()
      : dto.offeredPrice!;
    const created = await this.prisma.marketplaceOffer.create({
      data: {
        listingId,
        buyerUserId: user.id,
        buyerFarmId: dto.buyerFarmId?.trim() || null,
        proposedPricePerKg:
          dto.proposedPricePerKg != null
            ? new Prisma.Decimal(dto.proposedPricePerKg)
            : null,
        offeredPrice: new Prisma.Decimal(offeredNumber),
        quantity: dto.quantity ?? null,
        message: dto.message ?? null
      },
      include: {
        buyer: { select: { fullName: true } }
      }
    });

    const buyerFirst =
      user.fullName?.trim()?.split(/\s+/)[0] ?? "Un acheteur";
    const priceKg =
      dto.proposedPricePerKg ??
      (listing.totalWeightKg
        ? offeredNumber / listing.totalWeightKg.toNumber()
        : offeredNumber);
    void this.push.sendToUser(
      listing.sellerUserId,
      "💰 Nouvelle proposition reçue",
      `${buyerFirst} propose ${Math.round(priceKg).toLocaleString("fr-FR")} FCFA/kg pour « ${listing.title} ».`,
      { type: "marketplace_offer", listingId, offerId: created.id }
    );

    try {
      const room = await this.chat.ensureDirectRoom(
        user,
        listing.sellerUserId,
        listingId
      );
      await this.chat.postMarketplaceOfferMessage(room.id, user.id, {
        _type: "marketplace_offer",
        offerId: created.id,
        listingId,
        listingTitle: listing.title,
        currency: listing.currency,
        offeredPrice: offeredNumber,
        proposedPricePerKg: dto.proposedPricePerKg ?? null,
        quantity: dto.quantity ?? null,
        status: created.status,
        message: dto.message ?? null
      });
    } catch {
      /* chat optionnel si module désactivé ou pair invalide */
    }

    return created;
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
          status: { in: [OfferStatus.pending, OfferStatus.countered] }
        },
        data: { status: OfferStatus.rejected }
      }),
      this.prisma.marketplaceListing.update({
        where: { id: listingId },
        data: { status: ListingStatus.reserved }
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

    void this.push.sendToUser(
      offer.buyerUserId,
      "✅ Proposition acceptée",
      `Votre offre sur « ${listing.title} » a été acceptée. Finalisez le retrait avec le vendeur.`,
      { type: "marketplace_offer_accepted", listingId, offerId }
    );

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
    if (
      offer.status !== OfferStatus.pending &&
      offer.status !== OfferStatus.countered
    ) {
      throw new BadRequestException("Offre non modifiable");
    }
    const updated = await this.prisma.marketplaceOffer.update({
      where: { id: offerId },
      data: { status: OfferStatus.rejected }
    });
    void this.push.sendToUser(
      offer.buyerUserId,
      "Proposition refusée",
      `Votre offre sur « ${listing.title} » a été refusée.`,
      { type: "marketplace_offer_rejected", listingId, offerId }
    );
    return updated;
  }

  async counter(
    user: User,
    listingId: string,
    offerId: string,
    dto: CounterOfferDto
  ) {
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
    if (!listing.totalWeightKg) {
      throw new BadRequestException(
        "Poids total requis sur l'annonce pour une contre-proposition au kg"
      );
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
    const total = dto.counterPricePerKg * listing.totalWeightKg.toNumber();
    const updated = await this.prisma.marketplaceOffer.update({
      where: { id: offerId },
      data: {
        status: OfferStatus.countered,
        counterPricePerKg: new Prisma.Decimal(dto.counterPricePerKg),
        offeredPrice: new Prisma.Decimal(total),
        proposedPricePerKg: new Prisma.Decimal(dto.counterPricePerKg)
      }
    });
    void this.push.sendToUser(
      offer.buyerUserId,
      "🔄 Contre-proposition reçue",
      `Le vendeur propose ${Math.round(dto.counterPricePerKg).toLocaleString("fr-FR")} FCFA/kg pour « ${listing.title} ».`,
      { type: "marketplace_counter", listingId, offerId }
    );
    return updated;
  }

  /** Acheteur accepte une contre-proposition vendeur. */
  async acceptCounter(user: User, listingId: string, offerId: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: listingId }
    });
    if (!listing || listing.status !== ListingStatus.published) {
      throw new BadRequestException("Annonce non eligible");
    }
    const offer = await this.prisma.marketplaceOffer.findFirst({
      where: { id: offerId, listingId, buyerUserId: user.id }
    });
    if (!offer) {
      throw new NotFoundException("Offre introuvable");
    }
    if (offer.status !== OfferStatus.countered) {
      throw new BadRequestException("Aucune contre-proposition a accepter");
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
          status: { in: [OfferStatus.pending, OfferStatus.countered] }
        },
        data: { status: OfferStatus.rejected }
      }),
      this.prisma.marketplaceListing.update({
        where: { id: listingId },
        data: { status: ListingStatus.reserved }
      })
    ]);

    void this.push.sendToUser(
      listing.sellerUserId,
      "Contre-proposition acceptée",
      `L'acheteur a accepté votre contre-proposition sur « ${listing.title} ».`,
      { type: "marketplace_counter_accepted", listingId, offerId }
    );

    return this.prisma.marketplaceOffer.findUnique({ where: { id: offerId } });
  }

  async withdraw(user: User, offerId: string) {
    const offer = await this.prisma.marketplaceOffer.findFirst({
      where: { id: offerId, buyerUserId: user.id, archived: false }
    });
    if (!offer) {
      throw new NotFoundException("Offre introuvable");
    }
    if (
      offer.status !== OfferStatus.pending &&
      offer.status !== OfferStatus.countered
    ) {
      throw new BadRequestException("Offre non retirable");
    }
    return this.prisma.marketplaceOffer.update({
      where: { id: offerId },
      data: { status: OfferStatus.withdrawn }
    });
  }
}
