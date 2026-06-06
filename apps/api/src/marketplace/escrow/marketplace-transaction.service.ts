import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef
} from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  ListingStatus,
  MarketplaceTransactionStatus,
  OfferStatus,
  Prisma,
  WeightValidatedBy
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { PlatformSettingsService } from "../../platform-settings/platform-settings.service";
import { PushNotificationsService } from "../../push-notifications/push-notifications.service";
import { ListingsService } from "../listings.service";
import { EscrowService } from "./escrow.service";
import {
  ACTIVE_ESCROW_STATUSES,
  CANCELLABLE_BY_BUYER,
  CANCELLABLE_BY_SELLER,
  agreedTermsFromOffer,
  calculateBlockedAmount,
  calculateFinalAmount,
  lastNMonthKeys,
  paymentExpiryDate,
  settlementAmounts
} from "./transaction.utils";

@Injectable()
export class MarketplaceTransactionService {
  private readonly log = new Logger(MarketplaceTransactionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly escrow: EscrowService,
    private readonly push: PushNotificationsService,
    private readonly platformSettings: PlatformSettingsService,
    @Inject(forwardRef(() => ListingsService))
    private readonly listings: ListingsService
  ) {}

  /** Crée une transaction escrow après acceptation d'offre (vendeur ou acheteur). */
  async createFromAcceptedOffer(offerId: string): Promise<{ transactionId: string }> {
    const offer = await this.prisma.marketplaceOffer.findUnique({
      where: { id: offerId },
      include: { listing: true }
    });
    if (!offer || offer.status !== OfferStatus.accepted) {
      throw new BadRequestException("Offre non acceptée");
    }
    const existing = await this.prisma.marketplaceTransaction.findUnique({
      where: { offerId }
    });
    if (existing) {
      return { transactionId: existing.id };
    }

    const listing = offer.listing;
    const terms = agreedTermsFromOffer(offer, listing);
    const blocked = calculateBlockedAmount({
      priceType: terms.priceType,
      agreedPricePerKg: terms.agreedPricePerKg,
      agreedFlatPrice: terms.agreedFlatPrice,
      estimatedWeightKg: terms.estimatedWeightKg
    });
    const commissionRate = await this.platformSettings.getMarketplaceCommissionRate();

    const tx = await this.prisma.marketplaceTransaction.create({
      data: {
        offerId: offer.id,
        listingId: listing.id,
        buyerUserId: offer.buyerUserId,
        sellerUserId: listing.sellerUserId,
        status: MarketplaceTransactionStatus.PAYMENT_PENDING,
        priceType: terms.priceType,
        agreedPricePerKg:
          terms.agreedPricePerKg != null
            ? new Prisma.Decimal(terms.agreedPricePerKg)
            : null,
        agreedFlatPrice:
          terms.agreedFlatPrice != null
            ? new Prisma.Decimal(terms.agreedFlatPrice)
            : null,
        estimatedWeightKg:
          terms.estimatedWeightKg != null
            ? new Prisma.Decimal(terms.estimatedWeightKg)
            : null,
        blockedAmount: new Prisma.Decimal(blocked),
        commissionRate: new Prisma.Decimal(commissionRate),
        offerExpiresAt: paymentExpiryDate(),
        currency: listing.currency ?? "XOF"
      }
    });

    return { transactionId: tx.id };
  }

  async getById(user: User, transactionId: string) {
    const tx = await this.prisma.marketplaceTransaction.findUnique({
      where: { id: transactionId },
      include: {
        listing: { select: { id: true, title: true, category: true } },
        offer: true
      }
    });
    if (!tx) {
      throw new NotFoundException("Transaction introuvable");
    }
    if (tx.buyerUserId !== user.id && tx.sellerUserId !== user.id) {
      throw new ForbiddenException();
    }
    return this.serialize(tx);
  }

