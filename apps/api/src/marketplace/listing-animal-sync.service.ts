import {
  BadRequestException,
  Injectable,
  Logger
} from "@nestjs/common";
import {
  ListingMarketCategory,
  ListingStatus,
  MarketplaceFundMovementKind,
  MarketplacePriceType,
  MarketplaceTransactionStatus,
  OfferStatus,
  Prisma
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PushNotificationsService } from "../push-notifications/push-notifications.service";
import { EscrowService } from "./escrow/escrow.service";
import {
  calculateBlockedAmount,
  settlementAmounts
} from "./escrow/transaction.utils";
import { usesFlatListingPrice } from "./marketplace-listing-category.helper";
import {
  assertCharcutierAnimalLinked,
  estimateAnimalWeightKg,
  isIndividualListing,
  isLotListing,
  parseListingAnimalIds
} from "./listing-animal-sync.util";

const OPEN_LISTING_STATUSES: ListingStatus[] = [
  ListingStatus.draft,
  ListingStatus.published,
  ListingStatus.paused,
  ListingStatus.expired,
  ListingStatus.reserved,
  ListingStatus.shipped,
  ListingStatus.delivered,
  ListingStatus.disputed,
  ListingStatus.reserved_credit
];

const TERMINAL_TX: MarketplaceTransactionStatus[] = [
  MarketplaceTransactionStatus.TRANSACTION_CLOSED,
  MarketplaceTransactionStatus.CANCELLED_BY_BUYER,
  MarketplaceTransactionStatus.CANCELLED_BY_SELLER,
  MarketplaceTransactionStatus.OFFER_EXPIRED
];

const REFUND_ON_CANCEL: MarketplaceTransactionStatus[] = [
  MarketplaceTransactionStatus.PAYMENT_HELD,
  MarketplaceTransactionStatus.PICKUP_SCHEDULED,
  MarketplaceTransactionStatus.SELLER_SHIPPED,
  MarketplaceTransactionStatus.BUYER_RECEIVED,
  MarketplaceTransactionStatus.DELIVERY_DISPUTED,
  MarketplaceTransactionStatus.WEIGHT_DECLARED,
  MarketplaceTransactionStatus.WEIGHT_DISPUTED,
  MarketplaceTransactionStatus.WEIGHT_VALIDATED
];

type ListingRow = {
  id: string;
  title: string;
  sellerUserId: string;
  status: ListingStatus;
  category: ListingMarketCategory | null;
  animalId: string | null;
  animalIds: unknown;
  pricePerKg: Prisma.Decimal | null;
  unitPrice: Prisma.Decimal | null;
  totalWeightKg: Prisma.Decimal | null;
  totalPrice: Prisma.Decimal | null;
  quantity: number | null;
  currency: string;
};

@Injectable()
export class ListingAnimalSyncService {
  private readonly log = new Logger(ListingAnimalSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushNotificationsService,
    private readonly escrow: EscrowService
  ) {}

