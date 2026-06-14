import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  ListingMarketCategory,
  ListingStatus,
  MarketplacePaymentMethod,
  OfferStatus,
  OfferType,
  Prisma
} from "@prisma/client";
import { FarmAccessService } from "../../common/farm-access.service";
import { FARM_SCOPE } from "../../common/farm-scopes.constants";
import { PrismaService } from "../../prisma/prisma.service";
import { PushNotificationsService } from "../../push-notifications/push-notifications.service";
import { EscrowService } from "../escrow/escrow.service";
import {
  ACTIVE_DEAL_TRANSACTION_STATUSES,
  calculateFinalAmount
} from "../escrow/transaction.utils";
import { CreditScoreService } from "./credit-score.service";
import { ProducerScoreService } from "../../producer-score/producer-score.service";
import { MarketplaceTransactionService } from "../escrow/marketplace-transaction.service";

const ESCROW_PAYMENT_MSG =
  "Utilisez le paiement sécurisé sur la plateforme via l'écran transaction marketplace.";

const CREDIT_CATEGORY = ListingMarketCategory.butcher;
const MIN_ADVANCE_PCT = 20;
const MAX_ADVANCE_PCT = 50;
const MAX_BALANCE_DAYS = 7;

@Injectable()
export class CreditOffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly push: PushNotificationsService,
    private readonly creditScore: CreditScoreService,
    private readonly producerScore: ProducerScoreService,
    private readonly escrow: EscrowService,
    @Inject(forwardRef(() => MarketplaceTransactionService))
    private readonly transactions: MarketplaceTransactionService
  ) {}

  private assertCreditEligible(listing: {
    category: ListingMarketCategory | null;
    creditEnabled: boolean;
  }) {
    this.assertCreditCategory(listing.category);
    if (!listing.creditEnabled) {
      throw new BadRequestException(
        "Cette annonce n'accepte pas les ventes à crédit"
      );
    }
  }

  private assertCreditCategory(category: ListingMarketCategory | null) {
    if (category !== CREDIT_CATEGORY) {
      throw new BadRequestException(
        "Les offres à crédit sont réservées aux annonces charcutier"
      );
    }
  }

  private parseCreditTerms(params: {
    offeredPrice: number;
    advancePercentage: number;
    balanceDueDays: number;
  }) {
    if (!Number.isFinite(params.offeredPrice) || params.offeredPrice <= 0) {
      throw new BadRequestException("Prix total invalide");
    }
    const pct = Math.round(params.advancePercentage);
    if (pct < MIN_ADVANCE_PCT || pct > MAX_ADVANCE_PCT) {
      throw new BadRequestException(
        `L'avance doit être entre ${MIN_ADVANCE_PCT}% et ${MAX_ADVANCE_PCT}%`
      );
    }
    const days = Math.round(params.balanceDueDays);
    if (days < 1 || days > MAX_BALANCE_DAYS) {
      throw new BadRequestException(
        `Le délai de solde doit être entre 1 et ${MAX_BALANCE_DAYS} jours`
      );
    }
    const advanceAmount = Math.round((params.offeredPrice * pct) / 100);
    const balanceAmount = Math.round(params.offeredPrice - advanceAmount);
    if (balanceAmount <= 0) {
      throw new BadRequestException("Le solde doit être supérieur à zéro");
    }
    return { pct, days, advanceAmount, balanceAmount };
  }

  async createCreditOffer(
    user: User,
    listingId: string,
    dto: {
      offeredPrice: number;
      advancePercentage: number;
      balanceDueDays: number;
      message?: string;
      buyerFarmId?: string;
    }
  ) {
    if (await this.creditScore.isCreditBlocked(user.id)) {
      throw new ForbiddenException(
        "Votre score crédit ne vous permet pas de faire des offres à crédit pour le moment"
      );
    }
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: listingId }
    });
    if (!listing || listing.status !== ListingStatus.published) {
      throw new BadRequestException("Annonce non disponible");
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
      throw new ForbiddenException("Offre impossible sur votre annonce");
    }
    this.assertCreditEligible(listing);
    await this.producerScore.assertSellerCreditSalesAllowed(listing.sellerUserId);
    const terms = this.parseCreditTerms(dto);

    const created = await this.prisma.marketplaceOffer.create({
      data: {
        listingId,
        buyerUserId: user.id,
        buyerFarmId: dto.buyerFarmId?.trim() || null,
        offerType: OfferType.credit,
        offeredPrice: new Prisma.Decimal(dto.offeredPrice),
        advancePercentage: terms.pct,
        advanceAmount: new Prisma.Decimal(terms.advanceAmount),
        balanceAmount: new Prisma.Decimal(terms.balanceAmount),
        balanceDueDays: terms.days,
        message: dto.message?.trim() || null,
        status: OfferStatus.pending
      },
      include: { buyer: { select: { fullName: true } } }
    });

    const buyerName = created.buyer.fullName?.trim() || "Un acheteur";
    void this.push.sendToUser(
      listing.sellerUserId,
      "💳 Nouvelle offre à crédit",
      `${buyerName} propose ${Math.round(dto.offeredPrice).toLocaleString("fr-FR")} ${listing.currency} avec ${terms.pct}% d'avance et solde à ${terms.days} jours`,
      { type: "marketplace_credit_offer", listingId, offerId: created.id }
    );
    return this.serializeOffer(created.id, user.id);
  }

  async counterCredit(
    user: User,
    listingId: string,
    offerId: string,
    dto: {
      offeredPrice: number;
      advancePercentage: number;
      balanceDueDays: number;
      message?: string;
    }
  ) {
    const _listing = await this.requireSellerListing(user, listingId);
    const offer = await this.requireCreditOffer(offerId, listingId);
    if (offer.status !== OfferStatus.pending) {
      throw new BadRequestException("Contre-proposition impossible");
    }
    const terms = this.parseCreditTerms(dto);
    await this.prisma.marketplaceOffer.update({
      where: { id: offerId },
      data: {
        offeredPrice: new Prisma.Decimal(dto.offeredPrice),
        advancePercentage: terms.pct,
        advanceAmount: new Prisma.Decimal(terms.advanceAmount),
        balanceAmount: new Prisma.Decimal(terms.balanceAmount),
        balanceDueDays: terms.days,
        message: dto.message?.trim() || offer.message,
        status: OfferStatus.countered
      }
    });
    void this.push.sendToUser(
      offer.buyerUserId,
      "🔄 Contre-proposition crédit",
      `Le vendeur contre-propose : ${terms.pct}% d'avance, solde sous ${terms.days} jours`,
      { type: "marketplace_credit_counter", listingId, offerId }
    );
    return this.serializeOffer(offerId, user.id);
  }

  async agreeCredit(user: User, listingId: string, offerId: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: listingId }
    });
    if (!listing) {
      throw new NotFoundException("Annonce introuvable");
    }
    if (listing.status !== ListingStatus.published) {
      throw new BadRequestException("Annonce non eligible");
    }
    const offer = await this.requireCreditOffer(offerId, listingId);
    const isSeller = listing.sellerUserId === user.id;
    const isBuyer = offer.buyerUserId === user.id;
    if (!isSeller && !isBuyer) {
      throw new ForbiddenException();
    }
    if (
      isSeller &&
      offer.status !== OfferStatus.pending &&
      offer.status !== OfferStatus.countered
    ) {
      throw new BadRequestException("Accord impossible");
    }
    if (isBuyer && offer.status !== OfferStatus.countered) {
      throw new BadRequestException(
        "L'acheteur ne peut accepter qu'une contre-proposition"
      );
    }

    await this.prisma.$transaction([
      this.prisma.marketplaceOffer.update({
        where: { id: offerId },
        data: { status: OfferStatus.credit_agreed }
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
          reservedForBuyerUserId: offer.buyerUserId
        }
      })
    ]);

    const { transactionId } =
      await this.transactions.createCreditAdvanceTransaction(offerId);
    const advance = Number(offer.advanceAmount ?? 0);
    void this.push.sendToUser(
      offer.buyerUserId,
      "✅ Accord crédit conclu",
      `Sécurisez l'avance de ${Math.round(advance).toLocaleString("fr-FR")} ${listing.currency} sur la plateforme pour lancer la livraison.`,
      { type: "marketplace_credit_agreed", listingId, offerId, transactionId }
    );
    void this.push.sendToUser(
      listing.sellerUserId,
      "Accord crédit conclu",
      isBuyer
        ? `L'acheteur a accepté votre contre-proposition sur « ${listing.title} ». En attente de son paiement d'avance.`
        : `En attente du paiement d'avance de l'acheteur pour « ${listing.title} ».`,
      {
        type: "marketplace_credit_agreed_seller",
        listingId,
        offerId,
        transactionId
      }
    );
    const serialized = await this.serializeOffer(offerId, user.id);
    return { ...serialized, transactionId };
  }

  async declareAdvancePaid(
    _user: User,
    _offerId: string,
    _dto: { paymentMode: string; paymentRef?: string }
  ) {
    throw new BadRequestException(ESCROW_PAYMENT_MSG);
  }

  async confirmAdvanceReceived(
    _user: User,
    _offerId: string,
    _received: boolean
  ) {
    throw new BadRequestException(ESCROW_PAYMENT_MSG);
  }

  /** Après validation du poids réel — recalcule le solde dû (prix réel − avance escrow). */
  async onCreditWeightValidated(transactionId: string) {
    const tx = await this.prisma.marketplaceTransaction.findUnique({
      where: { id: transactionId },
      include: { offer: true, listing: true }
    });
    if (!tx?.offer || tx.offer.offerType !== OfferType.credit) {
      return;
    }
    const finalAmount = calculateFinalAmount(tx);
    const advanceHeld = Number(tx.blockedAmount);
    const balanceAmount = Math.max(0, Math.round(finalAmount - advanceHeld));
    const dueAt = new Date();
    dueAt.setDate(
      dueAt.getDate() + (tx.offer.balanceDueDays ?? MAX_BALANCE_DAYS)
    );
    await this.prisma.$transaction([
      this.prisma.marketplaceTransaction.update({
        where: { id: transactionId },
        data: { finalAmount: new Prisma.Decimal(finalAmount) }
      }),
      this.prisma.marketplaceOffer.update({
        where: { id: tx.offerId },
        data: {
          status: OfferStatus.balance_pending,
          balanceAmount: new Prisma.Decimal(balanceAmount),
          balanceDueAt: dueAt,
          deliveredAt: tx.buyerReceivedAt ?? new Date(),
          balancePaymentRef: null
        }
      })
    ]);
    const amountLabel = `${Math.round(balanceAmount).toLocaleString("fr-FR")} ${tx.currency}`;
    void this.push.sendToUser(
      tx.buyerUserId,
      "Solde recalculé au poids réel",
      `Prix réel : ${Math.round(finalAmount).toLocaleString("fr-FR")} ${tx.currency}. Solde de ${amountLabel} à régler sur la plateforme avant le ${dueAt.toLocaleDateString("fr-FR")}.`,
      { type: "marketplace_credit_balance_due", offerId: tx.offerId, transactionId }
    );
  }

  async initiateBalancePayment(
    user: User,
    offerId: string,
    dto?: { paymentMethod?: "mobile_money" | "wallet" }
  ) {
    const offer = await this.requireBuyerCreditOffer(offerId, user.id);
    if (
      offer.status !== OfferStatus.balance_pending &&
      offer.status !== OfferStatus.arbitration
    ) {
      throw new BadRequestException("Paiement du solde impossible à ce stade");
    }
    const amount = Number(offer.balanceAmount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("Aucun solde à payer");
    }
    const tx = await this.prisma.marketplaceTransaction.findUnique({
      where: { offerId }
    });
    if (!tx) {
      throw new BadRequestException("Transaction introuvable");
    }
    const method =
      dto?.paymentMethod === "wallet"
        ? MarketplacePaymentMethod.wallet
        : MarketplacePaymentMethod.mobile_money;
    const hold = await this.escrow.holdFunds(
      tx.id,
      user.id,
      amount,
      tx.currency,
      `Solde crédit ${offerId}`,
      { paymentMethod: method }
    );
    await this.prisma.marketplaceOffer.update({
      where: { id: offerId },
      data: {
        balancePaymentRef: hold.providerRef,
        balancePaymentMode: method === MarketplacePaymentMethod.wallet ? "wallet" : "escrow"
      }
    });
    return {
      providerRef: hold.providerRef,
      amount,
      currency: tx.currency,
      transactionId: tx.id,
      paymentMethod: hold.paymentMethod
    };
  }

  async confirmBalancePayment(user: User, offerId: string, providerRef?: string) {
    const offer = await this.requireBuyerCreditOffer(offerId, user.id);
    if (
      offer.status !== OfferStatus.balance_pending &&
      offer.status !== OfferStatus.arbitration
    ) {
      throw new BadRequestException("Confirmation du solde impossible");
    }
    if (offer.balancePaidDeclaredAt) {
      return this.serializeOffer(offerId, user.id);
    }
    const ref = offer.balancePaymentRef?.trim();
    if (!ref) {
      throw new BadRequestException("Initiez d'abord le paiement du solde");
    }
    if (providerRef && providerRef !== ref) {
      throw new BadRequestException("Référence paiement invalide");
    }
    const tx = await this.prisma.marketplaceTransaction.findUniqueOrThrow({
      where: { offerId }
    });
    const walletContext =
      offer.balancePaymentMode === "wallet"
        ? {
            buyerUserId: user.id,
            amount: Number(offer.balanceAmount ?? 0),
            currency: tx.currency,
            label: `Solde crédit ${offerId}`
          }
        : undefined;
    const ok = await this.escrow.confirmHold(ref, tx.id, walletContext);
    if (!ok.success) {
      throw new BadRequestException("Paiement du solde refusé");
    }
    await this.prisma.marketplaceOffer.update({
      where: { id: offerId },
      data: {
        status: OfferStatus.balance_declared,
        balancePaidDeclaredAt: new Date(),
        balancePaidAmount: offer.balanceAmount,
        balancePaymentMode: "escrow"
      }
    });
    const balance = Number(offer.balanceAmount ?? 0);
    void this.push.sendToUser(
      tx.sellerUserId,
      "💰 Solde sécurisé sur la plateforme",
      `L'acheteur a bloqué ${Math.round(balance).toLocaleString("fr-FR")} ${tx.currency} en escrow. Confirmez pour clôturer.`,
      { type: "marketplace_credit_balance_declared", offerId }
    );
    return this.serializeOffer(offerId, user.id);
  }

  /** @deprecated Utiliser initiateBalancePayment + confirmBalancePayment (escrow). */
  async declareBalancePaid(
    _user: User,
    _offerId: string,
    _dto: { amount: number; paymentMode: string; paymentRef?: string }
  ) {
    throw new BadRequestException(ESCROW_PAYMENT_MSG);
  }

  async confirmBalanceReceived(user: User, offerId: string, received: boolean) {
    const offer = await this.requireSellerCreditOffer(offerId, user.id);
    if (!offer.balancePaidDeclaredAt) {
      throw new BadRequestException(
        "Le vendeur ne peut confirmer qu'après déclaration acheteur"
      );
    }
    if (!received) {
      await this.prisma.marketplaceOffer.update({
        where: { id: offerId },
        data: {
          balancePaidDeclaredAt: null,
          balancePaidAmount: null,
          balancePaymentMode: null,
          balancePaymentRef: null,
          status: OfferStatus.balance_pending
        }
      });
      // balancePaymentRef cleared — l'acheteur peut relancer un paiement escrow
      void this.push.sendToUser(
        offer.buyerUserId,
        "Solde non confirmé",
        "Le vendeur n'a pas confirmé la réception du solde",
        { type: "marketplace_credit_balance_rejected", offerId }
      );
      return this.serializeOffer(offerId, user.id);
    }
    const now = new Date();
    const onTime =
      !offer.balanceDueAt || offer.balancePaidDeclaredAt! <= offer.balanceDueAt;
    const tx = await this.prisma.marketplaceTransaction.findUnique({
      where: { offerId }
    });
    if (tx) {
      await this.transactions.settleCreditTransaction(tx.id);
    }
    await this.prisma.$transaction([
      this.prisma.marketplaceOffer.update({
        where: { id: offerId },
        data: {
          balanceConfirmedAt: now,
          status: OfferStatus.completed,
          completedAt: now
        }
      }),
      this.prisma.marketplaceListing.update({
        where: { id: offer.listingId },
        data: {
          status: ListingStatus.sold,
          reservedForBuyerUserId: null,
          activeOfferCount: 0
        }
      })
    ]);
    if (onTime) {
      await this.creditScore.recordOnTimePayment(offer.buyerUserId);
    } else {
      await this.creditScore.recordLatePayment(offer.buyerUserId);
    }
    void this.push.sendToUser(
      offer.buyerUserId,
      "Solde confirmé",
      "Transaction crédit close",
      { type: "marketplace_credit_completed", offerId }
    );
    return this.serializeOffer(offerId, user.id);
  }

  async listCreditPending(user: User, farmId?: string) {
    if (farmId) {
      await this.farmAccess.requireFarmScopes(user.id, farmId, [
        FARM_SCOPE.marketplaceWrite
      ]);
    }
    const rows = await this.prisma.marketplaceOffer.findMany({
      where: {
        offerType: OfferType.credit,
        status: {
          in: [
            OfferStatus.balance_pending,
            OfferStatus.balance_declared,
            OfferStatus.arbitration
          ]
        },
        ...(farmId
          ? { listing: { farmId, sellerUserId: user.id } }
          : { buyerUserId: user.id })
      },
      orderBy: { balanceDueAt: "asc" },
      include: {
        listing: { select: { id: true, title: true, currency: true, farmId: true } },
        buyer: { select: { fullName: true } }
      },
      take: 50
    });
    return rows.map((r) => ({
      id: r.id,
      listingId: r.listingId,
      listingTitle: r.listing.title,
      currency: r.listing.currency,
      balanceAmount: Number(r.balanceAmount ?? 0),
      balanceDueAt: r.balanceDueAt?.toISOString() ?? null,
      status: r.status,
      buyerName: r.buyer.fullName
    }));
  }

  async handleCreditReminders(): Promise<{ reminders: number; arbitrations: number }> {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    let reminders = 0;
    let arbitrations = 0;

    const pending = await this.prisma.marketplaceOffer.findMany({
      where: {
        offerType: OfferType.credit,
        status: OfferStatus.balance_pending,
        balanceDueAt: { not: null },
        balancePaidDeclaredAt: null
      },
      include: {
        listing: { include: { farm: { select: { name: true } } } },
        buyer: { select: { fullName: true } }
      }
    });

    for (const offer of pending) {
      const due = offer.balanceDueAt!;
      const msPerDay = 86_400_000;
      if (now.getTime() <= due.getTime()) {
        continue;
      }
      const daysLate = Math.floor((now.getTime() - due.getTime()) / msPerDay);
      const balance = Number(offer.balanceAmount ?? 0);
      const farmName = offer.listing.farm?.name ?? "la ferme";
      const amountLabel = `${Math.round(balance).toLocaleString("fr-FR")} ${offer.listing.currency}`;

      if (daysLate === 1) {
        reminders += 2;
        void this.push.sendToUser(
          offer.buyerUserId,
          "🔴 Retard de paiement — solde dépassé",
          `Le solde de ${amountLabel} pour ${farmName} est en retard. Réglez sur la plateforme immédiatement.`,
          { type: "marketplace_credit_reminder", offerId: offer.id }
        );
        void this.push.sendToUser(
          offer.listing.sellerUserId,
          "⚠️ Solde acheteur en retard",
          `Le solde de ${amountLabel} est dépassé.`,
          { type: "marketplace_credit_reminder_seller", offerId: offer.id }
        );
      } else if (daysLate >= 2) {
        const existing = await this.prisma.marketplaceCreditArbitration.findFirst({
          where: { offerId: offer.id, resolvedAt: null }
        });
        if (existing) {
          continue;
        }
        arbitrations += 1;
        await this.prisma.$transaction([
          this.prisma.marketplaceOffer.update({
            where: { id: offer.id },
            data: { status: OfferStatus.arbitration }
          }),
          this.prisma.marketplaceListing.update({
            where: { id: offer.listingId },
            data: { disputedAt: now }
          }),
          this.prisma.marketplaceCreditArbitration.create({
            data: {
              offerId: offer.id,
              listingId: offer.listingId,
              buyerUserId: offer.buyerUserId,
              sellerUserId: offer.listing.sellerUserId,
              balanceAmount: offer.balanceAmount ?? new Prisma.Decimal(0)
            }
          })
        ]);
        await this.creditScore.recordArbitrationTriggered(offer.buyerUserId);
        void this.push.sendToUser(
          offer.buyerUserId,
          "🔴 Délai dépassé — arbitrage en cours",
          `Résolvez le paiement de ${amountLabel} immédiatement`,
          { type: "marketplace_credit_arbitration", offerId: offer.id }
        );
        void this.push.sendToUser(
          offer.listing.sellerUserId,
          "⚠️ Arbitrage automatique lancé",
          `Délai de solde dépassé pour ${offer.buyer.fullName ?? "l'acheteur"}`,
          { type: "marketplace_credit_arbitration", offerId: offer.id }
        );
      }
    }
    return { reminders, arbitrations };
  }

  async resolveArbitration(
    user: User,
    arbitrationId: string,
    resolution: "paid_late" | "defaulted" | "cancelled",
    notes?: string
  ) {
    const row = await this.prisma.marketplaceCreditArbitration.findUnique({
      where: { id: arbitrationId },
      include: { offer: true, listing: true }
    });
    if (!row || row.resolvedAt) {
      throw new BadRequestException("Arbitrage introuvable ou déjà résolu");
    }
    if (
      row.sellerUserId !== user.id &&
      row.buyerUserId !== user.id
    ) {
      throw new ForbiddenException();
    }
    const now = new Date();
    if (resolution === "paid_late") {
      if (row.sellerUserId !== user.id) {
        throw new ForbiddenException("Seul le vendeur peut confirmer un paiement tardif");
      }
      await this.prisma.$transaction([
        this.prisma.marketplaceCreditArbitration.update({
          where: { id: arbitrationId },
          data: {
            resolvedAt: now,
            resolution: "paid_late",
            notes: notes?.trim() || null
          }
        }),
        this.prisma.marketplaceOffer.update({
          where: { id: row.offerId },
          data: {
            status: OfferStatus.completed,
            balanceConfirmedAt: now,
            completedAt: now
          }
        }),
        this.prisma.marketplaceListing.update({
          where: { id: row.listingId },
          data: {
            status: ListingStatus.sold,
            disputedAt: null,
            reservedForBuyerUserId: null,
            activeOfferCount: 0
          }
        })
      ]);
      await this.creditScore.recordLatePayment(row.buyerUserId);
    } else if (resolution === "defaulted") {
      if (row.sellerUserId !== user.id) {
        throw new ForbiddenException();
      }
      await this.prisma.$transaction([
        this.prisma.marketplaceCreditArbitration.update({
          where: { id: arbitrationId },
          data: {
            resolvedAt: now,
            resolution: "defaulted",
            notes: notes?.trim() || null
          }
        }),
        this.prisma.marketplaceOffer.update({
          where: { id: row.offerId },
          data: { status: OfferStatus.cancelled }
        }),
        this.prisma.marketplaceListing.update({
          where: { id: row.listingId },
          data: {
            status: ListingStatus.published,
            reservedForBuyerUserId: null,
            disputedAt: null
          }
        })
      ]);
      await this.creditScore.recordDefault(row.buyerUserId);
    } else {
      await this.prisma.marketplaceCreditArbitration.update({
        where: { id: arbitrationId },
        data: {
          resolvedAt: now,
          resolution: "cancelled",
          notes: notes?.trim() || null
        }
      });
    }
    return { ok: true };
  }

  private async requireSellerListing(user: User, listingId: string) {
    const listing = await this.prisma.marketplaceListing.findFirst({
      where: { id: listingId, sellerUserId: user.id }
    });
    if (!listing) {
      throw new NotFoundException("Annonce introuvable");
    }
    if (listing.farmId) {
      await this.farmAccess.requireFarmScopes(user.id, listing.farmId, [
        FARM_SCOPE.marketplaceWrite
      ]);
    }
    return listing;
  }

  private async requireCreditOffer(offerId: string, listingId: string) {
    const offer = await this.prisma.marketplaceOffer.findFirst({
      where: { id: offerId, listingId, offerType: OfferType.credit }
    });
    if (!offer) {
      throw new NotFoundException("Offre crédit introuvable");
    }
    return offer;
  }

  private async requireBuyerCreditOffer(offerId: string, userId: string) {
    const offer = await this.prisma.marketplaceOffer.findFirst({
      where: { id: offerId, buyerUserId: userId, offerType: OfferType.credit }
    });
    if (!offer) {
      throw new NotFoundException("Offre introuvable");
    }
    return offer;
  }

  private async requireSellerCreditOffer(offerId: string, userId: string) {
    const offer = await this.prisma.marketplaceOffer.findFirst({
      where: {
        id: offerId,
        offerType: OfferType.credit,
        listing: { sellerUserId: userId }
      },
      include: { listing: true }
    });
    if (!offer) {
      throw new NotFoundException("Offre introuvable");
    }
    return offer;
  }

  async serializeOffer(offerId: string, viewerUserId: string) {
    const offer = await this.prisma.marketplaceOffer.findUnique({
      where: { id: offerId },
      include: {
        listing: { select: { title: true, currency: true, category: true, sellerUserId: true } },
        buyer: { select: { id: true, fullName: true } },
        transaction: { select: { id: true } }
      }
    });
    if (!offer) {
      throw new NotFoundException();
    }
    const buyerScore =
      offer.buyerUserId === viewerUserId ||
      offer.listing.sellerUserId === viewerUserId
        ? await this.creditScore.getForUser(offer.buyerUserId)
        : null;
    return {
      id: offer.id,
      listingId: offer.listingId,
      listingTitle: offer.listing.title,
      currency: offer.listing.currency,
      offerType: offer.offerType,
      status: offer.status,
      offeredPrice: Number(offer.offeredPrice),
      advancePercentage: offer.advancePercentage,
      advanceAmount: offer.advanceAmount ? Number(offer.advanceAmount) : null,
      balanceAmount: offer.balanceAmount ? Number(offer.balanceAmount) : null,
      balanceDueDays: offer.balanceDueDays,
      balanceDueAt: offer.balanceDueAt?.toISOString() ?? null,
      deliveredAt: offer.deliveredAt?.toISOString() ?? null,
      advancePaidDeclaredAt: offer.advancePaidDeclaredAt?.toISOString() ?? null,
      advanceConfirmedAt: offer.advanceConfirmedAt?.toISOString() ?? null,
      balancePaidDeclaredAt: offer.balancePaidDeclaredAt?.toISOString() ?? null,
      balanceConfirmedAt: offer.balanceConfirmedAt?.toISOString() ?? null,
      message: offer.message,
      buyerName: offer.buyer.fullName,
      buyerCreditScore: buyerScore,
      transactionId: offer.transaction?.id ?? null
    };
  }
}