  async initiatePayment(user: User, transactionId: string) {
    const tx = await this.requireBuyer(transactionId, user.id);
    if (tx.status !== MarketplaceTransactionStatus.PAYMENT_PENDING) {
      throw new BadRequestException("Paiement non requis pour cette transaction");
    }
    const amount = Number(tx.blockedAmount);
    const hold = await this.escrow.holdFunds(
      tx.id,
      tx.buyerUserId,
      amount,
      tx.currency,
      `Marketplace ${tx.listingId}`
    );
    await this.prisma.marketplaceTransaction.update({
      where: { id: tx.id },
      data: {
        paymentProviderRef: hold.providerRef,
        paymentInitiatedAt: new Date()
      }
    });
    return {
      providerRef: hold.providerRef,
      amount,
      currency: tx.currency
    };
  }

  async confirmPayment(user: User, transactionId: string, providerRef?: string) {
    const tx = await this.requireBuyer(transactionId, user.id);
    if (tx.status !== MarketplaceTransactionStatus.PAYMENT_PENDING) {
      throw new BadRequestException("Statut invalide");
    }
    const ref = providerRef ?? tx.paymentProviderRef;
    if (!ref) {
      throw new BadRequestException("Référence paiement manquante");
    }
    const ok = await this.escrow.confirmHold(ref);
    if (!ok) {
      await this.prisma.marketplaceTransaction.update({
        where: { id: tx.id },
        data: { status: MarketplaceTransactionStatus.PAYMENT_FAILED }
      });
      throw new BadRequestException("Paiement refusé");
    }

    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: tx.listingId },
      select: { title: true }
    });

    await this.prisma.$transaction([
      this.prisma.marketplaceTransaction.update({
        where: { id: tx.id },
        data: {
          status: MarketplaceTransactionStatus.PAYMENT_HELD,
          paymentConfirmedAt: new Date(),
          paymentProviderRef: ref
        }
      }),
      this.prisma.marketplaceListing.update({
        where: { id: tx.listingId },
        data: { activeOfferCount: { increment: 1 } }
      })
    ]);

    const amountLabel = `${Math.round(Number(tx.blockedAmount)).toLocaleString("fr-FR")} ${tx.currency}`;
    void this.push.sendToUser(
      tx.sellerUserId,
      "Paiement sécurisé",
      `Un acheteur a sécurisé ${amountLabel} pour « ${listing?.title ?? "votre annonce"} ». Coordonnez la livraison.`,
      { type: "marketplace_payment_held", transactionId: tx.id, listingId: tx.listingId }
    );

    return this.getById(user, tx.id);
  }

  async schedulePickup(
    user: User,
    transactionId: string,
    pickupDate: string,
    pickupLocation: string,
    notes?: string
  ) {
    const tx = await this.requireParticipant(transactionId, user.id);
    if (tx.status !== MarketplaceTransactionStatus.PAYMENT_HELD) {
      throw new BadRequestException("Planification impossible à ce stade");
    }
    const date = new Date(pickupDate);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException("Date invalide");
    }
    await this.prisma.marketplaceTransaction.update({
      where: { id: tx.id },
      data: {
        status: MarketplaceTransactionStatus.PICKUP_SCHEDULED,
        pickupDate: date,
        pickupLocation: pickupLocation.trim(),
        cancelReason: notes?.trim() || undefined
      }
    });
    const msg = `Livraison planifiée le ${date.toLocaleDateString("fr-FR")} à ${pickupLocation.trim()}.`;
    void this.push.sendToUser(tx.buyerUserId, "Livraison planifiée", msg, {
      type: "marketplace_pickup_scheduled",
      transactionId: tx.id
    });
    void this.push.sendToUser(tx.sellerUserId, "Livraison planifiée", msg, {
      type: "marketplace_pickup_scheduled",
      transactionId: tx.id
    });
    return this.getById(user, tx.id);
  }

  async declareWeight(
    user: User,
    transactionId: string,
    realWeightKg: number,
    photoUrl?: string
  ) {
    const tx = await this.requireBuyer(transactionId, user.id);
    if (
      tx.status !== MarketplaceTransactionStatus.PICKUP_SCHEDULED &&
      tx.status !== MarketplaceTransactionStatus.PAYMENT_HELD
    ) {
      throw new BadRequestException("Déclaration de poids impossible");
    }
    if (!Number.isFinite(realWeightKg) || realWeightKg <= 0) {
      throw new BadRequestException("Poids invalide");
    }
    await this.prisma.marketplaceTransaction.update({
      where: { id: tx.id },
      data: {
        status: MarketplaceTransactionStatus.WEIGHT_DECLARED,
        realWeightKg: new Prisma.Decimal(realWeightKg),
        weightDeclaredByBuyerAt: new Date(),
        weightScalePhotoUrl: photoUrl?.trim() || null
      }
    });
    void this.push.sendToUser(
      tx.sellerUserId,
      "Poids déclaré",
      `L'acheteur déclare un poids de ${realWeightKg.toLocaleString("fr-FR")} kg. Confirmez ou contestez sous 24 h.`,
      { type: "marketplace_weight_declared", transactionId: tx.id }
    );
    return this.getById(user, tx.id);
  }

  async validateWeight(user: User, transactionId: string) {
    const tx = await this.requireSeller(transactionId, user.id);
    if (tx.status !== MarketplaceTransactionStatus.WEIGHT_DECLARED) {
      throw new BadRequestException("Aucun poids à valider");
    }
    await this.prisma.marketplaceTransaction.update({
      where: { id: tx.id },
      data: {
        status: MarketplaceTransactionStatus.WEIGHT_VALIDATED,
        weightValidatedAt: new Date(),
        weightValidatedBy: WeightValidatedBy.seller
      }
    });
    await this.settleTransaction(tx.id);
    return this.getById(user, tx.id);
  }

  async disputeWeight(user: User, transactionId: string, reason?: string) {
    const tx = await this.requireSeller(transactionId, user.id);
    if (tx.status !== MarketplaceTransactionStatus.WEIGHT_DECLARED) {
      throw new BadRequestException("Contestatio impossible");
    }
    await this.prisma.marketplaceTransaction.update({
      where: { id: tx.id },
      data: {
        status: MarketplaceTransactionStatus.WEIGHT_DISPUTED,
        weightDisputeOpenedAt: new Date(),
        cancelReason: reason?.trim() || null
      }
    });
    void this.push.sendToUser(
      tx.buyerUserId,
      "Poids contesté",
      "Le vendeur conteste le poids déclaré. Un arbitrage est en cours.",
      { type: "marketplace_weight_disputed", transactionId: tx.id }
    );
    const admins = await this.prisma.superAdmin.findMany({
      select: { userId: true }
    });
    for (const a of admins) {
      void this.push.sendToUser(
        a.userId,
        "Litige poids marketplace",
        `Transaction ${tx.id} — arbitrage requis.`,
        { type: "marketplace_dispute_admin", transactionId: tx.id }
      );
    }
    return this.getById(user, tx.id);
  }

  async arbitrateWeight(
    adminUserId: string,
    transactionId: string,
    arbitrationWeightKg: number
  ) {
    const tx = await this.prisma.marketplaceTransaction.findUnique({
      where: { id: transactionId }
    });
    if (!tx || tx.status !== MarketplaceTransactionStatus.WEIGHT_DISPUTED) {
      throw new BadRequestException("Litige introuvable");
    }
    if (!Number.isFinite(arbitrationWeightKg) || arbitrationWeightKg <= 0) {
      throw new BadRequestException("Poids arbitré invalide");
    }
    await this.prisma.marketplaceTransaction.update({
      where: { id: tx.id },
      data: {
        status: MarketplaceTransactionStatus.WEIGHT_VALIDATED,
        arbitrationWeightKg: new Prisma.Decimal(arbitrationWeightKg),
        weightValidatedAt: new Date(),
        weightValidatedBy: WeightValidatedBy.superadmin
      }
    });
    await this.settleTransaction(tx.id);
    return { ok: true };
  }

  async cancelByBuyer(user: User, transactionId: string) {
    const tx = await this.requireBuyer(transactionId, user.id);
    if (!CANCELLABLE_BY_BUYER.includes(tx.status)) {
      throw new BadRequestException("Annulation impossible à ce stade");
    }
    if (tx.status === MarketplaceTransactionStatus.PAYMENT_HELD ||
        tx.status === MarketplaceTransactionStatus.PICKUP_SCHEDULED) {
      await this.escrow.refundBuyer(
        tx.id,
        tx.buyerUserId,
        Number(tx.blockedAmount),
        tx.currency,
        tx.paymentProviderRef
      );
      await this.decrementActiveOfferCount(tx.listingId);
    }
    await this.prisma.marketplaceTransaction.update({
      where: { id: tx.id },
      data: {
        status: MarketplaceTransactionStatus.CANCELLED_BY_BUYER,
        cancelledAt: new Date()
      }
    });
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: tx.listingId },
      select: { title: true }
    });
    void this.push.sendToUser(
      tx.sellerUserId,
      "Offre annulée",
      `Un acheteur a annulé son offre pour « ${listing?.title ?? "votre annonce"} ».`,
      { type: "marketplace_cancelled_buyer", transactionId: tx.id }
    );
    return { ok: true };
  }

  async cancelBySeller(user: User, listingId: string, reason?: string) {
    const listing = await this.prisma.marketplaceListing.findFirst({
      where: { id: listingId, sellerUserId: user.id }
    });
    if (!listing) {
      throw new NotFoundException("Annonce introuvable");
    }
    const active = await this.prisma.marketplaceTransaction.findMany({
      where: {
        listingId,
        status: { in: CANCELLABLE_BY_SELLER }
      }
    });
    for (const tx of active) {
      if (
        tx.status === MarketplaceTransactionStatus.PAYMENT_HELD ||
        tx.status === MarketplaceTransactionStatus.PICKUP_SCHEDULED ||
        tx.status === MarketplaceTransactionStatus.WEIGHT_DECLARED
      ) {
        await this.escrow.refundBuyer(
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
          cancelReason: reason?.trim() || null
        }
      });
      const amountLabel = `${Math.round(Number(tx.blockedAmount)).toLocaleString("fr-FR")} ${tx.currency}`;
      void this.push.sendToUser(
        tx.buyerUserId,
        "Vente annulée",
        `Le vendeur a annulé. Votre paiement de ${amountLabel} sera remboursé sous 24 h.`,
        { type: "marketplace_cancelled_seller", transactionId: tx.id }
      );
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        reputationScore: { decrement: 1 },
        cancelledAsSellerCount: { increment: 1 }
      }
    });
    await this.prisma.marketplaceListing.update({
      where: { id: listingId },
      data: { activeOfferCount: 0, status: ListingStatus.cancelled }
    });
    return { cancelled: active.length };
  }

  async handleExpiredPayments(): Promise<number> {
    const now = new Date();
    const expired = await this.prisma.marketplaceTransaction.findMany({
      where: {
        status: MarketplaceTransactionStatus.PAYMENT_PENDING,
        offerExpiresAt: { lt: now }
      }
    });
    for (const tx of expired) {
      await this.prisma.marketplaceTransaction.update({
        where: { id: tx.id },
        data: { status: MarketplaceTransactionStatus.OFFER_EXPIRED, cancelledAt: now }
      });
      await this.prisma.marketplaceOffer.update({
        where: { id: tx.offerId },
        data: { status: OfferStatus.rejected }
      });
      void this.push.sendToUser(
        tx.buyerUserId,
        "Offre expirée",
        "Votre offre a expiré faute de paiement. Le sujet est de nouveau disponible.",
        { type: "marketplace_offer_expired", transactionId: tx.id }
      );
    }
    return expired.length;
  }

  async handleAutoValidateWeights(): Promise<number> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await this.prisma.marketplaceTransaction.findMany({
      where: {
        status: MarketplaceTransactionStatus.WEIGHT_DECLARED,
        weightDeclaredByBuyerAt: { lte: cutoff }
      }
    });
    for (const tx of rows) {
      await this.prisma.marketplaceTransaction.update({
        where: { id: tx.id },
        data: {
          status: MarketplaceTransactionStatus.WEIGHT_VALIDATED,
          weightValidatedAt: new Date(),
          weightValidatedBy: WeightValidatedBy.auto
        }
      });
      void this.push.sendToUser(
        tx.buyerUserId,
        "Poids validé",
        "Poids validé automatiquement. Règlement en cours.",
        { type: "marketplace_weight_auto_validated", transactionId: tx.id }
      );
      void this.push.sendToUser(
        tx.sellerUserId,
        "Poids validé",
        "Poids validé automatiquement. Règlement en cours.",
        { type: "marketplace_weight_auto_validated", transactionId: tx.id }
      );
      await this.settleTransaction(tx.id);
    }
    return rows.length;
  }

  async settleTransaction(transactionId: string): Promise<void> {
    const tx = await this.prisma.marketplaceTransaction.findUnique({
      where: { id: transactionId },
      include: { listing: true, offer: true }
    });
    if (!tx || tx.status !== MarketplaceTransactionStatus.WEIGHT_VALIDATED) {
      return;
    }

    const finalAmount = calculateFinalAmount(tx);
    const blocked = Number(tx.blockedAmount);
    const rate = Number(tx.commissionRate);
    const amounts = settlementAmounts({
      blockedAmount: blocked,
      finalAmount,
      commissionRate: rate
    });

    if (amounts.buyerAdditionalCharge > 0) {
      const charged = await this.escrow.chargeAdditional(
        tx.id,
        tx.buyerUserId,
        amounts.buyerAdditionalCharge,
        tx.currency
      );
      if (!charged) {
        throw new BadRequestException("Échec du complément de paiement");
      }
    }

    if (amounts.buyerRefundAmount > 0) {
      await this.escrow.refundBuyer(
        tx.id,
        tx.buyerUserId,
        amounts.buyerRefundAmount,
        tx.currency,
        tx.paymentProviderRef
      );
    }

    await this.escrow.releaseFundsToSeller(
      tx.id,
      amounts.sellerReceivedAmount,
      tx.currency
    );
    await this.escrow.collectCommission(
      tx.id,
      amounts.commissionAmount,
      tx.currency
    );

    const seller = await this.prisma.user.findUnique({
      where: { id: tx.sellerUserId }
    });
    if (seller) {
      const weightKg =
        tx.arbitrationWeightKg?.toNumber() ??
        tx.realWeightKg?.toNumber() ??
        tx.estimatedWeightKg?.toNumber() ??
        0;
      try {
        await this.listings.completeHandover(seller, tx.listingId, {
          offerId: tx.offerId,
          soldWeightKg: weightKg,
          totalPrice: finalAmount,
          soldAt: new Date().toISOString()
        });
      } catch (e) {
        this.log.warn(`handover after settle ${tx.id}: ${(e as Error).message}`);
      }
    }

    await this.prisma.$transaction([
      this.prisma.marketplaceTransaction.update({
        where: { id: tx.id },
        data: {
          status: MarketplaceTransactionStatus.TRANSACTION_CLOSED,
          finalAmount: new Prisma.Decimal(finalAmount),
          commissionAmount: new Prisma.Decimal(amounts.commissionAmount),
          sellerReceivedAmount: new Prisma.Decimal(amounts.sellerReceivedAmount),
          buyerRefundAmount: new Prisma.Decimal(amounts.buyerRefundAmount),
          buyerAdditionalCharge: new Prisma.Decimal(amounts.buyerAdditionalCharge)
        }
      }),
      this.prisma.platformRevenue.create({
        data: {
          transactionId: tx.id,
          sellerId: tx.sellerUserId,
          buyerId: tx.buyerUserId,
          grossAmount: new Prisma.Decimal(finalAmount),
          commissionRate: tx.commissionRate,
          commissionAmount: new Prisma.Decimal(amounts.commissionAmount)
        }
      }),
      this.prisma.marketplaceListing.update({
        where: { id: tx.listingId },
        data: { status: ListingStatus.sold, activeOfferCount: 0 }
      })
    ]);

    await this.refundOtherHeldTransactions(tx.listingId, tx.id);

    const sellerLabel = `${Math.round(amounts.sellerReceivedAmount).toLocaleString("fr-FR")} ${tx.currency}`;
    void this.push.sendToUser(
      tx.sellerUserId,
      "Transaction finalisée",
      `Paiement reçu : ${sellerLabel}. Transaction finalisée.`,
      { type: "marketplace_transaction_closed", transactionId: tx.id }
    );
    const refundNote =
      amounts.buyerRefundAmount > 0
        ? ` Remboursement de ${Math.round(amounts.buyerRefundAmount).toLocaleString("fr-FR")} ${tx.currency} en cours.`
        : "";
    void this.push.sendToUser(
      tx.buyerUserId,
      "Transaction finalisée",
      `Transaction finalisée.${refundNote}`,
      { type: "marketplace_transaction_closed", transactionId: tx.id }
    );
  }

  private async refundOtherHeldTransactions(
    listingId: string,
    winningTransactionId: string
  ): Promise<void> {
    const others = await this.prisma.marketplaceTransaction.findMany({
      where: {
        listingId,
        id: { not: winningTransactionId },
        status: { in: ACTIVE_ESCROW_STATUSES }
      }
    });
    for (const tx of others) {
      await this.escrow.refundBuyer(
        tx.id,
        tx.buyerUserId,
        Number(tx.blockedAmount),
        tx.currency,
        tx.paymentProviderRef
      );
      await this.prisma.marketplaceTransaction.update({
        where: { id: tx.id },
        data: {
          status: MarketplaceTransactionStatus.CANCELLED_SOLD_TO_OTHER,
          cancelledAt: new Date(),
          buyerRefundAmount: tx.blockedAmount
        }
      });
      const amountLabel = `${Math.round(Number(tx.blockedAmount)).toLocaleString("fr-FR")} ${tx.currency}`;
      void this.push.sendToUser(
        tx.buyerUserId,
        "Sujet vendu ailleurs",
        `Ce sujet a été vendu à un autre acheteur. Votre paiement de ${amountLabel} sera remboursé sous 24 h.`,
        { type: "marketplace_cancelled_sold_to_other", transactionId: tx.id }
      );
    }
  }

  private async decrementActiveOfferCount(listingId: string) {
    await this.prisma.marketplaceListing.update({
      where: { id: listingId },
      data: { activeOfferCount: { decrement: 1 } }
    });
  }

  private async requireBuyer(transactionId: string, userId: string) {
    const tx = await this.prisma.marketplaceTransaction.findUnique({
      where: { id: transactionId }
    });
    if (!tx) throw new NotFoundException("Transaction introuvable");
    if (tx.buyerUserId !== userId) throw new ForbiddenException();
    return tx;
  }

  private async requireSeller(transactionId: string, userId: string) {
    const tx = await this.prisma.marketplaceTransaction.findUnique({
      where: { id: transactionId }
    });
    if (!tx) throw new NotFoundException("Transaction introuvable");
    if (tx.sellerUserId !== userId) throw new ForbiddenException();
    return tx;
  }

  private async requireParticipant(transactionId: string, userId: string) {
    const tx = await this.prisma.marketplaceTransaction.findUnique({
      where: { id: transactionId }
    });
    if (!tx) throw new NotFoundException("Transaction introuvable");
    if (tx.buyerUserId !== userId && tx.sellerUserId !== userId) {
      throw new ForbiddenException();
    }
    return tx;
  }

  private serialize(
    tx: Awaited<
      ReturnType<PrismaService["marketplaceTransaction"]["findUnique"]>
    > & {
      listing?: { id: string; title: string; category: string | null };
    }
  ) {
    if (!tx) return null;
    return {
      id: tx.id,
      listingId: tx.listingId,
      offerId: tx.offerId,
      buyerUserId: tx.buyerUserId,
      sellerUserId: tx.sellerUserId,
      status: tx.status,
      priceType: tx.priceType,
      agreedPricePerKg: tx.agreedPricePerKg ? Number(tx.agreedPricePerKg) : null,
      agreedFlatPrice: tx.agreedFlatPrice ? Number(tx.agreedFlatPrice) : null,
      estimatedWeightKg: tx.estimatedWeightKg
        ? Number(tx.estimatedWeightKg)
        : null,
      blockedAmount: Number(tx.blockedAmount),
      finalAmount: tx.finalAmount ? Number(tx.finalAmount) : null,
      realWeightKg: tx.realWeightKg ? Number(tx.realWeightKg) : null,
      pickupDate: tx.pickupDate?.toISOString().slice(0, 10) ?? null,
      pickupLocation: tx.pickupLocation,
      currency: tx.currency,
      offerExpiresAt: tx.offerExpiresAt.toISOString(),
      listingTitle: tx.listing?.title ?? null
    };
  }

  async listForUser(user: User) {
    const rows = await this.prisma.marketplaceTransaction.findMany({
      where: {
        OR: [{ buyerUserId: user.id }, { sellerUserId: user.id }]
      },
      orderBy: { updatedAt: "desc" },
      include: {
        listing: { select: { id: true, title: true, category: true } }
      },
      take: 100
    });
    return rows.map((tx) => this.serialize(tx));
  }

  /** Synthèse finance marketplace (fonds bloqués acheteur / revenus en attente vendeur). */
  async getFinanceSummary(user: User) {
    const heldStatuses = [
      MarketplaceTransactionStatus.PAYMENT_HELD,
      MarketplaceTransactionStatus.PICKUP_SCHEDULED,
      MarketplaceTransactionStatus.WEIGHT_DECLARED,
      MarketplaceTransactionStatus.WEIGHT_DISPUTED,
      MarketplaceTransactionStatus.WEIGHT_VALIDATED
    ];

    const [asBuyer, asSeller, closedBuyer, closedSeller, closedRows, heldRows] =
      await Promise.all([
      this.prisma.marketplaceTransaction.findMany({
        where: {
          buyerUserId: user.id,
          status: { in: heldStatuses }
        },
        include: {
          listing: { select: { id: true, title: true } },
          seller: { select: { id: true, fullName: true } }
        },
        orderBy: { updatedAt: "desc" }
      }),
      this.prisma.marketplaceTransaction.findMany({
        where: {
          sellerUserId: user.id,
          status: { in: heldStatuses }
        },
        include: {
          listing: { select: { id: true, title: true } },
          buyer: { select: { id: true, fullName: true } }
        },
        orderBy: { updatedAt: "desc" }
      }),
      this.prisma.marketplaceTransaction.aggregate({
        where: {
          buyerUserId: user.id,
          status: MarketplaceTransactionStatus.TRANSACTION_CLOSED
        },
        _sum: { finalAmount: true }
      }),
      this.prisma.marketplaceTransaction.aggregate({
        where: {
          sellerUserId: user.id,
          status: MarketplaceTransactionStatus.TRANSACTION_CLOSED
        },
        _sum: { sellerReceivedAmount: true }
      }),
      this.prisma.marketplaceTransaction.findMany({
        where: {
          OR: [{ buyerUserId: user.id }, { sellerUserId: user.id }],
          status: MarketplaceTransactionStatus.TRANSACTION_CLOSED,
          updatedAt: {
            gte: new Date(
              Date.UTC(
                new Date().getUTCFullYear(),
                new Date().getUTCMonth() - 5,
                1
              )
            )
          }
        },
        select: {
          buyerUserId: true,
          sellerUserId: true,
          sellerReceivedAmount: true,
          finalAmount: true,
          updatedAt: true
        }
      }),
      this.prisma.marketplaceTransaction.findMany({
        where: {
          OR: [{ buyerUserId: user.id }, { sellerUserId: user.id }],
          status: { in: heldStatuses }
        },
        select: {
          buyerUserId: true,
          sellerUserId: true,
          blockedAmount: true,
          paymentConfirmedAt: true,
          updatedAt: true
        }
      })
    ]);

    const blockedFunds = asBuyer.reduce(
      (sum, tx) => sum + Number(tx.blockedAmount),
      0
    );
    const pendingRevenue = asSeller.reduce(
      (sum, tx) => sum + Number(tx.blockedAmount),
      0
    );

    const monthKeys = lastNMonthKeys(6);
    const monthlyMap = new Map(
      monthKeys.map((month) => [
        month,
        {
          month,
          confirmedRevenue: 0,
          pendingRevenue: 0,
          confirmedSpent: 0,
          blockedFunds: 0
        }
      ])
    );

    for (const tx of closedRows) {
      const month = tx.updatedAt.toISOString().slice(0, 7);
      const bucket = monthlyMap.get(month);
      if (!bucket) continue;
      if (tx.sellerUserId === user.id) {
        bucket.confirmedRevenue += Number(tx.sellerReceivedAmount ?? 0);
      }
      if (tx.buyerUserId === user.id) {
        bucket.confirmedSpent += Number(tx.finalAmount ?? 0);
      }
    }

    for (const tx of heldRows) {
      const ref = tx.paymentConfirmedAt ?? tx.updatedAt;
      const month = ref.toISOString().slice(0, 7);
      const bucket = monthlyMap.get(month);
      if (!bucket) continue;
      if (tx.sellerUserId === user.id) {
        bucket.pendingRevenue += Number(tx.blockedAmount);
      }
      if (tx.buyerUserId === user.id) {
        bucket.blockedFunds += Number(tx.blockedAmount);
      }
    }

    const monthlySeries = monthKeys.map((month) => monthlyMap.get(month)!);

    return {
      blockedFunds,
      pendingRevenue,
      totalSpent: Number(closedBuyer._sum.finalAmount ?? 0),
      confirmedRevenue: Number(closedSeller._sum.sellerReceivedAmount ?? 0),
      currency: asBuyer[0]?.currency ?? asSeller[0]?.currency ?? "XOF",
      monthlySeries,
      blockedTransactions: asBuyer.map((tx) => ({
        id: tx.id,
        listingId: tx.listingId,
        listingTitle: tx.listing.title,
        blockedAmount: Number(tx.blockedAmount),
        status: tx.status,
        sellerName: tx.seller.fullName
      })),
      pendingTransactions: asSeller.map((tx) => ({
        id: tx.id,
        listingId: tx.listingId,
        listingTitle: tx.listing.title,
        blockedAmount: Number(tx.blockedAmount),
        status: tx.status,
        buyerName: tx.buyer.fullName
      }))
    };
  }

  async listDisputesForAdmin() {
    return this.prisma.marketplaceTransaction.findMany({
      where: { status: MarketplaceTransactionStatus.WEIGHT_DISPUTED },
      orderBy: { weightDisputeOpenedAt: "asc" },
      include: {
        listing: { select: { title: true } },
        buyer: { select: { fullName: true, email: true } },
        seller: { select: { fullName: true, email: true } }
      }
    });
  }

  async listForAdmin(status?: string) {
    const where: Prisma.MarketplaceTransactionWhereInput = status
      ? { status: status as MarketplaceTransactionStatus }
      : {};
    return this.prisma.marketplaceTransaction.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: {
        listing: { select: { id: true, title: true } },
        buyer: { select: { id: true, fullName: true, email: true } },
        seller: { select: { id: true, fullName: true, email: true } }
      }
    });
  }

  /** Dashboard commissions plateforme (superadmin). */
  async getPlatformRevenueAdmin(period?: string) {
    const days =
      period === "7d" ? 7 : period === "90d" ? 90 : period === "all" ? 0 : 30;
    const since =
      days > 0 ? new Date(Date.now() - days * 86_400_000) : undefined;
    const where = since ? { collectedAt: { gte: since } } : {};

    const [rows, agg] = await Promise.all([
      this.prisma.platformRevenue.findMany({
        where,
        orderBy: { collectedAt: "desc" },
        take: 100,
        include: {
          transaction: {
            select: {
              listing: { select: { title: true } }
            }
          }
        }
      }),
      this.prisma.platformRevenue.aggregate({
        where,
        _sum: { commissionAmount: true, grossAmount: true },
        _count: true
      })
    ]);

    const byDay = new Map<string, number>();
    for (const row of rows) {
      const key = row.collectedAt.toISOString().slice(0, 10);
      const cur = byDay.get(key) ?? 0;
      byDay.set(key, cur + Number(row.commissionAmount));
    }

    const series = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, commission]) => ({ date, commission }));

    return {
      period: days === 0 ? "all" : `${days}d`,
      totalCommission: Number(agg._sum.commissionAmount ?? 0),
      totalGross: Number(agg._sum.grossAmount ?? 0),
      transactionCount: agg._count,
      series,
      recent: rows.map((r) => ({
        id: r.id,
        transactionId: r.transactionId,
        listingTitle:
          r.transaction?.listing?.title ??
          r.transactionId?.slice(0, 8) ??
          r.id.slice(0, 8),
        commissionAmount: Number(r.commissionAmount),
        grossAmount: Number(r.grossAmount),
        commissionRate: Number(r.commissionRate),
        collectedAt: r.collectedAt.toISOString()
      }))
    };
  }
}
