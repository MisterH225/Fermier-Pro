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
  AnimalOrigin,
  ListingStatus,
  MarketplaceDeliveryDisputeStatus,
  MarketplaceFundMovementKind,
  MarketplacePriceType,
  MarketplaceReceiptCondition,
  MarketplaceShipmentMethod,
  MarketplaceTransactionStatus,
  OfferStatus,
  LivestockExitKind,
  OfferType,
  Prisma,
  WeightValidatedBy
} from "@prisma/client";
import { FarmAccessService } from "../../common/farm-access.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { ResolveDeliveryDisputeDto } from "../dto/resolve-delivery-dispute.dto";
import { PlatformSettingsService } from "../../platform-settings/platform-settings.service";
import { PushNotificationsService } from "../../push-notifications/push-notifications.service";
import { BuyerProfileDetectorService } from "../buyer-profile-detector.service";
import { CreditOffersService } from "../credit/credit-offers.service";
import { ListingsService } from "../listings.service";
import { ReceiptService } from "../receipts/receipt.service";
import { EscrowService } from "./escrow.service";
import {
  ACTIVE_ESCROW_STATUSES,
  CANCELLABLE_BY_BUYER,
  CANCELLABLE_BY_SELLER,
  PICKUP_CONFIRM_STATUSES,
  SHIPMENT_CONFIRM_STATUSES,
  agreedTermsFromOffer,
  calculateAgreedDealAmount,
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
    private readonly listings: ListingsService,
    private readonly receipts: ReceiptService,
    private readonly buyerProfiles: BuyerProfileDetectorService,
    private readonly farmAccess: FarmAccessService,
    @Inject(forwardRef(() => CreditOffersService))
    private readonly creditOffers: CreditOffersService
  ) {}

  /** Transaction crédit — avance bloquée en escrow jusqu'à la livraison. */
  async createCreditAdvanceTransaction(
    offerId: string
  ): Promise<{ transactionId: string }> {
    const offer = await this.prisma.marketplaceOffer.findUnique({
      where: { id: offerId },
      include: { listing: true }
    });
    if (!offer || offer.offerType !== OfferType.credit) {
      throw new BadRequestException("Offre crédit invalide");
    }
    const existing = await this.prisma.marketplaceTransaction.findUnique({
      where: { offerId }
    });
    if (existing) {
      return { transactionId: existing.id };
    }
    const advance = Number(offer.advanceAmount ?? 0);
    if (!Number.isFinite(advance) || advance <= 0) {
      throw new BadRequestException("Montant d'avance invalide");
    }
    const listing = offer.listing;
    const terms = agreedTermsFromOffer(offer, listing);
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
        blockedAmount: new Prisma.Decimal(advance),
        commissionRate: new Prisma.Decimal(commissionRate),
        offerExpiresAt: paymentExpiryDate(),
        currency: listing.currency ?? "XOF",
        isCredit: true
      }
    });
    return { transactionId: tx.id };
  }

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
        listing: {
          select: {
            id: true,
            title: true,
            category: true,
            status: true,
            animalId: true,
            animalIds: true
          }
        },
        offer: true,
        receipt: {
          select: {
            id: true,
            receiptNumber: true,
            generatedAt: true
          }
        },
        pendingTransfers: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
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

  async getPendingTransfer(user: User, transactionId: string) {
    const tx = await this.requireBuyer(transactionId, user.id);
    const pending = await this.prisma.marketplacePendingTransfer.findFirst({
      where: {
        transactionId: tx.id,
        buyerUserId: user.id,
        completedAt: null,
        cancelledAt: null
      },
      orderBy: { createdAt: "desc" }
    });
    if (!pending) {
      throw new NotFoundException("Aucun transfert en attente");
    }
    return this.serializePendingTransfer(pending);
  }

  async completePendingTransfer(
    user: User,
    transactionId: string,
    params: { buyerFarmId?: string; penId?: string }
  ) {
    const tx = await this.requireBuyer(transactionId, user.id);
    if (tx.status !== MarketplaceTransactionStatus.TRANSACTION_CLOSED) {
      throw new BadRequestException(
        "Le transfert cheptel n'est disponible qu'après clôture de la transaction"
      );
    }
    const pending = await this.prisma.marketplacePendingTransfer.findFirst({
      where: {
        transactionId: tx.id,
        buyerUserId: user.id,
        completedAt: null,
        cancelledAt: null
      },
      include: {
        transaction: {
          include: {
            listing: { include: { farm: { select: { name: true } } } }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    if (!pending) {
      throw new NotFoundException("Aucun transfert en attente");
    }
    if (pending.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("Ce transfert a expiré");
    }

    const farmId = params.buyerFarmId?.trim() || pending.buyerFarmId;
    if (!farmId) {
      throw new BadRequestException(
        "Sélectionnez la ferme destinataire de vos animaux"
      );
    }
    await this.farmAccess.requireFarmAccess(user.id, farmId);

    if (params.penId) {
      const pen = await this.prisma.pen.findFirst({
        where: { id: params.penId, barn: { farmId } }
      });
      if (!pen) {
        throw new BadRequestException("Loge introuvable sur cette ferme");
      }
    }

    const sourceIds = Array.isArray(pending.animalIds)
      ? pending.animalIds.filter((v): v is string => typeof v === "string")
      : [];
    if (sourceIds.length === 0) {
      throw new BadRequestException("Aucun animal à transférer");
    }

    const sourceAnimals = await this.prisma.animal.findMany({
      where: { id: { in: sourceIds } }
    });
    if (sourceAnimals.length === 0) {
      throw new BadRequestException("Animaux source introuvables");
    }

    const sellerFarmName =
      pending.transaction.listing.farm?.name ?? "Marketplace";
    const entryDate = new Date();
    entryDate.setUTCHours(0, 0, 0, 0);

    const createdAnimalIds = await this.prisma.$transaction(async (db) => {
      const imported: string[] = [];
      for (const src of sourceAnimals) {
        const tag = src.tagCode ?? src.publicId.slice(0, 8);
        const created = await db.animal.create({
          data: {
            farmId,
            speciesId: src.speciesId,
            breedId: src.breedId,
            sex: src.sex,
            productionCategory: src.productionCategory,
            birthDate: src.birthDate,
            ageWeeksAtEntry: src.ageWeeksAtEntry,
            entryDate,
            entryWeightKg: src.soldWeightKg ?? src.entryWeightKg,
            origin: AnimalOrigin.purchased,
            supplier: sellerFarmName,
            notes: `Achat marketplace — transaction ${tx.id} (source ${tag})`,
            status: "active",
            photoUrl: src.photoUrl
          }
        });
        if (params.penId) {
          await db.penPlacement.create({
            data: {
              penId: params.penId,
              animalId: created.id,
              createdByUserId: user.id
            }
          });
        }
        imported.push(created.id);
      }
      await db.marketplacePendingTransfer.update({
        where: { id: pending.id },
        data: {
          completedAt: new Date(),
          buyerFarmId: farmId
        }
      });
      return imported;
    });

    void this.push.sendToUser(
      user.id,
      "Animaux ajoutés au cheptel",
      `${createdAnimalIds.length} animal(aux) importé(s) dans votre ferme.`,
      {
        type: "marketplace_pending_transfer_completed",
        transactionId: tx.id,
        buyerFarmId: farmId
      }
    );

    return {
      ok: true,
      animalIds: createdAnimalIds,
      pendingTransfer: await this.prisma.marketplacePendingTransfer.findUnique({
        where: { id: pending.id }
      }).then((row) => (row ? this.serializePendingTransfer(row) : null))
    };
  }

  async resolveDeliveryDispute(
    adminUserId: string,
    disputeId: string,
    dto: ResolveDeliveryDisputeDto
  ) {
    const dispute = await this.prisma.marketplaceDeliveryDispute.findUnique({
      where: { id: disputeId },
      include: {
        transaction: true,
        listing: true
      }
    });
    if (!dispute) {
      throw new NotFoundException("Litige introuvable");
    }
    if (dispute.status !== MarketplaceDeliveryDisputeStatus.open) {
      throw new BadRequestException("Litige déjà résolu");
    }
    const tx = dispute.transaction;
    if (tx.status !== MarketplaceTransactionStatus.DELIVERY_DISPUTED) {
      throw new BadRequestException("Transaction non en litige livraison");
    }

    const now = new Date();
    const notes = dto.notes?.trim() || null;

    if (
      dto.outcome === MarketplaceDeliveryDisputeStatus.resolved_vendor
    ) {
      await this.prisma.$transaction([
        this.prisma.marketplaceDeliveryDispute.update({
          where: { id: dispute.id },
          data: {
            status: MarketplaceDeliveryDisputeStatus.resolved_vendor,
            resolvedAt: now
          }
        }),
        this.prisma.marketplaceTransaction.update({
          where: { id: tx.id },
          data: { status: MarketplaceTransactionStatus.BUYER_RECEIVED }
        }),
        this.prisma.marketplaceListing.update({
          where: { id: dispute.listingId },
          data: {
            status: ListingStatus.delivered,
            disputedAt: null,
            deliveredAt: tx.buyerReceivedAt ?? now
          }
        })
      ]);
      void this.push.sendToUser(
        tx.buyerUserId,
        "Litige résolu",
        "Le litige livraison est clos en faveur du vendeur. Déclarez le poids réel pour poursuivre.",
        { type: "marketplace_delivery_dispute_resolved", transactionId: tx.id }
      );
      void this.push.sendToUser(
        tx.sellerUserId,
        "Litige résolu",
        "Le litige livraison est clos. En attente du poids déclaré par l'acheteur.",
        { type: "marketplace_delivery_dispute_resolved", transactionId: tx.id }
      );
      return { ok: true, outcome: dto.outcome, adminUserId, notes };
    }

    if (
      dto.outcome === MarketplaceDeliveryDisputeStatus.resolved_buyer ||
      dto.outcome === MarketplaceDeliveryDisputeStatus.cancelled
    ) {
      await this.refundAndCancelDeliveryDispute(tx, dispute.id, dto.outcome, notes);
      return { ok: true, outcome: dto.outcome, adminUserId, notes };
    }

    if (dto.outcome === MarketplaceDeliveryDisputeStatus.resolved_split) {
      const pct = dto.buyerRefundPercent ?? 50;
      const blocked = Number(tx.blockedAmount);
      const buyerRefund = Math.round((blocked * pct) / 100);
      const sellerGross = blocked - buyerRefund;
      const commission = Math.round(
        sellerGross * Number(tx.commissionRate)
      );
      const sellerNet = sellerGross - commission;

      if (buyerRefund > 0) {
        await this.escrow.refundBuyer(
          tx.id,
          tx.buyerUserId,
          buyerRefund,
          tx.currency,
          tx.paymentProviderRef
        );
      }
      if (sellerNet > 0) {
        await this.escrow.releaseFundsToSeller(
          tx.id,
          tx.sellerUserId,
          sellerNet,
          tx.currency
        );
      }
      if (commission > 0) {
        await this.escrow.collectCommission(tx.id, commission, tx.currency);
      }

      await this.prisma.$transaction([
        this.prisma.marketplaceDeliveryDispute.update({
          where: { id: dispute.id },
          data: {
            status: MarketplaceDeliveryDisputeStatus.resolved_split,
            resolvedAt: now
          }
        }),
        this.prisma.marketplaceTransaction.update({
          where: { id: tx.id },
          data: {
            status: MarketplaceTransactionStatus.CANCELLED_BY_SELLER,
            cancelledAt: now,
            cancelReason:
              notes ??
              `Arbitrage partagé — remboursement acheteur ${pct}%`,
            buyerRefundAmount: new Prisma.Decimal(buyerRefund),
            sellerReceivedAmount: new Prisma.Decimal(sellerNet),
            commissionAmount: new Prisma.Decimal(commission)
          }
        }),
        this.prisma.marketplaceListing.update({
          where: { id: dispute.listingId },
          data: {
            status: ListingStatus.published,
            reservedForBuyerUserId: null,
            shippedAt: null,
            deliveredAt: null,
            disputedAt: null
          }
        })
      ]);

      void this.push.sendToUser(
        tx.buyerUserId,
        "Litige résolu (partagé)",
        `Remboursement de ${buyerRefund.toLocaleString("fr-FR")} ${tx.currency}.`,
        { type: "marketplace_delivery_dispute_resolved", transactionId: tx.id }
      );
      void this.push.sendToUser(
        tx.sellerUserId,
        "Litige résolu (partagé)",
        `Versement de ${sellerNet.toLocaleString("fr-FR")} ${tx.currency}.`,
        { type: "marketplace_delivery_dispute_resolved", transactionId: tx.id }
      );
      return { ok: true, outcome: dto.outcome, adminUserId, notes, buyerRefund, sellerNet };
    }

    throw new BadRequestException("Issue de résolution invalide");
  }

  private async refundAndCancelDeliveryDispute(
    tx: Prisma.MarketplaceTransactionGetPayload<object>,
    disputeId: string,
    outcome:
      | typeof MarketplaceDeliveryDisputeStatus.resolved_buyer
      | typeof MarketplaceDeliveryDisputeStatus.cancelled,
    notes: string | null
  ): Promise<void> {
    await this.escrow.refundBuyer(
      tx.id,
      tx.buyerUserId,
      Number(tx.blockedAmount),
      tx.currency,
      tx.paymentProviderRef
    );
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.marketplaceDeliveryDispute.update({
        where: { id: disputeId },
        data: { status: outcome, resolvedAt: now }
      }),
      this.prisma.marketplaceTransaction.update({
        where: { id: tx.id },
        data: {
          status: MarketplaceTransactionStatus.CANCELLED_BY_SELLER,
          cancelledAt: now,
          cancelReason:
            notes ??
            (outcome === MarketplaceDeliveryDisputeStatus.cancelled
              ? "Litige annulé par arbitrage"
              : "Litige résolu en faveur de l'acheteur"),
          buyerRefundAmount: tx.blockedAmount
        }
      }),
      this.prisma.marketplaceListing.update({
        where: { id: tx.listingId },
        data: {
          status: ListingStatus.published,
          reservedForBuyerUserId: null,
          shippedAt: null,
          deliveredAt: null,
          disputedAt: null
        }
      })
    ]);
    await this.decrementActiveOfferCount(tx.listingId);
    const amountLabel = `${Math.round(Number(tx.blockedAmount)).toLocaleString("fr-FR")} ${tx.currency}`;
    void this.push.sendToUser(
      tx.buyerUserId,
      "Litige résolu",
      `Remboursement de ${amountLabel} en cours.`,
      { type: "marketplace_delivery_dispute_resolved", transactionId: tx.id }
    );
    void this.push.sendToUser(
      tx.sellerUserId,
      "Litige résolu",
      "La transaction a été annulée suite à l'arbitrage.",
      { type: "marketplace_delivery_dispute_resolved", transactionId: tx.id }
    );
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
    if (tx.status === MarketplaceTransactionStatus.PAYMENT_HELD) {
      return this.getById(user, tx.id);
    }
    if (tx.status !== MarketplaceTransactionStatus.PAYMENT_PENDING) {
      throw new BadRequestException("Statut invalide");
    }
    const ref = tx.paymentProviderRef;
    if (!ref) {
      throw new BadRequestException("Référence paiement manquante — initiez le paiement d'abord");
    }
    if (providerRef && providerRef !== ref) {
      throw new BadRequestException("Référence paiement invalide pour cette transaction");
    }
    const ok = await this.escrow.confirmHold(ref, tx.id);
    if (!ok) {
      await this.prisma.marketplaceTransaction.updateMany({
        where: {
          id: tx.id,
          status: MarketplaceTransactionStatus.PAYMENT_PENDING
        },
        data: { status: MarketplaceTransactionStatus.PAYMENT_FAILED }
      });
      throw new BadRequestException("Paiement refusé");
    }

    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: tx.listingId },
      select: { title: true }
    });

    const claimed = await this.prisma.marketplaceTransaction.updateMany({
      where: {
        id: tx.id,
        status: MarketplaceTransactionStatus.PAYMENT_PENDING,
        buyerUserId: user.id
      },
      data: {
        status: MarketplaceTransactionStatus.PAYMENT_HELD,
        paymentConfirmedAt: new Date(),
        paymentProviderRef: ref
      }
    });
    if (claimed.count === 0) {
      const current = await this.prisma.marketplaceTransaction.findUnique({
        where: { id: tx.id }
      });
      if (current?.status === MarketplaceTransactionStatus.PAYMENT_HELD) {
        return this.getById(user, tx.id);
      }
      throw new BadRequestException("Confirmation paiement impossible");
    }

    await this.prisma.marketplaceListing.update({
      where: { id: tx.listingId },
      data: { activeOfferCount: { increment: 1 } }
    });

    const amountLabel = `${Math.round(Number(tx.blockedAmount)).toLocaleString("fr-FR")} ${tx.currency}`;
    if (tx.isCredit) {
      await this.prisma.marketplaceOffer.update({
        where: { id: tx.offerId },
        data: {
          status: OfferStatus.advance_confirmed,
          advanceConfirmedAt: new Date(),
          advancePaymentMode: "escrow"
        }
      });
      void this.push.sendToUser(
        tx.buyerUserId,
        "Avance sécurisée",
        `${amountLabel} est bloqué sur la plateforme jusqu'à la livraison.`,
        { type: "marketplace_credit_advance_held", transactionId: tx.id }
      );
      void this.push.sendToUser(
        tx.sellerUserId,
        "Avance en escrow",
        `L'acheteur a sécurisé ${amountLabel} sur la plateforme. Coordonnez la remise des animaux.`,
        { type: "marketplace_credit_advance_held_seller", transactionId: tx.id }
      );
    } else {
      void this.push.sendToUser(
        tx.sellerUserId,
        "Paiement sécurisé",
        `Un acheteur a sécurisé ${amountLabel} pour « ${listing?.title ?? "votre annonce"} ». Coordonnez la livraison.`,
        { type: "marketplace_payment_held", transactionId: tx.id, listingId: tx.listingId }
      );
    }

    return this.getById(user, tx.id);
  }

  /** Confirmation asynchrone via webhook prestataire (sans JWT acheteur). */
  async confirmPaymentFromWebhook(transactionId: string, providerRef: string) {
    const tx = await this.prisma.marketplaceTransaction.findUnique({
      where: { id: transactionId }
    });
    if (!tx) {
      throw new BadRequestException("Transaction introuvable");
    }
    if (tx.status === MarketplaceTransactionStatus.PAYMENT_HELD) {
      return { ok: true, idempotent: true };
    }
    if (tx.status !== MarketplaceTransactionStatus.PAYMENT_PENDING) {
      throw new BadRequestException("Statut invalide pour confirmation webhook");
    }
    if (tx.paymentProviderRef && tx.paymentProviderRef !== providerRef) {
      throw new BadRequestException("providerRef incohérent");
    }
    const ok = await this.escrow.confirmHold(providerRef, transactionId);
    if (!ok) {
      await this.prisma.marketplaceTransaction.updateMany({
        where: {
          id: transactionId,
          status: MarketplaceTransactionStatus.PAYMENT_PENDING
        },
        data: { status: MarketplaceTransactionStatus.PAYMENT_FAILED }
      });
      return { ok: false };
    }
    const claimed = await this.prisma.marketplaceTransaction.updateMany({
      where: {
        id: transactionId,
        status: MarketplaceTransactionStatus.PAYMENT_PENDING
      },
      data: {
        status: MarketplaceTransactionStatus.PAYMENT_HELD,
        paymentConfirmedAt: new Date(),
        paymentProviderRef: providerRef
      }
    });
    if (claimed.count === 1) {
      await this.prisma.marketplaceListing.update({
        where: { id: tx.listingId },
        data: { activeOfferCount: { increment: 1 } }
      });
    }
    return { ok: true };
  }

  async failPaymentFromWebhook(transactionId: string, providerRef: string) {
    await this.prisma.marketplaceTransaction.updateMany({
      where: {
        id: transactionId,
        status: MarketplaceTransactionStatus.PAYMENT_PENDING,
        paymentProviderRef: providerRef
      },
      data: { status: MarketplaceTransactionStatus.PAYMENT_FAILED }
    });
    return { ok: true };
  }

  async schedulePickup(
    user: User,
    transactionId: string,
    pickupDate: string,
    pickupLocation: string,
    notes?: string
  ) {
    const tx = await this.requireBuyer(transactionId, user.id);
    if (tx.status !== MarketplaceTransactionStatus.PAYMENT_HELD) {
      throw new BadRequestException(
        "Proposition de rendez-vous impossible à ce stade"
      );
    }
    const date = new Date(pickupDate);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException("Date invalide");
    }
    await this.prisma.marketplaceTransaction.update({
      where: { id: tx.id },
      data: {
        status: MarketplaceTransactionStatus.PICKUP_PROPOSED,
        pickupDate: date,
        pickupLocation: pickupLocation.trim(),
        cancelReason: notes?.trim() || undefined
      }
    });
    const msg = `L'acheteur propose un rendez-vous le ${date.toLocaleDateString("fr-FR")} à ${pickupLocation.trim()}. Confirmez si cette date vous convient.`;
    void this.push.sendToUser(tx.buyerUserId, "Rendez-vous proposé", msg, {
      type: "marketplace_pickup_proposed",
      transactionId: tx.id
    });
    void this.push.sendToUser(tx.sellerUserId, "Rendez-vous à confirmer", msg, {
      type: "marketplace_pickup_proposed",
      transactionId: tx.id
    });
    return this.getById(user, tx.id);
  }

  async confirmPickup(user: User, transactionId: string) {
    const tx = await this.requireSeller(transactionId, user.id);
    if (!PICKUP_CONFIRM_STATUSES.includes(tx.status)) {
      throw new BadRequestException(
        "Confirmation de rendez-vous impossible à ce stade"
      );
    }
    if (!tx.pickupDate || !tx.pickupLocation?.trim()) {
      throw new BadRequestException("Aucun rendez-vous proposé");
    }
    await this.prisma.marketplaceTransaction.update({
      where: { id: tx.id },
      data: { status: MarketplaceTransactionStatus.PICKUP_SCHEDULED }
    });
    const dateLabel = tx.pickupDate.toLocaleDateString("fr-FR");
    const msg = `Rendez-vous confirmé le ${dateLabel} à ${tx.pickupLocation.trim()}.`;
    void this.push.sendToUser(tx.buyerUserId, "Rendez-vous confirmé", msg, {
      type: "marketplace_pickup_confirmed",
      transactionId: tx.id
    });
    void this.push.sendToUser(tx.sellerUserId, "Rendez-vous confirmé", msg, {
      type: "marketplace_pickup_confirmed",
      transactionId: tx.id
    });
    return this.getById(user, tx.id);
  }

  async confirmShipment(
    user: User,
    transactionId: string,
    params: {
      shippedAt: string;
      method?: MarketplaceShipmentMethod;
      notes?: string;
    }
  ) {
    const tx = await this.requireSeller(transactionId, user.id);
    if (!SHIPMENT_CONFIRM_STATUSES.includes(tx.status)) {
      throw new BadRequestException(
        "Confirmation d'envoi impossible à ce stade"
      );
    }
    const shippedAt = new Date(params.shippedAt);
    if (Number.isNaN(shippedAt.getTime())) {
      throw new BadRequestException("Date d'envoi invalide");
    }
    await this.prisma.$transaction([
      this.prisma.marketplaceTransaction.update({
        where: { id: tx.id },
        data: {
          status: MarketplaceTransactionStatus.SELLER_SHIPPED,
          sellerShippedAt: shippedAt,
          shipmentMethod: params.method ?? null,
          shipmentNotes: params.notes?.trim() || null
        }
      }),
      this.prisma.marketplaceListing.update({
        where: { id: tx.listingId },
        data: {
          status: ListingStatus.shipped,
          shippedAt
        }
      })
    ]);
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: tx.listingId },
      include: { farm: { select: { name: true } } }
    });
    const farmLabel = listing?.farm?.name ?? "Le vendeur";
    void this.push.sendToUser(
      tx.buyerUserId,
      "Récupération confirmée",
      `${farmLabel} a confirmé la remise des animaux. Confirmez la réception pour finaliser la transaction.`,
      {
        type: "marketplace_shipment_confirmed",
        transactionId: tx.id,
        listingId: tx.listingId
      }
    );
    return this.getById(user, tx.id);
  }

  async confirmReceipt(
    user: User,
    transactionId: string,
    params: {
      receivedAt: string;
      condition: MarketplaceReceiptCondition;
      receivedAnimalIds: string[];
      realWeightKg?: number;
      notes?: string;
    }
  ) {
    const tx = await this.requireBuyer(transactionId, user.id);
    if (tx.status !== MarketplaceTransactionStatus.SELLER_SHIPPED) {
      throw new BadRequestException(
        "Confirmation de réception impossible à ce stade"
      );
    }
    if (params.condition !== MarketplaceReceiptCondition.conform) {
      return this.openDeliveryDispute(user, transactionId, {
        disputeType:
          params.condition === MarketplaceReceiptCondition.major_issue
            ? "État sanitaire non conforme"
            : "Problème mineur à la réception",
        description:
          params.notes?.trim() ||
          "Problème signalé lors de la confirmation de réception.",
        photoUrls: []
      });
    }
    const receivedAt = new Date(params.receivedAt);
    if (Number.isNaN(receivedAt.getTime())) {
      throw new BadRequestException("Date de réception invalide");
    }
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: tx.listingId }
    });
    if (!listing) {
      throw new NotFoundException("Annonce introuvable");
    }
    const expectedIds = this.listingAnimalIds(listing);
    if (expectedIds.length > 0) {
      const received = new Set(params.receivedAnimalIds);
      const missing = expectedIds.filter((id) => !received.has(id));
      if (missing.length > 0) {
        throw new BadRequestException(
          "Tous les animaux attendus doivent être confirmés"
        );
      }
    }
    const nextStatus: MarketplaceTransactionStatus =
      MarketplaceTransactionStatus.BUYER_RECEIVED;
    await this.prisma.$transaction([
      this.prisma.marketplaceTransaction.update({
        where: { id: tx.id },
        data: {
          status: nextStatus,
          buyerReceivedAt: receivedAt,
          receiptCondition: params.condition,
          receiptNotes: params.notes?.trim() || null,
          receivedAnimalIds: params.receivedAnimalIds
        }
      }),
      this.prisma.marketplaceListing.update({
        where: { id: tx.listingId },
        data: {
          status: ListingStatus.delivered,
          deliveredAt: receivedAt
        }
      })
    ]);
    if (tx.isCredit) {
      void this.push.sendToUser(
        tx.sellerUserId,
        "Réception confirmée (crédit)",
        "L'acheteur a confirmé la récupération des animaux.",
        { type: "marketplace_credit_receipt_confirmed", transactionId: tx.id }
      );
    } else {
      await this.settleTransaction(tx.id);
      void this.push.sendToUser(
        tx.sellerUserId,
        "Réception confirmée",
        "L'acheteur a confirmé la réception. Le paiement est en cours de versement.",
        { type: "marketplace_receipt_confirmed", transactionId: tx.id }
      );
      void this.push.sendToUser(
        tx.buyerUserId,
        "Transaction finalisée",
        "Merci pour votre confirmation. La transaction est en cours de clôture.",
        { type: "marketplace_receipt_confirmed", transactionId: tx.id }
      );
    }
    return this.getById(user, tx.id);
  }

  async openDeliveryDispute(
    user: User,
    transactionId: string,
    params: {
      disputeType: string;
      description: string;
      photoUrls?: string[];
    }
  ) {
    const tx = await this.requireParticipant(transactionId, user.id);
    if (
      tx.status !== MarketplaceTransactionStatus.SELLER_SHIPPED &&
      tx.status !== MarketplaceTransactionStatus.BUYER_RECEIVED
    ) {
      throw new BadRequestException("Litige livraison impossible à ce stade");
    }
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.marketplaceTransaction.update({
        where: { id: tx.id },
        data: { status: MarketplaceTransactionStatus.DELIVERY_DISPUTED }
      }),
      this.prisma.marketplaceListing.update({
        where: { id: tx.listingId },
        data: {
          status: ListingStatus.disputed,
          disputedAt: now
        }
      }),
      this.prisma.marketplaceDeliveryDispute.create({
        data: {
          listingId: tx.listingId,
          offerId: tx.offerId,
          transactionId: tx.id,
          raisedByUserId: user.id,
          disputeType: params.disputeType.trim(),
          description: params.description.trim(),
          photoUrls: (params.photoUrls ?? []) as Prisma.InputJsonValue
        }
      })
    ]);
    const peerId =
      user.id === tx.buyerUserId ? tx.sellerUserId : tx.buyerUserId;
    void this.push.sendToUser(
      peerId,
      "Litige livraison",
      "Un problème a été signalé sur la livraison. Vérifiez les détails.",
      { type: "marketplace_delivery_disputed", transactionId: tx.id }
    );
    const admins = await this.prisma.superAdmin.findMany({
      select: { userId: true }
    });
    for (const a of admins) {
      void this.push.sendToUser(
        a.userId,
        "Litige livraison marketplace",
        `Transaction ${tx.id} — suivi requis.`,
        { type: "marketplace_delivery_dispute_admin", transactionId: tx.id }
      );
    }
    return this.getById(user, tx.id);
  }

  async requireActiveTransactionIdForListing(
    user: User,
    listingId: string
  ): Promise<string> {
    const tx = await this.prisma.marketplaceTransaction.findFirst({
      where: {
        listingId,
        status: {
          notIn: [
            MarketplaceTransactionStatus.CANCELLED_BY_BUYER,
            MarketplaceTransactionStatus.CANCELLED_BY_SELLER,
            MarketplaceTransactionStatus.CANCELLED_SOLD_TO_OTHER,
            MarketplaceTransactionStatus.OFFER_EXPIRED,
            MarketplaceTransactionStatus.PAYMENT_FAILED,
            MarketplaceTransactionStatus.TRANSACTION_CLOSED
          ]
        }
      },
      orderBy: { createdAt: "desc" }
    });
    if (!tx) {
      throw new NotFoundException("Aucune transaction active pour cette annonce");
    }
    if (tx.buyerUserId !== user.id && tx.sellerUserId !== user.id) {
      throw new ForbiddenException("Accès refusé");
    }
    return tx.id;
  }

  async getTransactionStatusForListing(user: User, listingId: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        status: true,
        reservedForBuyerUserId: true,
        shippedAt: true,
        deliveredAt: true,
        disputedAt: true,
        sellerUserId: true,
        animalIds: true,
        animalId: true
      }
    });
    if (!listing) {
      throw new NotFoundException("Annonce introuvable");
    }
    const tx = await this.prisma.marketplaceTransaction.findFirst({
      where: {
        listingId,
        status: {
          notIn: [
            MarketplaceTransactionStatus.CANCELLED_BY_BUYER,
            MarketplaceTransactionStatus.CANCELLED_BY_SELLER,
            MarketplaceTransactionStatus.CANCELLED_SOLD_TO_OTHER,
            MarketplaceTransactionStatus.OFFER_EXPIRED,
            MarketplaceTransactionStatus.PAYMENT_FAILED
          ]
        }
      },
      orderBy: { createdAt: "desc" }
    });
    if (!tx) {
      throw new NotFoundException("Aucune transaction active");
    }
    if (tx.buyerUserId !== user.id && tx.sellerUserId !== user.id) {
      throw new ForbiddenException("Accès refusé");
    }
    return {
      listing,
      transaction: await this.getById(user, tx.id),
      animalIds: this.listingAnimalIds(listing)
    };
  }

  async handleDeliveryReminders(): Promise<{ vendor: number; buyer: number }> {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    let vendor = 0;
    let buyer = 0;
    const reservedListings = await this.prisma.marketplaceListing.findMany({
      where: {
        status: ListingStatus.reserved,
        updatedAt: { lte: threeDaysAgo }
      },
      include: {
        transactions: {
          where: { status: MarketplaceTransactionStatus.PAYMENT_HELD },
          take: 1
        }
      }
    });
    for (const listing of reservedListings) {
      const tx = listing.transactions[0];
      if (!tx) {
        continue;
      }
      vendor += 1;
      void this.push.sendToUser(
        listing.sellerUserId,
        "Rappel envoi",
        "N'oubliez pas de confirmer l'envoi de vos animaux.",
        { type: "marketplace_remind_vendor_shipment", listingId: listing.id }
      );
    }
    const shipped = await this.prisma.marketplaceTransaction.findMany({
      where: {
        status: MarketplaceTransactionStatus.SELLER_SHIPPED,
        sellerShippedAt: { lte: threeDaysAgo }
      }
    });
    for (const tx of shipped) {
      buyer += 1;
      void this.push.sendToUser(
        tx.buyerUserId,
        "Rappel réception",
        "Avez-vous bien reçu vos animaux ? Confirmez la réception.",
        { type: "marketplace_remind_buyer_receipt", transactionId: tx.id }
      );
    }
    return { vendor, buyer };
  }

  async handleAutoDeliveryDisputes(): Promise<number> {
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.marketplaceTransaction.findMany({
      where: {
        status: MarketplaceTransactionStatus.SELLER_SHIPPED,
        sellerShippedAt: { lte: cutoff }
      }
    });
    for (const tx of rows) {
      const now = new Date();
      await this.prisma.$transaction([
        this.prisma.marketplaceTransaction.update({
          where: { id: tx.id },
          data: { status: MarketplaceTransactionStatus.DELIVERY_DISPUTED }
        }),
        this.prisma.marketplaceListing.update({
          where: { id: tx.listingId },
          data: { status: ListingStatus.disputed, disputedAt: now }
        }),
        this.prisma.marketplaceDeliveryDispute.create({
          data: {
            listingId: tx.listingId,
            offerId: tx.offerId,
            transactionId: tx.id,
            raisedByUserId: tx.buyerUserId,
            disputeType: "Délai dépassé",
            description:
              "Aucune confirmation de réception dans les 14 jours suivant l'envoi.",
            photoUrls: []
          }
        })
      ]);
      void this.push.sendToUser(
        tx.sellerUserId,
        "Litige automatique",
        "Délai de confirmation de réception dépassé.",
        { type: "marketplace_delivery_disputed", transactionId: tx.id }
      );
      void this.push.sendToUser(
        tx.buyerUserId,
        "Litige automatique",
        "Délai de confirmation de réception dépassé.",
        { type: "marketplace_delivery_disputed", transactionId: tx.id }
      );
    }
    return rows.length;
  }

  private listingAnimalIds(
    listing: Pick<
      Prisma.MarketplaceListingGetPayload<object>,
      "animalId" | "animalIds"
    >
  ): string[] {
    const raw = listing.animalIds;
    const fromJson = Array.isArray(raw)
      ? raw.filter((v): v is string => typeof v === "string")
      : [];
    if (listing.animalId && !fromJson.includes(listing.animalId)) {
      return [listing.animalId, ...fromJson];
    }
    return fromJson;
  }

  async declareWeight(
    user: User,
    transactionId: string,
    realWeightKg: number,
    photoUrl?: string
  ) {
    const tx = await this.requireBuyer(transactionId, user.id);
    if (tx.status !== MarketplaceTransactionStatus.PICKUP_SCHEDULED) {
      throw new BadRequestException(
        "Le poids réel ne peut être déclaré qu'après confirmation du rendez-vous"
      );
    }
    let weight = realWeightKg;
    if (tx.priceType === MarketplacePriceType.flat) {
      weight =
        tx.estimatedWeightKg?.toNumber() ??
        (await this.prisma.marketplaceListing.findUnique({
          where: { id: tx.listingId },
          select: { totalWeightKg: true }
        }))?.totalWeightKg?.toNumber() ??
        weight;
    }
    if (!Number.isFinite(weight) || weight <= 0) {
      throw new BadRequestException("Poids invalide");
    }
    await this.prisma.marketplaceTransaction.update({
      where: { id: tx.id },
      data: {
        status: MarketplaceTransactionStatus.WEIGHT_DECLARED,
        realWeightKg: new Prisma.Decimal(weight),
        weightDeclaredByBuyerAt: new Date(),
        weightScalePhotoUrl: photoUrl?.trim() || null
      }
    });
    void this.push.sendToUser(
      tx.sellerUserId,
      "Poids déclaré",
      `L'acheteur déclare un poids de ${weight.toLocaleString("fr-FR")} kg. Confirmez ou contestez sous 24 h.`,
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
    if (tx.isCredit) {
      await this.creditOffers.onCreditWeightValidated(tx.id);
      return this.getById(user, tx.id);
    }
    void this.push.sendToUser(
      tx.buyerUserId,
      "Poids confirmé",
      "Le vendeur a confirmé le poids. Il validera la remise des animaux.",
      { type: "marketplace_weight_validated", transactionId: tx.id }
    );
    void this.push.sendToUser(
      tx.sellerUserId,
      "Poids confirmé",
      "Confirmez la remise des animaux à l'acheteur.",
      { type: "marketplace_weight_validated", transactionId: tx.id }
    );
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
    if (tx.isCredit) {
      await this.creditOffers.onCreditWeightValidated(tx.id);
    }
    return { ok: true };
  }

  /** Clôture escrow crédit après paiement du solde (avance + solde sur plateforme). */
  async settleCreditTransaction(transactionId: string): Promise<void> {
    const lockKey = `settle-credit:${transactionId}`;
    await this.prisma.$executeRaw`SELECT pg_advisory_lock(hashtext(${lockKey}))`;
    try {
      const tx = await this.prisma.marketplaceTransaction.findUnique({
        where: { id: transactionId },
        include: { listing: true, offer: true }
      });
      if (!tx?.isCredit || !tx.offer) {
        return;
      }
      if (tx.status === MarketplaceTransactionStatus.TRANSACTION_CLOSED) {
        return;
      }
      if (tx.status !== MarketplaceTransactionStatus.WEIGHT_VALIDATED) {
        return;
      }

      const priorRelease = await this.prisma.marketplaceFundMovement.findFirst({
        where: {
          transactionId,
          kind: MarketplaceFundMovementKind.RELEASE_TO_SELLER
        }
      });
      if (priorRelease) {
        await this.prisma.marketplaceTransaction.updateMany({
          where: {
            id: transactionId,
            status: MarketplaceTransactionStatus.WEIGHT_VALIDATED
          },
          data: {
            status: MarketplaceTransactionStatus.TRANSACTION_CLOSED,
            closedAt: new Date()
          }
        });
        void this.receipts.generateReceipt(transactionId);
        return;
      }

      const advanceHeld = Number(tx.blockedAmount);
      const balancePaid = Number(tx.offer.balancePaidAmount ?? 0);
      const totalHeld = advanceHeld + balancePaid;
      const finalAmount =
        tx.finalAmount != null
          ? Number(tx.finalAmount)
          : calculateFinalAmount(tx);
      const rate = Number(tx.commissionRate);
      const amounts = settlementAmounts({
        blockedAmount: totalHeld,
        finalAmount,
        commissionRate: rate
      });

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
        tx.sellerUserId,
        amounts.sellerReceivedAmount,
        tx.currency
      );
      await this.escrow.collectCommission(
        tx.id,
        amounts.commissionAmount,
        tx.currency
      );

      const closed = await this.prisma.marketplaceTransaction.updateMany({
        where: {
          id: transactionId,
          status: MarketplaceTransactionStatus.WEIGHT_VALIDATED
        },
        data: {
          status: MarketplaceTransactionStatus.TRANSACTION_CLOSED,
          closedAt: new Date(),
          finalAmount: new Prisma.Decimal(finalAmount),
          commissionAmount: new Prisma.Decimal(amounts.commissionAmount),
          sellerReceivedAmount: new Prisma.Decimal(amounts.sellerReceivedAmount),
          buyerRefundAmount: new Prisma.Decimal(amounts.buyerRefundAmount),
          buyerAdditionalCharge: new Prisma.Decimal(amounts.buyerAdditionalCharge)
        }
      });
      if (closed.count === 0) {
        return;
      }

      try {
        await this.prisma.platformRevenue.create({
          data: {
            transactionId: tx.id,
            sellerId: tx.sellerUserId,
            buyerId: tx.buyerUserId,
            grossAmount: new Prisma.Decimal(finalAmount),
            commissionRate: tx.commissionRate,
            commissionAmount: new Prisma.Decimal(amounts.commissionAmount)
          }
        });
      } catch (e) {
        if (
          !(
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === "P2002"
          )
        ) {
          throw e;
        }
      }

      void this.receipts.generateReceipt(transactionId);
    } finally {
      await this.prisma.$executeRaw`SELECT pg_advisory_unlock(hashtext(${lockKey}))`;
    }
  }

  async cancelByBuyer(user: User, transactionId: string) {
    const tx = await this.requireBuyer(transactionId, user.id);
    if (tx.status === MarketplaceTransactionStatus.CANCELLED_BY_BUYER) {
      return { ok: true };
    }
    if (!CANCELLABLE_BY_BUYER.includes(tx.status)) {
      throw new BadRequestException("Annulation impossible à ce stade");
    }
    const needsRefund =
      tx.status === MarketplaceTransactionStatus.PAYMENT_HELD ||
      tx.status === MarketplaceTransactionStatus.PICKUP_PROPOSED ||
      tx.status === MarketplaceTransactionStatus.PICKUP_SCHEDULED ||
      tx.status === MarketplaceTransactionStatus.WEIGHT_DECLARED ||
      tx.status === MarketplaceTransactionStatus.WEIGHT_VALIDATED ||
      tx.status === MarketplaceTransactionStatus.SELLER_SHIPPED;
    if (needsRefund) {
      const priorRefund = await this.prisma.marketplaceFundMovement.findFirst({
        where: {
          transactionId: tx.id,
          kind: MarketplaceFundMovementKind.REFUND_BUYER
        }
      });
      if (!priorRefund) {
        await this.escrow.refundBuyer(
          tx.id,
          tx.buyerUserId,
          Number(tx.blockedAmount),
          tx.currency,
          tx.paymentProviderRef
        );
      }
    }
    const cancelled = await this.prisma.marketplaceTransaction.updateMany({
      where: {
        id: tx.id,
        status: { in: [...CANCELLABLE_BY_BUYER] }
      },
      data: {
        status: MarketplaceTransactionStatus.CANCELLED_BY_BUYER,
        cancelledAt: new Date()
      }
    });
    if (cancelled.count === 0) {
      return { ok: true };
    }
    if (needsRefund) {
      await this.decrementActiveOfferCount(tx.listingId);
    }
    await this.prisma.marketplaceListing.updateMany({
      where: {
        id: tx.listingId,
        status: {
          in: [
            ListingStatus.reserved,
            ListingStatus.shipped,
            ListingStatus.delivered
          ]
        }
      },
      data: {
        status: ListingStatus.published,
        reservedForBuyerUserId: null,
        shippedAt: null,
        deliveredAt: null
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
        tx.status === MarketplaceTransactionStatus.PICKUP_PROPOSED ||
        tx.status === MarketplaceTransactionStatus.PICKUP_SCHEDULED ||
        tx.status === MarketplaceTransactionStatus.WEIGHT_DECLARED ||
        tx.status === MarketplaceTransactionStatus.WEIGHT_VALIDATED
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
      await this.prisma.marketplaceListing.updateMany({
        where: {
          id: tx.listingId,
          status: ListingStatus.reserved
        },
        data: {
          status: ListingStatus.published,
          reservedForBuyerUserId: null
        }
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
        "Poids validé automatiquement. Le vendeur peut confirmer la remise.",
        { type: "marketplace_weight_auto_validated", transactionId: tx.id }
      );
      void this.push.sendToUser(
        tx.sellerUserId,
        "Poids validé",
        "Poids validé automatiquement. Confirmez la remise des animaux.",
        { type: "marketplace_weight_auto_validated", transactionId: tx.id }
      );
    }
    return rows.length;
  }

  async settleTransaction(transactionId: string): Promise<void> {
    const lockKey = `settle:${transactionId}`;
    await this.prisma.$executeRaw`SELECT pg_advisory_lock(hashtext(${lockKey}))`;
    try {
      const tx = await this.prisma.marketplaceTransaction.findUnique({
        where: { id: transactionId },
        include: { listing: true, offer: true }
      });
      if (!tx) {
        return;
      }
      if (tx.status === MarketplaceTransactionStatus.TRANSACTION_CLOSED) {
        return;
      }
      if (tx.status !== MarketplaceTransactionStatus.BUYER_RECEIVED) {
        return;
      }
      if (tx.isCredit) {
        return;
      }

      const priorRelease = await this.prisma.marketplaceFundMovement.findFirst({
        where: {
          transactionId,
          kind: MarketplaceFundMovementKind.RELEASE_TO_SELLER
        }
      });
      if (priorRelease) {
        await this.prisma.marketplaceTransaction.updateMany({
          where: {
            id: transactionId,
            status: MarketplaceTransactionStatus.BUYER_RECEIVED
          },
          data: {
            status: MarketplaceTransactionStatus.TRANSACTION_CLOSED,
            closedAt: new Date()
          }
        });
        void this.receipts.generateReceipt(transactionId);
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
        tx.sellerUserId,
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

      const closed = await this.prisma.marketplaceTransaction.updateMany({
        where: {
          id: tx.id,
          status: MarketplaceTransactionStatus.BUYER_RECEIVED
        },
        data: {
          status: MarketplaceTransactionStatus.TRANSACTION_CLOSED,
          closedAt: new Date(),
          finalAmount: new Prisma.Decimal(finalAmount),
          commissionAmount: new Prisma.Decimal(amounts.commissionAmount),
          sellerReceivedAmount: new Prisma.Decimal(amounts.sellerReceivedAmount),
          buyerRefundAmount: new Prisma.Decimal(amounts.buyerRefundAmount),
          buyerAdditionalCharge: new Prisma.Decimal(amounts.buyerAdditionalCharge)
        }
      });
      if (closed.count === 0) {
        return;
      }

      try {
        await this.prisma.platformRevenue.create({
          data: {
            transactionId: tx.id,
            sellerId: tx.sellerUserId,
            buyerId: tx.buyerUserId,
            grossAmount: new Prisma.Decimal(finalAmount),
            commissionRate: tx.commissionRate,
            commissionAmount: new Prisma.Decimal(amounts.commissionAmount)
          }
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          // commission déjà enregistrée — idempotent
        } else {
          throw e;
        }
      }

      await this.prisma.marketplaceOffer.update({
        where: { id: tx.offerId },
        data: { status: OfferStatus.completed, completedAt: new Date() }
      });

      await this.prisma.marketplaceListing.update({
        where: { id: tx.listingId },
        data: {
          status: ListingStatus.sold,
          activeOfferCount: 0,
          reservedForBuyerUserId: null
        }
      });

      await this.routePostCloseBuyerTransfer(tx);

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

      void this.receipts.generateReceipt(transactionId);
    } finally {
      await this.prisma.$executeRaw`SELECT pg_advisory_unlock(hashtext(${lockKey}))`;
    }
  }

  private async routePostCloseBuyerTransfer(
    tx: Prisma.MarketplaceTransactionGetPayload<{
      include: { listing: true; offer: true };
    }>
  ): Promise<void> {
    const profile = await this.buyerProfiles.detect(
      tx.buyerUserId,
      tx.offer.buyerFarmId
    );
    const animalIds = this.listingAnimalIds(tx.listing);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    if (profile.kind === "PLATFORM_USER_WITH_FARM") {
      await this.prisma.marketplacePendingTransfer.create({
        data: {
          transactionId: tx.id,
          buyerUserId: tx.buyerUserId,
          buyerFarmId: profile.buyerFarmId,
          animalIds,
          expiresAt
        }
      });
      void this.push.sendToUser(
        tx.buyerUserId,
        "🐷 Vos animaux sont prêts",
        "La transaction est close. Vos animaux vont être ajoutés à votre cheptel.",
        {
          type: "marketplace_pending_transfer",
          transactionId: tx.id,
          ...(profile.buyerFarmId
            ? { buyerFarmId: profile.buyerFarmId }
            : {})
        }
      );
      return;
    }

    if (profile.kind === "PLATFORM_USER_WITHOUT_FARM") {
      await this.prisma.marketplacePendingTransfer.create({
        data: {
          transactionId: tx.id,
          buyerUserId: tx.buyerUserId,
          buyerFarmId: null,
          animalIds,
          expiresAt
        }
      });
      void this.push.sendToUser(
        tx.buyerUserId,
        "🐷 Finalisez votre cheptel",
        "La transaction est close. Créez ou rejoignez une ferme pour récupérer vos animaux.",
        { type: "marketplace_pending_transfer_onboarding", transactionId: tx.id }
      );
      return;
    }

    void this.push.sendToUser(
      tx.buyerUserId,
      "✅ Achat confirmé",
      "Votre achat est confirmé.",
      { type: "marketplace_transaction_closed_buyer", transactionId: tx.id }
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

  private serializePendingTransfer(
    pending: Prisma.MarketplacePendingTransferGetPayload<object>
  ) {
    return {
      id: pending.id,
      transactionId: pending.transactionId,
      buyerFarmId: pending.buyerFarmId,
      animalIds: Array.isArray(pending.animalIds)
        ? pending.animalIds.filter((v): v is string => typeof v === "string")
        : [],
      expiresAt: pending.expiresAt.toISOString(),
      completedAt: pending.completedAt?.toISOString() ?? null,
      cancelledAt: pending.cancelledAt?.toISOString() ?? null,
      createdAt: pending.createdAt.toISOString()
    };
  }

  private serialize(
    tx: Awaited<
      ReturnType<PrismaService["marketplaceTransaction"]["findUnique"]>
    > & {
      listing?: {
        id: string;
        title: string;
        category: string | null;
        status?: ListingStatus;
        animalId?: string | null;
        animalIds?: Prisma.JsonValue;
      };
      receipt?: {
        id: string;
        receiptNumber: string;
        generatedAt: Date;
      } | null;
      pendingTransfers?: Prisma.MarketplacePendingTransferGetPayload<object>[];
    }
  ) {
    if (!tx) return null;
    const pending = tx.pendingTransfers?.[0] ?? null;
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
      sellerShippedAt: tx.sellerShippedAt?.toISOString() ?? null,
      shipmentMethod: tx.shipmentMethod,
      shipmentNotes: tx.shipmentNotes,
      buyerReceivedAt: tx.buyerReceivedAt?.toISOString() ?? null,
      receiptCondition: tx.receiptCondition,
      receiptNotes: tx.receiptNotes,
      receivedAnimalIds: Array.isArray(tx.receivedAnimalIds)
        ? tx.receivedAnimalIds.filter((v): v is string => typeof v === "string")
        : [],
      listingStatus:
        tx.listing && "status" in tx.listing ? tx.listing.status ?? null : null,
      listingAnimalIds:
        tx.listing && "animalIds" in tx.listing
          ? this.listingAnimalIds(
              tx.listing as Pick<
                Prisma.MarketplaceListingGetPayload<object>,
                "animalId" | "animalIds"
              >
            )
          : [],
      currency: tx.currency,
      offerExpiresAt: tx.offerExpiresAt.toISOString(),
      listingTitle: tx.listing?.title ?? null,
      receiptGenerationStatus: tx.receiptGenerationStatus,
      receipt: tx.receipt
        ? {
            id: tx.receipt.id,
            receiptNumber: tx.receipt.receiptNumber,
            generatedAt: tx.receipt.generatedAt.toISOString()
          }
        : null,
      pendingTransfer: pending ? this.serializePendingTransfer(pending) : null,
      isCredit: tx.isCredit ?? false
    };
  }

  async listForUser(user: User) {
    const rows = await this.prisma.marketplaceTransaction.findMany({
      where: {
        OR: [{ buyerUserId: user.id }, { sellerUserId: user.id }]
      },
      orderBy: { updatedAt: "desc" },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            category: true,
            status: true,
            animalId: true,
            animalIds: true
          }
        }
      },
      take: 100
    });
    return rows.map((tx) => this.serialize(tx));
  }

  /** Synthèse finance marketplace (fonds bloqués acheteur / revenus en attente vendeur). */
  async getFinanceSummary(user: User) {
    const heldStatuses = [
      MarketplaceTransactionStatus.PAYMENT_HELD,
      MarketplaceTransactionStatus.PICKUP_PROPOSED,
      MarketplaceTransactionStatus.PICKUP_SCHEDULED,
      MarketplaceTransactionStatus.SELLER_SHIPPED,
      MarketplaceTransactionStatus.BUYER_RECEIVED,
      MarketplaceTransactionStatus.DELIVERY_DISPUTED,
      MarketplaceTransactionStatus.WEIGHT_DECLARED,
      MarketplaceTransactionStatus.WEIGHT_DISPUTED,
      MarketplaceTransactionStatus.WEIGHT_VALIDATED
    ];

    const financeTxSelect = {
      priceType: true,
      agreedPricePerKg: true,
      agreedFlatPrice: true,
      estimatedWeightKg: true,
      blockedAmount: true,
      offer: { select: { offeredPrice: true } }
    } as const;

    const resolveAgreedAmount = (tx: {
      priceType: MarketplacePriceType;
      agreedPricePerKg: Prisma.Decimal | null;
      agreedFlatPrice: Prisma.Decimal | null;
      estimatedWeightKg: Prisma.Decimal | null;
      offer: { offeredPrice: Prisma.Decimal };
    }) =>
      calculateAgreedDealAmount({
        priceType: tx.priceType,
        agreedPricePerKg: tx.agreedPricePerKg
          ? Number(tx.agreedPricePerKg)
          : null,
        agreedFlatPrice: tx.agreedFlatPrice
          ? Number(tx.agreedFlatPrice)
          : null,
        estimatedWeightKg: tx.estimatedWeightKg
          ? Number(tx.estimatedWeightKg)
          : null,
        offeredPrice: Number(tx.offer.offeredPrice)
      });

    const [asBuyer, asSeller, closedBuyer, closedSeller, closedRows, heldRows] =
      await Promise.all([
      this.prisma.marketplaceTransaction.findMany({
        where: {
          buyerUserId: user.id,
          status: { in: heldStatuses }
        },
        include: {
          listing: { select: { id: true, title: true } },
          seller: { select: { id: true, fullName: true } },
          offer: { select: { offeredPrice: true } }
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
          buyer: { select: { id: true, fullName: true } },
          offer: { select: { offeredPrice: true } }
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
          paymentConfirmedAt: true,
          updatedAt: true,
          ...financeTxSelect
        }
      })
    ]);

    const blockedFunds = asBuyer.reduce(
      (sum, tx) => sum + resolveAgreedAmount(tx),
      0
    );
    const pendingRevenue = asSeller.reduce(
      (sum, tx) => sum + resolveAgreedAmount(tx),
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
      const agreed = resolveAgreedAmount(tx);
      if (tx.sellerUserId === user.id) {
        bucket.pendingRevenue += agreed;
      }
      if (tx.buyerUserId === user.id) {
        bucket.blockedFunds += agreed;
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
        agreedAmount: resolveAgreedAmount(tx),
        blockedAmount: Number(tx.blockedAmount),
        status: tx.status,
        sellerName: tx.seller.fullName
      })),
      pendingTransactions: asSeller.map((tx) => ({
        id: tx.id,
        listingId: tx.listingId,
        listingTitle: tx.listing.title,
        agreedAmount: resolveAgreedAmount(tx),
        blockedAmount: Number(tx.blockedAmount),
        status: tx.status,
        buyerName: tx.buyer.fullName
      }))
    };
  }

  async listDisputesForAdmin() {
    const [weightDisputes, deliveryDisputes] = await Promise.all([
      this.prisma.marketplaceTransaction.findMany({
        where: { status: MarketplaceTransactionStatus.WEIGHT_DISPUTED },
        orderBy: { weightDisputeOpenedAt: "asc" },
        include: {
          listing: { select: { title: true } },
          buyer: { select: { fullName: true, email: true } },
          seller: { select: { fullName: true, email: true } }
        }
      }),
      this.prisma.marketplaceDeliveryDispute.findMany({
        where: { status: MarketplaceDeliveryDisputeStatus.open },
        orderBy: { createdAt: "asc" },
        include: {
          transaction: {
            include: {
              listing: { select: { title: true } },
              buyer: { select: { fullName: true, email: true } },
              seller: { select: { fullName: true, email: true } }
            }
          }
        }
      })
    ]);

    return [
      ...weightDisputes.map((tx) => ({
        kind: "weight" as const,
        id: tx.id,
        transactionId: tx.id,
        listingTitle: tx.listing.title,
        buyerName: tx.buyer.fullName,
        buyerEmail: tx.buyer.email,
        sellerName: tx.seller.fullName,
        sellerEmail: tx.seller.email,
        status: tx.status,
        openedAt: tx.weightDisputeOpenedAt?.toISOString() ?? null
      })),
      ...deliveryDisputes.map((d) => ({
        kind: "delivery" as const,
        id: d.id,
        transactionId: d.transactionId,
        listingTitle: d.transaction.listing.title,
        buyerName: d.transaction.buyer.fullName,
        buyerEmail: d.transaction.buyer.email,
        sellerName: d.transaction.seller.fullName,
        sellerEmail: d.transaction.seller.email,
        disputeType: d.disputeType,
        description: d.description,
        status: d.status,
        openedAt: d.createdAt.toISOString()
      }))
    ];
  }

  async listForAdmin(status?: string) {
    const where: Prisma.MarketplaceTransactionWhereInput = status
      ? { status: status as MarketplaceTransactionStatus }
      : {};
    const rows = await this.prisma.marketplaceTransaction.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: {
        listing: { select: { id: true, title: true } },
        buyer: { select: { id: true, fullName: true, email: true } },
        seller: { select: { id: true, fullName: true, email: true } }
      }
    });
    return rows.map((tx) => ({
      id: tx.id,
      status: tx.status,
      blockedAmount: Number(tx.blockedAmount),
      finalAmount: tx.finalAmount != null ? Number(tx.finalAmount) : null,
      realWeightKg: tx.realWeightKg != null ? Number(tx.realWeightKg) : null,
      arbitrationWeightKg:
        tx.arbitrationWeightKg != null ? Number(tx.arbitrationWeightKg) : null,
      currency: tx.currency,
      updatedAt: tx.updatedAt.toISOString(),
      weightDisputeOpenedAt: tx.weightDisputeOpenedAt?.toISOString() ?? null,
      weightDeclaredByBuyerAt: tx.weightDeclaredByBuyerAt?.toISOString() ?? null,
      listing: tx.listing,
      buyer: tx.buyer,
      seller: tx.seller
    }));
  }

  async getOverviewForAdmin() {
    const closedStatuses: MarketplaceTransactionStatus[] = [
      MarketplaceTransactionStatus.TRANSACTION_CLOSED,
      MarketplaceTransactionStatus.CANCELLED_BY_BUYER,
      MarketplaceTransactionStatus.CANCELLED_BY_SELLER,
      MarketplaceTransactionStatus.CANCELLED_SOLD_TO_OTHER,
      MarketplaceTransactionStatus.PAYMENT_FAILED,
      MarketplaceTransactionStatus.OFFER_EXPIRED
    ];

    const [
      listingByStatus,
      transactionByStatus,
      activeTransactions,
      openDisputes,
      totalViews
    ] = await Promise.all([
      this.prisma.marketplaceListing.groupBy({
        by: ["status"],
        where: { archived: false },
        _count: { _all: true }
      }),
      this.prisma.marketplaceTransaction.groupBy({
        by: ["status"],
        _count: { _all: true }
      }),
      this.prisma.marketplaceTransaction.count({
        where: { status: { notIn: closedStatuses } }
      }),
      this.prisma.marketplaceTransaction.count({
        where: { status: MarketplaceTransactionStatus.WEIGHT_DISPUTED }
      }),
      this.prisma.marketplaceListing.aggregate({
        where: { archived: false },
        _sum: { viewsCount: true }
      })
    ]);

    const listingCounts: Record<string, number> = {};
    for (const row of listingByStatus) {
      listingCounts[row.status] = row._count._all;
    }

    const transactionCounts: Record<string, number> = {};
    for (const row of transactionByStatus) {
      transactionCounts[row.status] = row._count._all;
    }

    const totalListings = Object.values(listingCounts).reduce((sum, n) => sum + n, 0);

    return {
      listings: {
        total: totalListings,
        published: listingCounts[ListingStatus.published] ?? 0,
        byStatus: listingCounts
      },
      transactions: {
        active: activeTransactions,
        openDisputes,
        byStatus: transactionCounts
      },
      totalViews: totalViews._sum.viewsCount ?? 0
    };
  }

  async listListingsForAdmin(status?: string) {
    const where: Prisma.MarketplaceListingWhereInput = {
      archived: false,
      ...(status && status !== "all"
        ? { status: status as ListingStatus }
        : {})
    };

    const rows = await this.prisma.marketplaceListing.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: {
        seller: { select: { id: true, fullName: true, email: true } },
        farm: { select: { id: true, name: true } },
        _count: { select: { transactions: true, offers: true } }
      }
    });

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      category: row.category,
      totalPrice: row.totalPrice != null ? Number(row.totalPrice) : null,
      pricePerKg: row.pricePerKg != null ? Number(row.pricePerKg) : null,
      totalWeightKg: row.totalWeightKg != null ? Number(row.totalWeightKg) : null,
      currency: row.currency,
      locationLabel: row.locationLabel,
      viewsCount: row.viewsCount,
      activeOfferCount: row.activeOfferCount,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
      seller: row.seller,
      farm: row.farm,
      transactionCount: row._count.transactions,
      offerCount: row._count.offers
    }));
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

  /**
   * Partenaires dédupliqués : transactions escrow marketplace + ventes directes cheptel.
   */
  async listPartners(user: User, role: "seller" | "buyer") {
    const partners = new Map<string, MarketplacePartnerAgg>();
    await this.mergeMarketplacePartners(user, role, partners);

    if (role === "seller") {
      await this.mergeDirectSaleClients(user, partners);
    } else {
      await this.mergeDirectSaleSuppliers(user, partners);
    }

    return [...partners.values()].sort((a, b) =>
      b.lastTransactionAt.localeCompare(a.lastTransactionAt)
    );
  }

  private async mergeMarketplacePartners(
    user: User,
    role: "seller" | "buyer",
    partners: Map<string, MarketplacePartnerAgg>
  ) {
    const asSeller = role === "seller";

    const rows = await this.prisma.marketplaceTransaction.findMany({
      where: asSeller
        ? { sellerUserId: user.id }
        : { buyerUserId: user.id },
      select: {
        updatedAt: true,
        status: true,
        buyer: {
          select: {
            id: true,
            fullName: true,
            buyerProfile: {
              select: { businessName: true, buyerType: true }
            }
          }
        },
        seller: {
          select: {
            id: true,
            fullName: true,
            producerHomeFarmName: true
          }
        },
        listing: {
          select: {
            farm: { select: { name: true } }
          }
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    for (const row of rows) {
      const counterparty = asSeller ? row.buyer : row.seller;
      const partnerId = counterparty.id;
      const isClosed =
        row.status === MarketplaceTransactionStatus.TRANSACTION_CLOSED;
      const at = row.updatedAt.toISOString();

      const existing = partners.get(partnerId);
      if (existing) {
        existing.transactionCount += 1;
        existing.marketplaceCount += 1;
        if (isClosed) {
          existing.closedCount += 1;
        }
        if (at > existing.lastTransactionAt) {
          existing.lastTransactionAt = at;
        }
        continue;
      }

      let displayName: string;
      let subtitle: string | null = null;

      if (asSeller) {
        const businessName = row.buyer.buyerProfile?.businessName?.trim();
        const fullName = row.buyer.fullName?.trim();
        displayName = businessName || fullName || "—";
        subtitle =
          businessName && fullName && businessName !== fullName
            ? fullName
            : null;
      } else {
        const farmName = row.listing.farm?.name?.trim();
        const homeFarm = row.seller.producerHomeFarmName?.trim();
        const sellerName = row.seller.fullName?.trim();
        displayName = farmName || homeFarm || sellerName || "—";
        subtitle =
          (farmName || homeFarm) && sellerName ? sellerName : null;
      }

      partners.set(partnerId, {
        partnerKey: partnerId,
        userId: partnerId,
        displayName,
        subtitle,
        transactionCount: 1,
        closedCount: isClosed ? 1 : 0,
        marketplaceCount: 1,
        directSaleCount: 0,
        lastTransactionAt: at
      });
    }
  }

  private async mergeDirectSaleClients(
    user: User,
    partners: Map<string, MarketplacePartnerAgg>
  ) {
    const farms = await this.prisma.farm.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          { memberships: { some: { userId: user.id } } }
        ]
      },
      select: { id: true }
    });
    const farmIds = farms.map((f) => f.id);
    if (farmIds.length === 0) {
      return;
    }

    const marketplaceAnimalIds = await this.loadMarketplaceAnimalIdsForSeller(
      user.id
    );

    const exits = await this.prisma.livestockExit.findMany({
      where: {
        farmId: { in: farmIds },
        kind: LivestockExitKind.sale,
        buyerName: { not: null }
      },
      select: {
        animalId: true,
        buyerName: true,
        occurredAt: true
      },
      orderBy: { occurredAt: "desc" }
    });

    const directExits = exits.filter((exit) => {
      const name = exit.buyerName?.trim();
      if (!name) {
        return false;
      }
      if (exit.animalId && marketplaceAnimalIds.has(exit.animalId)) {
        return false;
      }
      return true;
    });

    const nameToUserId = this.buildPartnerNameIndex(partners);
    const unresolvedNames = new Set<string>();
    for (const exit of directExits) {
      const norm = normalizePartnerName(exit.buyerName);
      if (norm && !nameToUserId.has(norm)) {
        unresolvedNames.add(exit.buyerName!.trim());
      }
    }
    if (unresolvedNames.size > 0) {
      const resolved = await this.resolveUsersByDisplayNames([
        ...unresolvedNames
      ]);
      for (const [norm, userId] of resolved) {
        nameToUserId.set(norm, userId);
      }
    }

    for (const exit of directExits) {
      const name = exit.buyerName!.trim();
      const norm = normalizePartnerName(name);
      const at = exit.occurredAt.toISOString();
      const matchedUserId = norm ? nameToUserId.get(norm) : undefined;

      if (matchedUserId) {
        this.bumpDirectSalePartner(partners, matchedUserId, {
          userId: matchedUserId,
          displayName: name,
          at
        });
        continue;
      }

      const key = directPartnerKey(norm || name);
      this.bumpDirectSalePartner(partners, key, {
        userId: null,
        displayName: name,
        at
      });
    }
  }

  private async mergeDirectSaleSuppliers(
    user: User,
    partners: Map<string, MarketplacePartnerAgg>
  ) {
    const identityNames = await this.loadBuyerIdentityNames(user.id);
    const buyerNameSet = new Set(
      identityNames.map(normalizePartnerName).filter(Boolean)
    );
    if (buyerNameSet.size === 0) {
      return;
    }

    const marketplaceAnimalIds = await this.loadMarketplaceAnimalIdsForBuyer(
      user.id
    );

    const exits = await this.prisma.livestockExit.findMany({
      where: {
        kind: LivestockExitKind.sale,
        buyerName: { not: null }
      },
      select: {
        animalId: true,
        buyerName: true,
        occurredAt: true,
        farm: {
          select: {
            name: true,
            owner: {
              select: {
                id: true,
                fullName: true,
                producerHomeFarmName: true
              }
            }
          }
        }
      },
      orderBy: { occurredAt: "desc" },
      take: 500
    });

    for (const exit of exits) {
      const norm = normalizePartnerName(exit.buyerName);
      if (!norm || !buyerNameSet.has(norm)) {
        continue;
      }
      if (exit.animalId && marketplaceAnimalIds.has(exit.animalId)) {
        continue;
      }

      const owner = exit.farm.owner;
      const at = exit.occurredAt.toISOString();
      const farmName = exit.farm.name?.trim();
      const homeFarm = owner.producerHomeFarmName?.trim();
      const sellerName = owner.fullName?.trim();
      const displayName = farmName || homeFarm || sellerName || "—";
      const subtitle =
        (farmName || homeFarm) && sellerName ? sellerName : null;

      this.bumpDirectSalePartner(partners, owner.id, {
        userId: owner.id,
        displayName,
        subtitle,
        at
      });
    }
  }

  private bumpDirectSalePartner(
    partners: Map<string, MarketplacePartnerAgg>,
    key: string,
    params: {
      userId: string | null;
      displayName: string;
      subtitle?: string | null;
      at: string;
    }
  ) {
    const existing = partners.get(key);
    if (existing) {
      existing.transactionCount += 1;
      existing.directSaleCount += 1;
      existing.closedCount += 1;
      if (params.at > existing.lastTransactionAt) {
        existing.lastTransactionAt = params.at;
      }
      return;
    }

    partners.set(key, {
      partnerKey: key,
      userId: params.userId,
      displayName: params.displayName,
      subtitle: params.subtitle ?? null,
      transactionCount: 1,
      closedCount: 1,
      marketplaceCount: 0,
      directSaleCount: 1,
      lastTransactionAt: params.at
    });
  }

  private buildPartnerNameIndex(
    partners: Map<string, MarketplacePartnerAgg>
  ): Map<string, string> {
    const index = new Map<string, string>();
    for (const partner of partners.values()) {
      if (!partner.userId) {
        continue;
      }
      const display = normalizePartnerName(partner.displayName);
      const subtitle = normalizePartnerName(partner.subtitle);
      if (display) {
        index.set(display, partner.userId);
      }
      if (subtitle) {
        index.set(subtitle, partner.userId);
      }
    }
    return index;
  }

  private async resolveUsersByDisplayNames(
    names: string[]
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (names.length === 0) {
      return result;
    }

    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          ...names.map((name) => ({
            fullName: { equals: name, mode: "insensitive" as const }
          })),
          ...names.map((name) => ({
            buyerProfile: {
              businessName: { equals: name, mode: "insensitive" as const }
            }
          }))
        ]
      },
      select: {
        id: true,
        fullName: true,
        buyerProfile: { select: { businessName: true } }
      }
    });

    for (const row of users) {
      if (row.fullName?.trim()) {
        result.set(normalizePartnerName(row.fullName), row.id);
      }
      if (row.buyerProfile?.businessName?.trim()) {
        result.set(
          normalizePartnerName(row.buyerProfile.businessName),
          row.id
        );
      }
    }
    return result;
  }

  private async loadBuyerIdentityNames(userId: string): Promise<string[]> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        fullName: true,
        buyerProfile: { select: { businessName: true } }
      }
    });
    if (!row) {
      return [];
    }
    const names: string[] = [];
    if (row.fullName?.trim()) {
      names.push(row.fullName.trim());
    }
    if (row.buyerProfile?.businessName?.trim()) {
      names.push(row.buyerProfile.businessName.trim());
    }
    return names;
  }

  private async loadMarketplaceAnimalIdsForSeller(
    sellerUserId: string
  ): Promise<Set<string>> {
    return this.loadMarketplaceAnimalIds({
      sellerUserId
    });
  }

  private async loadMarketplaceAnimalIdsForBuyer(
    buyerUserId: string
  ): Promise<Set<string>> {
    return this.loadMarketplaceAnimalIds({
      buyerUserId
    });
  }

  private async loadMarketplaceAnimalIds(
    filter: { sellerUserId: string } | { buyerUserId: string }
  ): Promise<Set<string>> {
    const cancelledStatuses: MarketplaceTransactionStatus[] = [
      MarketplaceTransactionStatus.CANCELLED_BY_BUYER,
      MarketplaceTransactionStatus.CANCELLED_BY_SELLER,
      MarketplaceTransactionStatus.CANCELLED_SOLD_TO_OTHER,
      MarketplaceTransactionStatus.PAYMENT_FAILED,
      MarketplaceTransactionStatus.OFFER_EXPIRED
    ];

    const rows = await this.prisma.marketplaceTransaction.findMany({
      where: {
        ...filter,
        status: { notIn: cancelledStatuses }
      },
      select: {
        listing: {
          select: { animalId: true, animalIds: true }
        }
      }
    });

    const ids = new Set<string>();
    for (const row of rows) {
      for (const animalId of this.listingAnimalIds(row.listing)) {
        ids.add(animalId);
      }
    }
    return ids;
  }
}

type MarketplacePartnerAgg = {
  partnerKey: string;
  userId: string | null;
  displayName: string;
  subtitle: string | null;
  transactionCount: number;
  closedCount: number;
  marketplaceCount: number;
  directSaleCount: number;
  lastTransactionAt: string;
};

function normalizePartnerName(value: string | null | undefined): string {
  if (!value?.trim()) {
    return "";
  }
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function directPartnerKey(normalizedName: string): string {
  return `direct:${normalizedName}`;
}