  /** Validation création / mise à jour (dès le brouillon). */
  async assertListingAnimalRules(params: {
    category?: ListingMarketCategory | null;
    animalIds: string[];
    excludeListingId?: string;
  }): Promise<void> {
    const { category, animalIds, excludeListingId } = params;
    try {
      assertCharcutierAnimalLinked(category, animalIds);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    if (!isIndividualListing(animalIds)) {
      return;
    }
    const animalId = animalIds[0]!;
    const conflict = await this.findIndividualListingForAnimal(
      animalId,
      excludeListingId
    );
    if (conflict) {
      throw new BadRequestException(
        "Cet animal a déjà une annonce individuelle sur le marketplace."
      );
    }
  }

  /**
   * Vente hors market (cheptel) : synchronise annonces individuelles et lots.
   */
  async onAnimalSoldViaCheptel(animalId: string): Promise<void> {
    await this.delistAnimalFromOpenListings(
      animalId,
      "Animal vendu hors marketplace (cheptel)."
    );
  }

  /** Sortie du cheptel (hors vente / mortalité) : retire l'animal des annonces ouvertes. */
  async onAnimalExitedFromCheptel(animalId: string): Promise<void> {
    await this.delistAnimalFromOpenListings(
      animalId,
      "Animal sorti du cheptel — annonce retirée."
    );
  }

  private async delistAnimalFromOpenListings(
    animalId: string,
    cancelReason: string
  ): Promise<void> {
    const listings = await this.findOpenListingsContainingAnimal(animalId);
    for (const listing of listings) {
      const ids = parseListingAnimalIds(listing);
      if (isIndividualListing(ids)) {
        await this.cancelListingCompletely(listing, cancelReason);
        continue;
      }
      if (isLotListing(ids)) {
        await this.removeAnimalFromLotListing(listing, animalId);
      }
    }
  }

  /**
   * Lot entièrement épuisé : annule les annonces individuelles des animaux.
   */
  async cancelIndividualListingsForAnimals(
    animalIds: string[],
    excludeListingId?: string
  ): Promise<void> {
    for (const animalId of animalIds) {
      const individual = await this.findIndividualListingForAnimal(
        animalId,
        excludeListingId
      );
      if (!individual) {
        continue;
      }
      await this.cancelListingCompletely(
        individual,
        "Lot marketplace épuisé — annonce individuelle retirée."
      );
    }
  }

  private async findOpenListingsContainingAnimal(
    animalId: string
  ): Promise<ListingRow[]> {
    const rows = await this.prisma.marketplaceListing.findMany({
      where: {
        archived: false,
        status: { in: OPEN_LISTING_STATUSES }
      },
      select: {
        id: true,
        title: true,
        sellerUserId: true,
        status: true,
        category: true,
        animalId: true,
        animalIds: true,
        pricePerKg: true,
        unitPrice: true,
        totalWeightKg: true,
        totalPrice: true,
        quantity: true,
        currency: true
      }
    });
    return rows.filter((row) =>
      parseListingAnimalIds(row).includes(animalId)
    );
  }

  private async findIndividualListingForAnimal(
    animalId: string,
    excludeListingId?: string
  ): Promise<ListingRow | null> {
    const rows = await this.findOpenListingsContainingAnimal(animalId);
    return (
      rows.find(
        (row) =>
          row.id !== excludeListingId &&
          isIndividualListing(parseListingAnimalIds(row))
      ) ?? null
    );
  }

  private async cancelListingCompletely(
    listing: ListingRow,
    reason: string
  ): Promise<void> {
    if (
      listing.status === ListingStatus.cancelled ||
      listing.status === ListingStatus.sold
    ) {
      return;
    }

    await this.rejectPendingOffers(listing.id, listing.title, reason);
    await this.cancelActiveTransactions(listing.id, listing.title, reason, true);

    await this.prisma.marketplaceListing.update({
      where: { id: listing.id },
      data: {
        status: ListingStatus.cancelled,
        activeOfferCount: 0,
        reservedForBuyerUserId: null
      }
    });
  }

  private async rejectPendingOffers(
    listingId: string,
    listingTitle: string,
    reason: string
  ): Promise<void> {
    const pending = await this.prisma.marketplaceOffer.findMany({
      where: {
        listingId,
        status: { in: [OfferStatus.pending, OfferStatus.countered] }
      },
      select: { id: true, buyerUserId: true }
    });
    if (pending.length === 0) {
      return;
    }
    await this.prisma.marketplaceOffer.updateMany({
      where: {
        id: { in: pending.map((o) => o.id) }
      },
      data: { status: OfferStatus.rejected }
    });
    for (const offer of pending) {
      void this.push.sendToUser(
        offer.buyerUserId,
        "Proposition refusée",
        `L'annonce « ${listingTitle} » n'est plus disponible. ${reason}`,
        { type: "marketplace_offer_rejected", listingId, offerId: offer.id }
      );
    }
  }

  private async cancelActiveTransactions(
    listingId: string,
    listingTitle: string,
    reason: string,
    fullRefund: boolean
  ): Promise<void> {
    const txs = await this.prisma.marketplaceTransaction.findMany({
      where: {
        listingId,
        status: { notIn: TERMINAL_TX }
      }
    });

    for (const tx of txs) {
      if (tx.status === MarketplaceTransactionStatus.PAYMENT_PENDING) {
        await this.prisma.marketplaceTransaction.update({
          where: { id: tx.id },
          data: {
            status: MarketplaceTransactionStatus.CANCELLED_BY_SELLER,
            cancelledAt: new Date(),
            cancelReason: reason
          }
        });
        await this.prisma.marketplaceOffer.updateMany({
          where: { id: tx.offerId },
          data: { status: OfferStatus.rejected }
        });
        void this.push.sendToUser(
          tx.buyerUserId,
          "Transaction annulée",
          `L'annonce « ${listingTitle} » a été retirée. ${reason}`,
          { type: "marketplace_cancelled_seller", transactionId: tx.id }
        );
        continue;
      }

      if (fullRefund && REFUND_ON_CANCEL.includes(tx.status)) {
        await this.refundIfNeeded(
          tx.id,
          tx.buyerUserId,
          Number(tx.blockedAmount),
          tx.currency,
          tx.paymentProviderRef
        );
      }

      await this.prisma.marketplaceTransaction.update({
        where: { id: tx.id },
        data: {
          status: MarketplaceTransactionStatus.CANCELLED_BY_SELLER,
          cancelledAt: new Date(),
          cancelReason: reason
        }
      });
      void this.push.sendToUser(
        tx.buyerUserId,
        "Transaction annulée",
        fullRefund
          ? `L'annonce « ${listingTitle} » a été retirée. Votre paiement sera remboursé sous 24 h.`
          : `L'annonce « ${listingTitle} » a été modifiée. ${reason}`,
        { type: "marketplace_cancelled_seller", transactionId: tx.id }
      );
    }
  }

  private async refundIfNeeded(
    transactionId: string,
    buyerUserId: string,
    amount: number,
    currency: string,
    paymentProviderRef: string | null
  ): Promise<void> {
    if (amount <= 0) {
      return;
    }
    const prior = await this.prisma.marketplaceFundMovement.findFirst({
      where: {
        transactionId,
        kind: MarketplaceFundMovementKind.REFUND_BUYER
      }
    });
    if (prior) {
      return;
    }
    try {
      await this.escrow.refundBuyer(
        transactionId,
        buyerUserId,
        amount,
        currency,
        paymentProviderRef
      );
    } catch (e) {
      this.log.warn(`refund ${transactionId}: ${(e as Error).message}`);
    }
  }

  private async removeAnimalFromLotListing(
    listing: ListingRow,
    removedAnimalId: string
  ): Promise<void> {
    const currentIds = parseListingAnimalIds(listing);
    const remaining = currentIds.filter((id) => id !== removedAnimalId);
    if (remaining.length === currentIds.length) {
      return;
    }

    const removedWeight = await this.loadAnimalWeightKg(removedAnimalId);

    if (remaining.length === 0) {
      await this.cancelListingCompletely(
        listing,
        "Tous les animaux du lot ont été vendus hors marketplace."
      );
      await this.cancelIndividualListingsForAnimals(currentIds, listing.id);
      return;
    }

    const pricing = await this.computeLotPricing(listing, remaining);

    await this.prisma.marketplaceListing.update({
      where: { id: listing.id },
      data: {
        animalIds: remaining as Prisma.InputJsonValue,
        animalId: remaining.length === 1 ? remaining[0]! : remaining[0]!,
        totalWeightKg:
          pricing.totalWeightKg != null
            ? new Prisma.Decimal(pricing.totalWeightKg)
            : null,
        totalPrice: new Prisma.Decimal(pricing.totalPrice)
      }
    });

    if (remaining.length === 1) {
      const otherIndividual = await this.findIndividualListingForAnimal(
        remaining[0]!,
        listing.id
      );
      if (otherIndividual) {
        await this.cancelListingCompletely(
          otherIndividual,
          "Annonce individuelle remplacée par le lot devenu individuel."
        );
      }
    }

    await this.adjustLotEscrowTransactions(
      listing.id,
      listing.title,
      pricing.totalWeightKg,
      removedWeight
    );
  }

  private async computeLotPricing(
    listing: ListingRow,
    remainingAnimalIds: string[]
  ): Promise<{ totalWeightKg: number | null; totalPrice: number }> {
    const animals = await this.prisma.animal.findMany({
      where: { id: { in: remainingAnimalIds } },
      select: {
        id: true,
        soldWeightKg: true,
        entryWeightKg: true,
        weights: {
          orderBy: { measuredAt: "desc" },
          take: 1,
          select: { weightKg: true }
        }
      }
    });

    const flat = usesFlatListingPrice(listing.category);
    if (flat) {
      const unit =
        listing.unitPrice != null ? Number(listing.unitPrice) : null;
      const headcount = remainingAnimalIds.length;
      const totalPrice =
        unit != null && unit > 0
          ? unit * headcount
          : listing.totalPrice != null
            ? Number(listing.totalPrice)
            : 0;
      let totalWeight = 0;
      for (const id of remainingAnimalIds) {
        const a = animals.find((x) => x.id === id);
        totalWeight += a ? estimateAnimalWeightKg(a) : 80;
      }
      return { totalWeightKg: totalWeight, totalPrice };
    }

    let totalWeight = 0;
    for (const id of remainingAnimalIds) {
      const a = animals.find((x) => x.id === id);
      totalWeight += a ? estimateAnimalWeightKg(a) : 80;
    }

    const pricePerKg =
      listing.pricePerKg != null ? Number(listing.pricePerKg) : null;
    if (pricePerKg == null || pricePerKg <= 0) {
      const oldTotal =
        listing.totalPrice != null ? Number(listing.totalPrice) : 0;
      const oldWeight =
        listing.totalWeightKg != null ? Number(listing.totalWeightKg) : 1;
      const ratio = oldWeight > 0 ? totalWeight / oldWeight : 1;
      return {
        totalWeightKg: totalWeight,
        totalPrice: Math.max(0, oldTotal * ratio)
      };
    }

    return {
      totalWeightKg: totalWeight,
      totalPrice: pricePerKg * totalWeight
    };
  }

  private async loadAnimalWeightKg(animalId: string): Promise<number> {
    const animal = await this.prisma.animal.findUnique({
      where: { id: animalId },
      select: {
        soldWeightKg: true,
        entryWeightKg: true,
        weights: {
          orderBy: { measuredAt: "desc" },
          take: 1,
          select: { weightKg: true }
        }
      }
    });
    if (!animal) {
      return 80;
    }
    return estimateAnimalWeightKg(animal);
  }

  private async adjustLotEscrowTransactions(
    listingId: string,
    listingTitle: string,
    newEstimatedWeightKg: number | null,
    removedWeightKg: number
  ): Promise<void> {
    const txs = await this.prisma.marketplaceTransaction.findMany({
      where: {
        listingId,
        status: { notIn: TERMINAL_TX }
      }
    });

    for (const tx of txs) {
      if (tx.priceType === MarketplacePriceType.flat) {
        void this.push.sendToUser(
          tx.buyerUserId,
          "Lot modifié",
          `Un animal a quitté le lot « ${listingTitle} ». Le vendeur a ajusté l'annonce.`,
          { type: "marketplace_lot_adjusted", transactionId: tx.id, listingId }
        );
        continue;
      }

      const perKg = tx.agreedPricePerKg?.toNumber() ?? 0;
      const weightBefore =
        tx.arbitrationWeightKg?.toNumber() ??
        tx.realWeightKg?.toNumber() ??
        tx.estimatedWeightKg?.toNumber() ??
        0;

      const updateData: Prisma.MarketplaceTransactionUpdateInput = {};

      if (
        tx.status === MarketplaceTransactionStatus.WEIGHT_DECLARED ||
        tx.status === MarketplaceTransactionStatus.WEIGHT_DISPUTED ||
        tx.status === MarketplaceTransactionStatus.WEIGHT_VALIDATED
      ) {
        const adjustedWeight = Math.max(0, weightBefore - removedWeightKg);
        if (tx.arbitrationWeightKg != null) {
          updateData.arbitrationWeightKg = new Prisma.Decimal(adjustedWeight);
        } else if (tx.realWeightKg != null) {
          updateData.realWeightKg = new Prisma.Decimal(adjustedWeight);
        }
        const finalAmount = perKg * adjustedWeight;
        const blocked = Number(tx.blockedAmount);
        const settlement = settlementAmounts({
          blockedAmount: blocked,
          finalAmount,
          commissionRate: Number(tx.commissionRate)
        });
        if (settlement.buyerRefundAmount > 0) {
          await this.refundIfNeeded(
            tx.id,
            tx.buyerUserId,
            settlement.buyerRefundAmount,
            tx.currency,
            tx.paymentProviderRef
          );
        }
      } else if (newEstimatedWeightKg != null && newEstimatedWeightKg > 0) {
        updateData.estimatedWeightKg = new Prisma.Decimal(newEstimatedWeightKg);
        const newBlocked = calculateBlockedAmount({
          priceType: tx.priceType,
          agreedPricePerKg: perKg,
          agreedFlatPrice: null,
          estimatedWeightKg: newEstimatedWeightKg
        });
        const blocked = Number(tx.blockedAmount);
        if (REFUND_ON_CANCEL.includes(tx.status) && blocked > newBlocked) {
          await this.refundIfNeeded(
            tx.id,
            tx.buyerUserId,
            blocked - newBlocked,
            tx.currency,
            tx.paymentProviderRef
          );
        }
      }

      if (Object.keys(updateData).length > 0) {
        await this.prisma.marketplaceTransaction.update({
          where: { id: tx.id },
          data: updateData
        });
      }

      void this.push.sendToUser(
        tx.buyerUserId,
        "Lot modifié",
        `Un animal a quitté le lot « ${listingTitle} ». Le montant final sera recalculé selon le poids des sujets restants.`,
        { type: "marketplace_lot_adjusted", transactionId: tx.id, listingId }
      );
    }
  }
}
