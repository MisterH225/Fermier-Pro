import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  ListingStatus,
  MarketplaceTransactionStatus,
  OfferStatus,
  OfferType,
  Prisma
} from "@prisma/client";
import { APP_EVENT } from "../app-events/app-events.constants";
import { AppEventsService } from "../app-events/app-events.service";
import { AUDIT_ACTION } from "../common/audit.constants";
import { AuditService } from "../common/audit.service";
import { FarmAccessService } from "../common/farm-access.service";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { PrismaService } from "../prisma/prisma.service";
import { ChatService } from "../chat/chat.service";
import { PushNotificationsService } from "../push-notifications/push-notifications.service";
import { offerProposalTimeoutOutcomeKey } from "../common/deadline-outcome";
import { OFFER_TTL_MS } from "./marketplace.constants";
import { CounterOfferDto } from "./dto/counter-offer.dto";
import { CreateOfferDto } from "./dto/create-offer.dto";
import { CreditScoreService } from "./credit/credit-score.service";
import { MarketplaceTransactionService } from "./escrow/marketplace-transaction.service";
import { ACTIVE_DEAL_TRANSACTION_STATUSES } from "./escrow/transaction.utils";
import { usesFlatListingPrice } from "./marketplace-listing-category.helper";

@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly audit: AuditService,
    private readonly push: PushNotificationsService,
    private readonly chat: ChatService,
    private readonly transactions: MarketplaceTransactionService,
    private readonly creditScore: CreditScoreService,
    private readonly appEvents: AppEventsService
  ) {}

  private trackOfferDecision(
    producerUserId: string,
    decision: "accepted" | "rejected",
    buyerUserId: string
  ): void {
    void (async () => {
      try {
        const meteo = await this.creditScore.getBuyerMeteoForUser(buyerUserId);
        this.appEvents.trackFireAndForget(
          APP_EVENT.offerDecision,
          {
            decision,
            meteoLevel: meteo.meteoLevel
          },
          { userId: producerUserId }
        );
      } catch {
        /* tracking never breaks accept/reject */
      }
    })();
  }

  private assertStandardOffer(offer: { offerType: OfferType }) {
    if (offer.offerType === OfferType.credit) {
      throw new BadRequestException(
        "Cette offre utilise le flux crédit — action non applicable"
      );
    }
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
    const dealInProgress = await this.prisma.marketplaceTransaction.findFirst({
      where: {
        listingId,
        status: { in: ACTIVE_DEAL_TRANSACTION_STATUSES }
      },
      select: { id: true }
    });
    if (dealInProgress) {
      throw new BadRequestException(
        "Une transaction est déjà en cours sur cette annonce"
      );
    }
    if (listing.sellerUserId === user.id) {
      throw new ForbiddenException(
        "Vous ne pouvez pas offrir sur votre propre annonce"
      );
    }
    const existingHeld = await this.prisma.marketplaceTransaction.findFirst({
      where: {
        listingId,
        buyerUserId: user.id,
        status: {
          in: [
            MarketplaceTransactionStatus.PAYMENT_PENDING,
            MarketplaceTransactionStatus.PAYMENT_HELD,
            MarketplaceTransactionStatus.PICKUP_PROPOSED,
            MarketplaceTransactionStatus.PICKUP_SCHEDULED,
            MarketplaceTransactionStatus.WEIGHT_DECLARED,
            MarketplaceTransactionStatus.WEIGHT_COUNTER_DECLARED,
            MarketplaceTransactionStatus.WEIGHT_DISPUTED,
            MarketplaceTransactionStatus.WEIGHT_VALIDATED
          ]
        }
      }
    });
    if (existingHeld) {
      throw new BadRequestException(
        "Vous avez déjà une offre active sur cette annonce"
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
    const flatAsk = usesFlatListingPrice(listing.category);
    const hasTotal =
      dto.offeredPrice != null && Number.isFinite(dto.offeredPrice);
    const hasPerKg =
      !flatAsk &&
      dto.proposedPricePerKg != null &&
      listing.totalWeightKg != null &&
      Number.isFinite(dto.proposedPricePerKg);
    if (!hasTotal && !hasPerKg) {
      throw new BadRequestException(
        flatAsk
          ? "Indique un montant forfaitaire pour votre offre."
          : "Indique un prix total d'offre ou un prix/kg (l'annonce doit avoir un poids total pour le prix/kg)."
      );
    }
    const offeredNumber = hasPerKg
      ? dto.proposedPricePerKg! * listing.totalWeightKg!.toNumber()
      : dto.offeredPrice!;
    // Valider que buyerFarmId appartient bien à l'acheteur
    const buyerFarmId = dto.buyerFarmId?.trim() || null;
    if (buyerFarmId) {
      const farm = await this.prisma.farm.findFirst({
        where: { id: buyerFarmId, ownerId: user.id },
        select: { id: true }
      });
      if (!farm) {
        throw new BadRequestException("Ferme acheteur introuvable ou non autorisée");
      }
    }

    const created = await this.prisma.marketplaceOffer.create({
      data: {
        listingId,
        buyerUserId: user.id,
        buyerFarmId,
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
    const offerSummary = flatAsk
      ? `${Math.round(offeredNumber).toLocaleString("fr-FR")} ${listing.currency} (forfait)`
      : `${Math.round(priceKg).toLocaleString("fr-FR")} FCFA/kg`;
    void this.push.sendToUser(
      listing.sellerUserId,
      "💰 Nouvelle proposition reçue",
      `${buyerFirst} propose ${offerSummary} pour « ${listing.title} ».`,
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

  /**
   * Échéance d'expiration d'une offre non traitée (P-43) : createdAt + 7j,
   * miroir du cron expireStaleOffers. Exposée uniquement pour pending/countered.
   */
  private offerDeadlineFields(offer: { status: OfferStatus; createdAt: Date }): {
    deadlineAt: string | null;
    timeoutOutcomeKey: string | null;
  } {
    const outcomeKey = offerProposalTimeoutOutcomeKey(offer.status);
    if (!outcomeKey) {
      return { deadlineAt: null, timeoutOutcomeKey: null };
    }
    return {
      deadlineAt: new Date(
        offer.createdAt.getTime() + OFFER_TTL_MS
      ).toISOString(),
      timeoutOutcomeKey: outcomeKey
    };
  }

  async listMine(user: User) {
    const rows = await this.prisma.marketplaceOffer.findMany({
      where: { buyerUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        transaction: { select: { id: true, status: true } },
        listing: {
          include: {
            seller: { select: { id: true, fullName: true } },
            farm: { select: { id: true, name: true } },
            animal: { select: { id: true, publicId: true, tagCode: true } }
          }
        }
      }
    });
    return rows.map((row) => ({ ...row, ...this.offerDeadlineFields(row) }));
  }

  /** Propositions reçues sur les annonces du vendeur connecté (optionnellement filtrées par ferme). */
  async listReceived(user: User, farmId?: string) {
    const rows = await this.prisma.marketplaceOffer.findMany({
      where: {
        listing: {
          sellerUserId: user.id,
          ...(farmId ? { farmId } : {})
        }
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        transaction: { select: { id: true, status: true } },
        buyer: { select: { id: true, fullName: true, email: true } },
        listing: {
          select: {
            id: true,
            title: true,
            status: true,
            currency: true,
            category: true,
            totalWeightKg: true,
            pricePerKg: true,
            totalPrice: true,
            farm: { select: { id: true, name: true } },
            animal: { select: { id: true, publicId: true, tagCode: true } }
          }
        }
      }
    });
    const buyerIds = [...new Set(rows.map((row) => row.buyerUserId))];
    const creditByUser = await this.creditScore.getForUsers(buyerIds);

    return rows.map((row) => {
      const creditView = creditByUser.get(row.buyerUserId)!;
      const buyerMeteo = this.creditScore.toBuyerMeteo(creditView);
      return {
        ...row,
        buyerMeteo,
        // Compat : badge sans late/default (détail sensible réservé à l'acheteur).
        buyerCreditScore: {
          score: creditView.score,
          emoji: creditView.emoji,
          label: creditView.label,
          color: creditView.color,
          blocked: creditView.blocked,
          creditTransactionsCount: creditView.creditTransactionsCount,
          creditOnTimeCount: creditView.creditOnTimeCount
        },
        ...this.offerDeadlineFields(row)
      };
    });
  }

  async counts(user: User, farmId?: string) {
    const [receivedPending, sentPending] = await Promise.all([
      this.prisma.marketplaceOffer.count({
        where: {
          status: OfferStatus.pending,
          listing: {
            sellerUserId: user.id,
            ...(farmId ? { farmId } : {})
          }
        }
      }),
      this.prisma.marketplaceOffer.count({
        where: {
          buyerUserId: user.id,
          status: { in: [OfferStatus.pending, OfferStatus.countered] }
        }
      })
    ]);
    return {
      receivedPending,
      sentPending,
      total: receivedPending + sentPending
    };
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
    this.assertStandardOffer(offer);

    await this.reserveListingForAcceptedOffer(listingId, offerId, offer.buyerUserId);

    const { transactionId } =
      await this.transactions.createFromAcceptedOffer(offerId);

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
      `Votre offre sur « ${listing.title} » a été acceptée. Procédez au paiement pour sécuriser l'achat.`,
      {
        type: "marketplace_offer_accepted",
        listingId,
        offerId,
        transactionId
      }
    );
    void this.push.sendToUser(
      user.id,
      "Proposition acceptée",
      `En attente du paiement de l'acheteur pour « ${listing.title} ».`,
      {
        type: "marketplace_offer_accepted_seller",
        listingId,
        offerId,
        transactionId
      }
    );

    this.trackOfferDecision(user.id, "accepted", offer.buyerUserId);

    return {
      listing: await this.prisma.marketplaceListing.findUnique({
        where: { id: listingId },
        include: {
          offers: {
            orderBy: { createdAt: "desc" },
            include: {
              buyer: { select: { id: true, fullName: true, email: true } }
            }
          }
        }
      }),
      transactionId
    };
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
    this.trackOfferDecision(user.id, "rejected", offer.buyerUserId);
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
    const flatAsk = usesFlatListingPrice(listing.category);
    const hasFlat =
      dto.counterOfferedPrice != null &&
      Number.isFinite(dto.counterOfferedPrice);
    const hasPerKg =
      !flatAsk &&
      dto.counterPricePerKg != null &&
      Number.isFinite(dto.counterPricePerKg) &&
      listing.totalWeightKg != null;
    if (flatAsk && !hasFlat) {
      throw new BadRequestException(
        "Indique un montant forfaitaire pour la contre-proposition."
      );
    }
    if (!flatAsk && !hasPerKg) {
      throw new BadRequestException(
        "Poids total requis sur l'annonce pour une contre-proposition au kg."
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
    this.assertStandardOffer(offer);
    const total = hasFlat
      ? dto.counterOfferedPrice!
      : dto.counterPricePerKg! * listing.totalWeightKg!.toNumber();
    const updated = await this.prisma.marketplaceOffer.update({
      where: { id: offerId },
      data: {
        status: OfferStatus.countered,
        counterPricePerKg:
          hasPerKg && dto.counterPricePerKg != null
            ? new Prisma.Decimal(dto.counterPricePerKg)
            : null,
        offeredPrice: new Prisma.Decimal(total),
        proposedPricePerKg:
          hasPerKg && dto.counterPricePerKg != null
            ? new Prisma.Decimal(dto.counterPricePerKg)
            : null
      }
    });
    const counterSummary = flatAsk
      ? `${Math.round(total).toLocaleString("fr-FR")} ${listing.currency} (forfait)`
      : `${Math.round(dto.counterPricePerKg!).toLocaleString("fr-FR")} FCFA/kg`;
    void this.push.sendToUser(
      offer.buyerUserId,
      "🔄 Contre-proposition reçue",
      `Le vendeur propose ${counterSummary} pour « ${listing.title} ».`,
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
    this.assertStandardOffer(offer);

    await this.reserveListingForAcceptedOffer(listingId, offerId, offer.buyerUserId);

    const { transactionId } =
      await this.transactions.createFromAcceptedOffer(offerId);

    void this.push.sendToUser(
      offer.buyerUserId,
      "✅ Contre-proposition acceptée",
      `Votre accord sur « ${listing.title} » est confirmé. Procédez au paiement pour sécuriser l'achat.`,
      {
        type: "marketplace_offer_accepted",
        listingId,
        offerId,
        transactionId
      }
    );
    void this.push.sendToUser(
      listing.sellerUserId,
      "Contre-proposition acceptée",
      `L'acheteur a accepté votre contre-proposition sur « ${listing.title} ». En attente de son paiement.`,
      {
        type: "marketplace_counter_accepted",
        listingId,
        offerId,
        transactionId
      }
    );

    return {
      offer: await this.prisma.marketplaceOffer.findUnique({
        where: { id: offerId }
      }),
      transactionId
    };
  }

  async withdraw(user: User, offerId: string) {
    const offer = await this.prisma.marketplaceOffer.findFirst({
      where: { id: offerId, buyerUserId: user.id, archived: false },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            sellerUserId: true
          }
        }
      }
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
    const updated = await this.prisma.marketplaceOffer.update({
      where: { id: offerId },
      data: { status: OfferStatus.withdrawn }
    });

    const buyerFirst =
      user.fullName?.trim()?.split(/\s+/)[0] ?? "Un acheteur";
    void this.push.sendToUser(
      offer.listing.sellerUserId,
      "Proposition retirée",
      `${buyerFirst} a retiré sa proposition sur « ${offer.listing.title} ». Vous pouvez continuer la discussion par message.`,
      {
        type: "marketplace_offer_withdrawn",
        listingId: offer.listing.id,
        offerId
      }
    );

    try {
      await this.chat.syncMarketplaceOfferMessageStatus(
        offerId,
        OfferStatus.withdrawn
      );
      await this.chat.ensureDirectRoom(
        user,
        offer.listing.sellerUserId,
        offer.listing.id
      );
    } catch {
      /* chat optionnel */
    }

    return updated;
  }

  private async reserveListingForAcceptedOffer(
    listingId: string,
    offerId: string,
    buyerUserId: string
  ): Promise<void> {
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
        data: {
          reservedForBuyerUserId: buyerUserId
        }
      })
    ]);
  }
}
