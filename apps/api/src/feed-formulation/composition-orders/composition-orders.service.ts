import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException
} from "@nestjs/common";
import {
  CompositionFulfillmentMode,
  CompositionOrderDisputeStatus,
  CompositionOrderStatus,
  DeliveryStatus,
  MarketplacePaymentMethod,
  MerchantKind,
  type CompositionOrder,
  type Prisma,
  type User
} from "@prisma/client";
import { FarmAccessService } from "../../common/farm-access.service";
import { FARM_SCOPE } from "../../common/farm-scopes.constants";
import { PlatformFeatureFlagsService } from "../../feature-flags/platform-feature-flags.service";
import { EscrowService } from "../../marketplace/escrow/escrow.service";
import { GeniusPayMobileMoneyGateway } from "../../marketplace/escrow/geniuspay/geniuspay-mobile-money.gateway";
import {
  MOBILE_MONEY_GATEWAY,
  type MobileMoneyGateway
} from "../../marketplace/escrow/mobile-money.gateway";
import { PrismaService } from "../../prisma/prisma.service";
import { UserNotificationsService } from "../../user-notifications/user-notifications.service";
import { CompositionPricingService } from "../assist/composition-pricing.service";
import { IngredientAvailabilityService } from "../assist/ingredient-availability.service";
import {
  REFERENCE_PRICE_PER_KG,
  THEORETICAL_MAX_AVAILABLE_KG
} from "../assist/reference-prices";
import { FeedFormulationService } from "../feed-formulation.service";
import { FeedRequirementProfilesService } from "../feed-requirement-profiles.service";
import type { AvailableIngredientInput } from "../engine/feed-formulation.types";
import { assertEscrowAmountEqualsFinalPrice } from "./composition-escrow.adapter";
import { COMPOSITION_ORDER_DISPUTE_WINDOW_MS } from "./composition-orders.constants";
import {
  canTransitionCompositionOrder,
  type CompositionOrderActor,
  type CompositionOrderEvent
} from "./composition-order-state-machine";
import type {
  ConfirmCompositionPaymentDto,
  CreateCompositionOrderDto,
  MarkOutForDeliveryDto,
  OpenCompositionOrderDisputeDto,
  PayCompositionOrderDto,
  ReviseCompositionOrderDto,
  UpdateReadyEstimateDto
} from "./dto/composition-order.dto";

function usesGeniusPayProvider(): boolean {
  return (
    (process.env.MOBILE_MONEY_PROVIDER ?? "dev").trim().toLowerCase() ===
    "geniuspay"
  );
}

const MILL_RESPONSE_DEADLINE_HOURS = 48;

type SnapshotLine = {
  feedIngredientId: string;
  canonicalName?: string;
  quantityKg: number;
  proportionPct?: number;
  costContribution?: number;
};

@Injectable()
export class CompositionOrdersService {
  private readonly log = new Logger(CompositionOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly pricing: CompositionPricingService,
    private readonly formulation: FeedFormulationService,
    private readonly availability: IngredientAvailabilityService,
    private readonly profiles: FeedRequirementProfilesService,
    private readonly notifications: UserNotificationsService,
    private readonly escrow: EscrowService,
    @Inject(MOBILE_MONEY_GATEWAY)
    private readonly gateway: MobileMoneyGateway,
    private readonly platformFlags: PlatformFeatureFlagsService,
    @Optional() private readonly geniusPay?: GeniusPayMobileMoneyGateway
  ) {}

  /** Producteur : envoie une composition validée à un moulin (SENT_TO_MILL). */
  async sendToMill(
    user: User,
    savedCompositionId: string,
    dto: CreateCompositionOrderDto
  ) {
    const prices = await this.pricing.priceForMills(
      user,
      savedCompositionId,
      dto.radiusKm
    );
    const millQuote = prices.mills.find((m) => m.millId === dto.millProfileId);
    if (!millQuote) {
      throw new BadRequestException(
        "Ce moulin n’est pas disponible dans le rayon pour cette composition."
      );
    }
    if (!millQuote.availabilityComplete) {
      throw new BadRequestException(
        "Ce moulin ne couvre pas tous les intrants — choisissez un moulin complet ou attendez une révision."
      );
    }

    const composition = await this.prisma.savedComposition.findUnique({
      where: { id: savedCompositionId },
      include: {
        farm: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
            departmentCode: true,
            locationCity: true,
            address: true
          }
        }
      }
    });
    if (!composition || composition.status !== "validated") {
      throw new BadRequestException("Composition validée requise.");
    }

    const mill = await this.prisma.merchantProfile.findFirst({
      where: {
        id: dto.millProfileId,
        merchantKind: MerchantKind.mill,
        isActive: true
      },
      select: { id: true, userId: true }
    });
    if (!mill) {
      throw new NotFoundException("Moulin introuvable");
    }

    const snapshotRation = structuredClone(
      composition.ration
    ) as Prisma.InputJsonValue;
    const deadlineAt = new Date(
      Date.now() + MILL_RESPONSE_DEADLINE_HOURS * 3600_000
    );

    const created = await this.prisma.compositionOrder.create({
      data: {
        savedCompositionId: composition.id,
        farmId: composition.farmId,
        producerUserId: user.id,
        millProfileId: mill.id,
        status: CompositionOrderStatus.SENT_TO_MILL,
        snapshotRation,
        quotedPriceXof: millQuote.totalPriceXof,
        deadlineAt
      }
    });
    await this.audit(created, null, "SEND_TO_MILL", user.id, "producer", {
      quotedPriceXof: millQuote.totalPriceXof,
      millName: millQuote.millName
    });

    await this.notifications.notify(
      mill.userId,
      "Nouvelle demande de composition",
      `« ${composition.farm.name} » vous envoie une ration à ${millQuote.totalPriceXof} XOF — répondez avant le ${deadlineAt.toLocaleDateString("fr-FR")}.`,
      {
        type: "composition_order_sent",
        compositionOrderId: created.id,
        farmId: composition.farmId
      }
    );

    return this.toDto(created, {
      farmLocation: {
        city: composition.farm.locationCity,
        address: composition.farm.address,
        departmentCode: composition.farm.departmentCode,
        latitude: composition.farm.latitude
          ? Number(composition.farm.latitude)
          : null,
        longitude: composition.farm.longitude
          ? Number(composition.farm.longitude)
          : null
      }
    });
  }

  /** Moulin : confirme / substitue + dates obligatoires → MILL_REVISED. */
  async reviseAsMill(
    user: User,
    orderId: string,
    dto: ReviseCompositionOrderDto
  ) {
    const order = await this.requireMillOrder(user, orderId);
    this.assertTransition(order.status, "MILL_REVISE", "mill");

    const dates = this.validateMillDates(
      dto.productionStartEstimate,
      dto.readyEstimate
    );

    let snapshotRation = order.snapshotRation as SnapshotLine[];
    let finalPriceXof = Number(order.quotedPriceXof);
    let nutritionDelta: Record<string, unknown> | null = null;
    let fatRiskAlert = false;

    const substituting =
      Boolean(dto.removeIngredientId) && Boolean(dto.addIngredientId);

    if (substituting) {
      const sub = await this.applyMillSubstitution(
        order,
        dto.removeIngredientId!,
        dto.addIngredientId!,
        dto.addPricePerKg,
        user.id
      );
      snapshotRation = sub.ration;
      finalPriceXof = sub.totalCostXof;
      nutritionDelta = sub.nutritionDelta;
      fatRiskAlert = sub.fatRiskAlert;
    } else {
      // Confirmation sans substitution : prix = devis initial (recalculable plus tard).
      finalPriceXof = Number(order.finalPriceXof ?? order.quotedPriceXof);
    }

    const updated = await this.claimTransition(
      order.id,
      order.status,
      CompositionOrderStatus.MILL_REVISED,
      {
        snapshotRation: snapshotRation as unknown as Prisma.InputJsonValue,
        finalPriceXof,
        millNote: dto.millNote?.trim() || null,
        productionStartEstimate: dates.productionStartEstimate,
        readyEstimate: dates.readyEstimate
      }
    );
    await this.audit(
      updated,
      order.status,
      "MILL_REVISE",
      user.id,
      "mill",
      { finalPriceXof, fatRiskAlert }
    );

    await this.notifications.notify(
      order.producerUserId,
      "Le moulin a révisé votre commande",
      `Nouveau prix ${finalPriceXof} XOF. Production possible le ${dates.productionStartEstimate.toLocaleDateString("fr-FR")} — aliment prêt le ${dates.readyEstimate.toLocaleDateString("fr-FR")}.`,
      {
        type: "composition_order_revised",
        compositionOrderId: order.id,
        productionStartEstimate: dates.productionStartEstimate.toISOString(),
        readyEstimate: dates.readyEstimate.toISOString(),
        fatRiskAlert: fatRiskAlert ? "true" : "false"
      }
    );

    return {
      ...this.toDto(updated),
      nutritionDelta,
      fatRiskAlert
    };
  }

  /** Moulin : met à jour readyEstimate tant que pas READY_FOR_PICKUP. */
  async updateReadyEstimate(
    user: User,
    orderId: string,
    dto: UpdateReadyEstimateDto
  ) {
    const order = await this.requireMillOrder(user, orderId);
    if (
      order.status === CompositionOrderStatus.READY_FOR_PICKUP ||
      order.status === CompositionOrderStatus.OUT_FOR_DELIVERY ||
      order.status === CompositionOrderStatus.COMPLETED ||
      order.status === CompositionOrderStatus.CANCELLED ||
      order.status === CompositionOrderStatus.REJECTED
    ) {
      throw new BadRequestException(
        "La date de disponibilité ne peut plus être modifiée à ce stade."
      );
    }
    if (!order.productionStartEstimate) {
      throw new BadRequestException(
        "Révisiez d’abord la commande avec les deux dates."
      );
    }
    const ready = new Date(dto.readyEstimate);
    if (!(ready.getTime() >= order.productionStartEstimate.getTime())) {
      throw new BadRequestException(
        "La date de disponibilité doit être ≥ la date de début de production."
      );
    }

    const updated = await this.prisma.compositionOrder.update({
      where: { id: order.id },
      data: { readyEstimate: ready }
    });
    await this.audit(
      updated,
      order.status,
      "UPDATE_READY_ESTIMATE",
      user.id,
      "mill",
      { readyEstimate: ready.toISOString() }
    );
    await this.notifications.notify(
      order.producerUserId,
      "Date de disponibilité mise à jour",
      `Le moulin annonce maintenant l’aliment prêt le ${ready.toLocaleDateString("fr-FR")}.`,
      {
        type: "composition_order_ready_estimate_updated",
        compositionOrderId: order.id,
        readyEstimate: ready.toISOString()
      }
    );
    return this.toDto(updated);
  }

  async accept(user: User, orderId: string) {
    const order = await this.requireProducerOrder(user, orderId);
    this.assertTransition(order.status, "PRODUCER_ACCEPT", "producer");
    if (
      !order.productionStartEstimate ||
      !order.readyEstimate ||
      order.finalPriceXof == null
    ) {
      throw new BadRequestException(
        "Prix et dates du moulin requis avant acceptation."
      );
    }
    const updated = await this.claimTransition(
      order.id,
      order.status,
      CompositionOrderStatus.ACCEPTED,
      {}
    );
    await this.audit(updated, order.status, "PRODUCER_ACCEPT", user.id, "producer");
    const millUserId = await this.millUserId(order.millProfileId);
    await this.notifications.notify(
      millUserId,
      "Commande composition acceptée",
      "Le producteur a accepté votre devis et vos dates. En attente de paiement.",
      { type: "composition_order_accepted", compositionOrderId: order.id }
    );
    return this.toDto(updated);
  }

  async reject(user: User, orderId: string) {
    const order = await this.requireProducerOrder(user, orderId);
    this.assertTransition(order.status, "PRODUCER_REJECT", "producer");
    const updated = await this.claimTransition(
      order.id,
      order.status,
      CompositionOrderStatus.REJECTED,
      {}
    );
    await this.audit(updated, order.status, "PRODUCER_REJECT", user.id, "producer");
    return this.toDto(updated);
  }

  async cancel(user: User, orderId: string) {
    const order = await this.requireProducerOrder(user, orderId);
    this.assertTransition(order.status, "PRODUCER_CANCEL", "producer");
    const updated = await this.claimTransition(
      order.id,
      order.status,
      CompositionOrderStatus.CANCELLED,
      {}
    );
    await this.audit(updated, order.status, "PRODUCER_CANCEL", user.id, "producer", {
      refund: false
    });
    return this.toDto(updated);
  }

  /**
   * Initie le séquestre = finalPriceXof via EscrowService (pas de duplication).
   */
  async initiatePayment(
    user: User,
    orderId: string,
    dto: PayCompositionOrderDto = {}
  ) {
    const order = await this.requireProducerOrder(user, orderId);
    this.assertTransition(order.status, "PAYMENT_CONFIRMED", "producer");
    if (order.finalPriceXof == null) {
      throw new BadRequestException("Prix final manquant.");
    }
    const amount = Number(order.finalPriceXof);
    // Invariant J4 : séquestre = prix final validé (pas le devis initial).
    assertEscrowAmountEqualsFinalPrice(amount, Number(order.finalPriceXof));

    const paymentMethod =
      dto.paymentMethod ?? MarketplacePaymentMethod.mobile_money;
    const label = `Composition aliment ${order.id}`;

    let hold: {
      providerRef: string;
      paymentMethod: MarketplacePaymentMethod;
      paymentUrl?: string | null;
    };

    if (paymentMethod === MarketplacePaymentMethod.wallet) {
      hold = await this.escrow.holdCompositionFunds(
        order.id,
        user.id,
        amount,
        "XOF",
        label,
        { paymentMethod: MarketplacePaymentMethod.wallet }
      );
    } else if (usesGeniusPayProvider() && this.geniusPay) {
      const init = await this.geniusPay.initiateCompositionOrderPayment({
        amount,
        currency: "XOF",
        buyerUserId: user.id,
        compositionOrderId: order.id,
        label
      });
      hold = {
        providerRef: init.providerRef,
        paymentMethod: MarketplacePaymentMethod.mobile_money,
        paymentUrl: init.paymentUrl ?? null
      };
    } else {
      hold = await this.escrow.holdCompositionFunds(
        order.id,
        user.id,
        amount,
        "XOF",
        label,
        { paymentMethod: MarketplacePaymentMethod.mobile_money }
      );
    }

    if (
      hold.paymentMethod === MarketplacePaymentMethod.mobile_money &&
      !hold.paymentUrl?.trim() &&
      usesGeniusPayProvider()
    ) {
      throw new BadGatewayException(
        "GeniusPay n'a pas renvoyé d'URL de checkout pour ce paiement"
      );
    }

    await this.prisma.compositionOrder.update({
      where: { id: order.id },
      data: {
        escrowTransactionRef: hold.providerRef,
        paymentMethod: hold.paymentMethod,
        paymentInitiatedAt: new Date()
      }
    });

    return {
      orderId: order.id,
      providerRef: hold.providerRef,
      amount,
      currency: "XOF",
      paymentMethod: hold.paymentMethod,
      paymentUrl: hold.paymentUrl ?? null
    };
  }

  /** Confirmation client (wallet / polling) après initiatePayment. */
  async confirmPayment(
    user: User,
    orderId: string,
    dto: ConfirmCompositionPaymentDto = {}
  ) {
    const order = await this.requireProducerOrder(user, orderId);
    if (order.status !== CompositionOrderStatus.ACCEPTED) {
      throw new BadRequestException("Commande non en attente de paiement.");
    }
    const providerRef =
      dto.providerRef?.trim() || order.escrowTransactionRef || "";
    if (!providerRef) {
      throw new BadRequestException("Référence de paiement manquante.");
    }
    return this.finalizePayment(order, providerRef);
  }

  /** Webhook GeniusPay — confirm + notify les DEUX parties (fix J0). */
  async confirmPaymentFromWebhook(
    compositionOrderId: string,
    providerRef: string,
    amount?: number,
    _currency?: string
  ) {
    const order = await this.prisma.compositionOrder.findUnique({
      where: { id: compositionOrderId }
    });
    if (!order) {
      throw new NotFoundException("Commande composition introuvable");
    }
    if (order.status === CompositionOrderStatus.PAID) {
      return { ok: true, alreadyPaid: true };
    }
    if (order.status !== CompositionOrderStatus.ACCEPTED) {
      throw new BadRequestException("Statut commande incompatible avec paiement");
    }
    if (amount != null && order.finalPriceXof != null) {
      assertEscrowAmountEqualsFinalPrice(amount, Number(order.finalPriceXof));
    }
    if (usesGeniusPayProvider() && this.geniusPay) {
      const res = await this.geniusPay.confirmCompositionOrderPayment(
        providerRef,
        compositionOrderId
      );
      if (!res.success) {
        throw new BadRequestException(
          res.failureReason ?? "Paiement GeniusPay non confirmé"
        );
      }
    }
    return this.finalizePayment(order, providerRef);
  }

  private async finalizePayment(order: CompositionOrder, providerRef: string) {
    if (order.finalPriceXof == null) {
      throw new BadRequestException("Prix final manquant.");
    }
    const amount = Number(order.finalPriceXof);
    assertEscrowAmountEqualsFinalPrice(amount, Number(order.finalPriceXof));

    const confirmed = await this.escrow.confirmCompositionHold(
      providerRef,
      order.id,
      {
        buyerUserId: order.producerUserId,
        amount,
        currency: "XOF",
        label: `Composition aliment ${order.id}`
      }
    );
    if (!confirmed.success) {
      throw new BadRequestException(
        confirmed.failureReason ?? "Confirmation de paiement échouée"
      );
    }

    const updated = await this.claimTransition(
      order.id,
      CompositionOrderStatus.ACCEPTED,
      CompositionOrderStatus.PAID,
      {
        escrowTransactionRef: confirmed.providerRef ?? providerRef,
        paymentConfirmedAt: new Date()
      }
    );
    await this.audit(
      updated,
      CompositionOrderStatus.ACCEPTED,
      "PAYMENT_CONFIRMED",
      order.producerUserId,
      "system",
      { amount, providerRef: confirmed.providerRef ?? providerRef }
    );

    const millUserId = await this.millUserId(order.millProfileId);
    // Fix J0 : les DEUX parties notifiées du séquestre
    await this.notifications.notify(
      order.producerUserId,
      "Paiement sécurisé",
      `Votre paiement de ${amount} XOF est séquestré. Le moulin peut démarrer la production.`,
      {
        type: "composition_order_paid",
        compositionOrderId: order.id
      }
    );
    await this.notifications.notify(
      millUserId,
      "Paiement sécurisé reçu",
      `Le producteur a payé ${amount} XOF (séquestre). Vous pouvez démarrer la production.`,
      {
        type: "composition_order_paid_mill",
        compositionOrderId: order.id
      }
    );
    return this.toDto(updated);
  }

  async startProduction(user: User, orderId: string) {
    const order = await this.requireMillOrder(user, orderId);
    this.assertTransition(order.status, "START_PRODUCTION", "mill");
    const now = new Date();
    const updated = await this.claimTransition(
      order.id,
      order.status,
      CompositionOrderStatus.IN_PRODUCTION,
      { productionStartedAt: now }
    );
    await this.audit(
      updated,
      order.status,
      "START_PRODUCTION",
      user.id,
      "mill"
    );
    await this.notifications.notify(
      order.producerUserId,
      "Production démarrée",
      "Le moulin a démarré la fabrication de votre aliment.",
      {
        type: "composition_order_in_production",
        compositionOrderId: order.id
      }
    );
    return this.toDto(updated);
  }

  async markReady(user: User, orderId: string) {
    const order = await this.requireMillOrder(user, orderId);
    this.assertTransition(order.status, "MARK_READY", "mill");
    const now = new Date();
    const disputeWindowEndsAt = new Date(
      now.getTime() + COMPOSITION_ORDER_DISPUTE_WINDOW_MS
    );
    const updated = await this.claimTransition(
      order.id,
      order.status,
      CompositionOrderStatus.READY_FOR_PICKUP,
      {
        readyActual: now,
        fulfillmentMode: CompositionFulfillmentMode.PICKUP,
        disputeWindowEndsAt
      }
    );
    await this.audit(updated, order.status, "MARK_READY", user.id, "mill", {
      readyActual: now.toISOString(),
      readyEstimate: order.readyEstimate?.toISOString() ?? null,
      disputeWindowEndsAt: disputeWindowEndsAt.toISOString()
    });
    await this.notifications.notify(
      order.producerUserId,
      "Aliment prêt",
      `Aliment prêt — à récupérer depuis le ${now.toLocaleDateString("fr-FR")}.`,
      {
        type: "composition_order_ready",
        compositionOrderId: order.id,
        readyActual: now.toISOString()
      }
    );
    return this.toDto(updated);
  }

  /**
   * Moulin : livraison autogérée (flag `delivery`). Crée un Delivery léger.
   * La fenêtre litige s'arme seulement à markDelivered (deliveredAt), pas ici.
   */
  async markOutForDelivery(
    user: User,
    orderId: string,
    dto: MarkOutForDeliveryDto
  ) {
    await this.assertDeliveryModuleActive(user.id);
    const order = await this.requireMillOrder(user, orderId);
    this.assertTransition(order.status, "MARK_OUT_FOR_DELIVERY", "mill");
    const existing = await this.prisma.delivery.findUnique({
      where: { compositionOrderId: order.id }
    });
    if (existing) {
      throw new ConflictException("Une livraison existe déjà pour cette commande");
    }
    const now = new Date();
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : now;
    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.compositionOrder.updateMany({
        where: { id: order.id, status: order.status },
        data: {
          status: CompositionOrderStatus.OUT_FOR_DELIVERY,
          fulfillmentMode: CompositionFulfillmentMode.DELIVERY
        }
      });
      if (claimed.count !== 1) {
        throw new BadRequestException(
          "La commande a déjà changé d’état — réessayez."
        );
      }
      await tx.delivery.create({
        data: {
          compositionOrderId: order.id,
          status: DeliveryStatus.out,
          feeXof: dto.feeXof,
          note: dto.note?.trim() || null,
          scheduledAt
        }
      });
      const row = await tx.compositionOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: { delivery: true, dispute: true }
      });
      await tx.compositionOrderTransition.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: row.status,
          event: "MARK_OUT_FOR_DELIVERY",
          actorUserId: user.id,
          actorRole: "mill",
          meta: {
            feeXof: dto.feeXof,
            note: dto.note?.trim() ?? null
          } as Prisma.InputJsonValue
        }
      });
      return row;
    });
    await this.notifications.notify(
      order.producerUserId,
      "Livraison en cours",
      "Le moulin livre votre aliment. Vous confirmez à la réception.",
      {
        type: "composition_order_out_for_delivery",
        compositionOrderId: order.id
      }
    );
    return this.toDto(updated, {
      delivery: this.serializeDelivery(updated.delivery)
    });
  }

  /**
   * Moulin : marque livré — renseigne deliveredAt et arme la fenêtre litige.
   * Statut commande reste OUT_FOR_DELIVERY jusqu'à confirmation / auto-complete.
   */
  async markDelivered(user: User, orderId: string) {
    await this.assertDeliveryModuleActive(user.id);
    const order = await this.requireMillOrder(user, orderId);
    if (order.status !== CompositionOrderStatus.OUT_FOR_DELIVERY) {
      throw new BadRequestException(
        "Marquez livré uniquement pendant la livraison."
      );
    }
    if (order.fulfillmentMode !== CompositionFulfillmentMode.DELIVERY) {
      throw new BadRequestException("Cette commande n'est pas en livraison.");
    }
    const delivery = await this.prisma.delivery.findUnique({
      where: { compositionOrderId: order.id }
    });
    if (!delivery) {
      throw new NotFoundException("Livraison introuvable pour cette commande");
    }
    if (delivery.deliveredAt) {
      throw new ConflictException("Livraison déjà marquée comme remise");
    }
    const now = new Date();
    const disputeWindowEndsAt = new Date(
      now.getTime() + COMPOSITION_ORDER_DISPUTE_WINDOW_MS
    );
    const [updatedDelivery] = await this.prisma.$transaction([
      this.prisma.delivery.update({
        where: { id: delivery.id },
        data: { status: DeliveryStatus.delivered, deliveredAt: now }
      }),
      this.prisma.compositionOrder.update({
        where: { id: order.id },
        data: { disputeWindowEndsAt }
      }),
      this.prisma.compositionOrderTransition.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: order.status,
          event: "MARK_DELIVERED",
          actorUserId: user.id,
          actorRole: "mill",
          meta: {
            deliveredAt: now.toISOString(),
            disputeWindowEndsAt: disputeWindowEndsAt.toISOString()
          } as Prisma.InputJsonValue
        }
      })
    ]);
    await this.notifications.notify(
      order.producerUserId,
      "Aliment livré",
      "Confirmez la réception ou signalez un problème avant la fin du délai.",
      {
        type: "composition_order_delivered",
        compositionOrderId: order.id,
        deliveredAt: now.toISOString()
      }
    );
    const fresh = await this.prisma.compositionOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { delivery: true, dispute: true }
    });
    return this.toDto(fresh, {
      delivery: this.serializeDelivery(updatedDelivery)
    });
  }

  /**
   * Producteur : « J'ai bien reçu » → libération escrow immédiate via le chemin
   * existant `EscrowService.releaseCompositionFundsToMill` + COMPLETED.
   * Modèle aligné boutique (confirm → release), pas d'attente de fin de fenêtre.
   */
  async confirmReceipt(user: User, orderId: string) {
    const order = await this.requireProducerOrder(user, orderId);
    this.assertTransition(order.status, "COMPLETE", "producer");
    await this.assertConfirmable(order);
    return this.releaseAndComplete(order, user.id, "producer", {
      confirmedReceivedAt: new Date()
    });
  }

  /**
   * Producteur : ouvre un litige pendant la fenêtre (suspend la libération).
   * Réutilise la mécanique MerchantOrderDispute (table dédiée composition).
   */
  async openDispute(
    user: User,
    orderId: string,
    dto: OpenCompositionOrderDisputeDto
  ) {
    const order = await this.requireProducerOrder(user, orderId);
    this.assertTransition(order.status, "OPEN_DISPUTE", "producer");
    const existing = await this.prisma.compositionOrderDispute.findUnique({
      where: { orderId: order.id }
    });
    if (existing) {
      throw new ConflictException("Un litige existe déjà pour cette commande");
    }
    if (!this.isWithinDisputeWindow(order)) {
      throw new BadRequestException(
        "La fenêtre de litige est fermée pour cette commande."
      );
    }
    if (order.status === CompositionOrderStatus.OUT_FOR_DELIVERY) {
      const delivery = await this.prisma.delivery.findUnique({
        where: { compositionOrderId: order.id }
      });
      if (!delivery?.deliveredAt) {
        throw new BadRequestException(
          "Litige possible seulement après remise effective (deliveredAt)."
        );
      }
    }
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.compositionOrderDispute.create({
        data: {
          orderId: order.id,
          openedByUserId: user.id,
          reason: dto.reason.trim()
        }
      });
      const claimed = await tx.compositionOrder.updateMany({
        where: { id: order.id, status: order.status },
        data: {
          status: CompositionOrderStatus.DISPUTED,
          disputeOpenedAt: now
        }
      });
      if (claimed.count !== 1) {
        throw new BadRequestException(
          "La commande a déjà changé d’état — réessayez."
        );
      }
      const row = await tx.compositionOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: { delivery: true, dispute: true }
      });
      await tx.compositionOrderTransition.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: row.status,
          event: "OPEN_DISPUTE",
          actorUserId: user.id,
          actorRole: "producer",
          meta: { reason: dto.reason.trim().slice(0, 500) } as Prisma.InputJsonValue
        }
      });
      return row;
    });
    const millUserId = await this.millUserId(order.millProfileId);
    await this.notifications.notify(
      millUserId,
      "Litige composition",
      "Le producteur a signalé un problème sur la commande.",
      { type: "composition_order_dispute", compositionOrderId: order.id }
    );
    return this.toDto(updated, {
      delivery: this.serializeDelivery(updated.delivery),
      dispute: this.serializeDispute(updated.dispute)
    });
  }

  /**
   * Arbitrage admin — chemins escrow existants uniquement :
   * - mill → releaseCompositionFundsToMill + COMPLETED
   * - producer → refundCompositionBuyer + REFUNDED
   */
  async resolveDispute(
    adminUserId: string,
    orderId: string,
    decision: "mill" | "producer",
    note?: string
  ) {
    const order = await this.prisma.compositionOrder.findUnique({
      where: { id: orderId },
      include: { dispute: true, delivery: true }
    });
    if (!order?.dispute || order.dispute.status !== CompositionOrderDisputeStatus.open) {
      throw new NotFoundException("Litige introuvable ou déjà clos");
    }
    if (order.status !== CompositionOrderStatus.DISPUTED) {
      throw new BadRequestException("La commande n'est pas en litige");
    }
    const resolutionNote = note?.trim() || null;
    const amount = Number(order.finalPriceXof ?? order.quotedPriceXof);
    const millUserId = await this.millUserId(order.millProfileId);

    if (decision === "mill") {
      this.assertTransition(order.status, "RESOLVE_MILL", "system");
      if (!order.escrowReleasedAt) {
        await this.escrow.releaseCompositionFundsToMill(
          order.id,
          millUserId,
          amount,
          "XOF"
        );
      }
      await this.prisma.compositionOrderDispute.update({
        where: { id: order.dispute.id },
        data: {
          status: CompositionOrderDisputeStatus.resolved_seller,
          resolvedAt: new Date(),
          resolvedByUserId: adminUserId,
          resolutionNote
        }
      });
      const completed = await this.claimTransition(
        order.id,
        CompositionOrderStatus.DISPUTED,
        CompositionOrderStatus.COMPLETED,
        {
          completedAt: new Date(),
          escrowReleasedAt: order.escrowReleasedAt ?? new Date()
        }
      );
      await this.audit(
        completed,
        CompositionOrderStatus.DISPUTED,
        "RESOLVE_MILL",
        adminUserId,
        "system",
        { decision: "mill", resolutionNote }
      );
      await this.notifyCompleted(order.producerUserId, millUserId, order.id);
      return this.toDto(completed);
    }

    this.assertTransition(order.status, "RESOLVE_PRODUCER", "system");
    if (!order.escrowReleasedAt) {
      await this.escrow.refundCompositionBuyer(
        order.id,
        order.producerUserId,
        amount,
        "XOF"
      );
    }
    await this.prisma.compositionOrderDispute.update({
      where: { id: order.dispute.id },
      data: {
        status: CompositionOrderDisputeStatus.resolved_buyer,
        resolvedAt: new Date(),
        resolvedByUserId: adminUserId,
        resolutionNote
      }
    });
    const refunded = await this.claimTransition(
      order.id,
      CompositionOrderStatus.DISPUTED,
      CompositionOrderStatus.REFUNDED,
      { escrowReleasedAt: order.escrowReleasedAt ?? new Date() }
    );
    await this.audit(
      refunded,
      CompositionOrderStatus.DISPUTED,
      "RESOLVE_PRODUCER",
      adminUserId,
      "system",
      { decision: "producer", resolutionNote }
    );
    await this.notifications.notify(
      order.producerUserId,
      "Litige résolu",
      "Litige résolu — remboursement producteur.",
      { type: "composition_order_dispute_resolved", compositionOrderId: order.id }
    );
    await this.notifications.notify(
      millUserId,
      "Litige résolu",
      "Litige résolu — remboursement producteur.",
      { type: "composition_order_dispute_resolved", compositionOrderId: order.id }
    );
    return this.toDto(refunded);
  }

  /**
   * Cron : libération auto si fenêtre écoulée sans confirmation ni litige.
   * Pattern timeout escrow + withLock Redis (appelant).
   */
  async runTrackingCycle(now = new Date()): Promise<number> {
    const due = await this.prisma.compositionOrder.findMany({
      where: {
        status: {
          in: [
            CompositionOrderStatus.READY_FOR_PICKUP,
            CompositionOrderStatus.OUT_FOR_DELIVERY
          ]
        },
        escrowReleasedAt: null,
        disputeWindowEndsAt: { lte: now },
        dispute: { is: null }
      },
      take: 50
    });
    let released = 0;
    for (const order of due) {
      try {
        if (order.status === CompositionOrderStatus.OUT_FOR_DELIVERY) {
          const delivery = await this.prisma.delivery.findUnique({
            where: { compositionOrderId: order.id }
          });
          if (!delivery?.deliveredAt) continue;
        }
        await this.releaseAndComplete(order, null, "system", {});
        released += 1;
      } catch (e) {
        this.log.warn(
          `auto-release composition ${order.id}: ${(e as Error).message}`
        );
      }
    }
    return released;
  }

  async getOne(user: User, orderId: string) {
    const order = await this.prisma.compositionOrder.findUnique({
      where: { id: orderId },
      include: { delivery: true, dispute: true }
    });
    if (!order) throw new NotFoundException("Commande introuvable");
    const isProducer = order.producerUserId === user.id;
    const mill = await this.prisma.merchantProfile.findFirst({
      where: { id: order.millProfileId, userId: user.id }
    });
    if (!isProducer && !mill) {
      // Membre autorisé ferme
      try {
        await this.farmAccess.requireFarmScopes(user.id, order.farmId, [
          FARM_SCOPE.financeWrite
        ]);
      } catch {
        throw new ForbiddenException("Accès refusé à cette commande");
      }
    }
    return this.toDto(order, {
      delivery: this.serializeDelivery(order.delivery),
      dispute: this.serializeDispute(order.dispute)
    });
  }

  // ─── helpers ───────────────────────────────────────────────

  private validateMillDates(startIso: string, readyIso: string) {
    const productionStartEstimate = new Date(startIso);
    const readyEstimate = new Date(readyIso);
    const now = Date.now() - 60_000; // tolérance 1 min
    if (
      Number.isNaN(productionStartEstimate.getTime()) ||
      Number.isNaN(readyEstimate.getTime())
    ) {
      throw new BadRequestException("Dates invalides.");
    }
    if (productionStartEstimate.getTime() < now) {
      throw new BadRequestException(
        "La date de début de production doit être dans le futur."
      );
    }
    if (readyEstimate.getTime() < productionStartEstimate.getTime()) {
      throw new BadRequestException(
        "La date de disponibilité doit être ≥ la date de début de production."
      );
    }
    return { productionStartEstimate, readyEstimate };
  }

  private async applyMillSubstitution(
    order: CompositionOrder,
    removeIngredientId: string,
    addIngredientId: string,
    addPricePerKg: number | undefined,
    userId: string
  ) {
    if (removeIngredientId === addIngredientId) {
      throw new BadRequestException(
        "L'intrant retiré et le substitut doivent être différents"
      );
    }
    const composition = await this.prisma.savedComposition.findUnique({
      where: { id: order.savedCompositionId }
    });
    if (!composition) {
      throw new NotFoundException("Composition source introuvable");
    }
    const params = (composition.inputParams ?? {}) as Record<string, unknown>;
    const animalCount = Number(params.animalCount);
    const avgWeightKg = Number(params.avgWeightKg);
    const durationDays = Number(params.durationDays);
    if (!(animalCount > 0) || !(avgWeightKg > 0) || !(durationDays > 0)) {
      throw new BadRequestException("Paramètres d'entrée incomplets.");
    }

    const avail = await this.availability.resolve(order.millProfileId);
    let addIngredient: AvailableIngredientInput | undefined =
      avail.availableIngredients.find(
        (a) => a.feedIngredientId === addIngredientId
      );
    if (!addIngredient) {
      const ing = await this.prisma.feedIngredient.findUnique({
        where: { id: addIngredientId },
        select: { id: true, category: true, isActive: true }
      });
      if (!ing?.isActive) {
        throw new BadRequestException("Intrant substitut introuvable");
      }
      addIngredient = {
        feedIngredientId: addIngredientId,
        pricePerKg:
          addPricePerKg != null && addPricePerKg > 0
            ? addPricePerKg
            : REFERENCE_PRICE_PER_KG[ing.category] ?? 300,
        maxAvailableKg: THEORETICAL_MAX_AVAILABLE_KG
      };
    }

    const availableIngredients = [...avail.availableIngredients];
    if (
      !availableIngredients.some((a) => a.feedIngredientId === removeIngredientId)
    ) {
      availableIngredients.push({
        feedIngredientId: removeIngredientId,
        pricePerKg: 300,
        maxAvailableKg: THEORETICAL_MAX_AVAILABLE_KG
      });
    }

    const result = await this.formulation.recomputeWithSubstitution(
      {
        stage: composition.stage,
        animalCount,
        avgWeightKg,
        durationDays,
        availableIngredients
      },
      removeIngredientId,
      addIngredient,
      userId
    );
    if (!result.feasible) {
      throw new BadRequestException(
        result.infeasibilityReasons[0] ??
          "Substitution impossible avec les stocks du moulin."
      );
    }

    const profile = await this.profiles.getActiveByStage(composition.stage);
    const energyCap = profile.maxMetabolizableEnergyKcal;
    const newEnergy = result.nutritionResult?.metabolizableEnergyKcal ?? null;
    const fatRiskAlert =
      energyCap != null &&
      newEnergy != null &&
      newEnergy > energyCap + 1e-4;

    return {
      ration: result.ration.map((l) => ({
        feedIngredientId: l.feedIngredientId,
        canonicalName: l.canonicalName,
        quantityKg: l.quantityKg,
        proportionPct: l.proportionPct,
        costContribution: l.costContribution
      })),
      totalCostXof: result.totalCostXof,
      nutritionDelta: result.nutritionDelta,
      fatRiskAlert
    };
  }

  private assertTransition(
    from: CompositionOrderStatus,
    event: CompositionOrderEvent,
    actor: CompositionOrderActor
  ) {
    const res = canTransitionCompositionOrder(from, event, actor);
    if (!res.allowed || !res.to) {
      throw new BadRequestException(
        `Transition interdite : ${from} + ${event} (${actor}).`
      );
    }
    return res.to;
  }

  /** Claim atomique updateMany conditionnel. */
  private async claimTransition(
    orderId: string,
    expectedStatus: CompositionOrderStatus,
    toStatus: CompositionOrderStatus,
    data: Prisma.CompositionOrderUpdateManyMutationInput
  ): Promise<CompositionOrder> {
    const result = await this.prisma.compositionOrder.updateMany({
      where: { id: orderId, status: expectedStatus },
      data: { ...data, status: toStatus }
    });
    if (result.count !== 1) {
      throw new BadRequestException(
        "La commande a déjà changé d’état — réessayez."
      );
    }
    const row = await this.prisma.compositionOrder.findUnique({
      where: { id: orderId }
    });
    if (!row) throw new NotFoundException("Commande introuvable");
    return row;
  }

  private async audit(
    order: CompositionOrder,
    fromStatus: CompositionOrderStatus | null,
    event: string,
    actorUserId: string | null,
    actorRole: CompositionOrderActor,
    meta?: Record<string, unknown>
  ) {
    await this.prisma.compositionOrderTransition.create({
      data: {
        orderId: order.id,
        fromStatus: fromStatus ?? undefined,
        toStatus: order.status,
        event,
        actorUserId: actorUserId ?? undefined,
        actorRole,
        meta: (meta ?? undefined) as Prisma.InputJsonValue | undefined
      }
    });
  }

  private async requireProducerOrder(user: User, orderId: string) {
    const order = await this.prisma.compositionOrder.findUnique({
      where: { id: orderId }
    });
    if (!order) throw new NotFoundException("Commande introuvable");
    if (order.producerUserId !== user.id) {
      await this.farmAccess.requireFarmScopes(user.id, order.farmId, [
        FARM_SCOPE.financeWrite
      ]);
    }
    return order;
  }

  private async requireMillOrder(user: User, orderId: string) {
    const order = await this.prisma.compositionOrder.findUnique({
      where: { id: orderId }
    });
    if (!order) throw new NotFoundException("Commande introuvable");
    const mill = await this.prisma.merchantProfile.findFirst({
      where: {
        id: order.millProfileId,
        userId: user.id,
        merchantKind: MerchantKind.mill
      }
    });
    if (!mill) {
      throw new ForbiddenException("Réservé au moulin de cette commande");
    }
    return order;
  }

  private async millUserId(millProfileId: string): Promise<string> {
    const mill = await this.prisma.merchantProfile.findUnique({
      where: { id: millProfileId },
      select: { userId: true }
    });
    if (!mill) throw new NotFoundException("Moulin introuvable");
    return mill.userId;
  }

  /**
   * Libération escrow via chemin EXISTANT puis COMPLETED (claim atomique).
   * Idempotence : wallet `composition-release:…` + claim sur escrowReleasedAt null.
   */
  private async releaseAndComplete(
    order: CompositionOrder,
    actorUserId: string | null,
    actorRole: CompositionOrderActor,
    extraData: Prisma.CompositionOrderUpdateManyMutationInput
  ) {
    if (order.escrowReleasedAt) {
      throw new ConflictException("Escrow déjà libéré pour cette commande");
    }
    this.assertTransition(order.status, "COMPLETE", actorRole);
    const amount = Number(order.finalPriceXof ?? order.quotedPriceXof);
    if (!(amount > 0)) {
      throw new BadRequestException("Montant commande invalide pour libération");
    }
    const millUserId = await this.millUserId(order.millProfileId);
    await this.escrow.releaseCompositionFundsToMill(
      order.id,
      millUserId,
      amount,
      "XOF"
    );
    const now = new Date();
    const claimed = await this.prisma.compositionOrder.updateMany({
      where: {
        id: order.id,
        status: order.status,
        escrowReleasedAt: null
      },
      data: {
        ...extraData,
        status: CompositionOrderStatus.COMPLETED,
        completedAt: now,
        escrowReleasedAt: now
      }
    });
    if (claimed.count !== 1) {
      throw new ConflictException(
        "Libération concurrente détectée — commande déjà clôturée."
      );
    }
    const updated = await this.prisma.compositionOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { delivery: true, dispute: true }
    });
    await this.audit(updated, order.status, "COMPLETE", actorUserId, actorRole, {
      auto: actorRole === "system",
      amount
    });
    await this.notifyCompleted(order.producerUserId, millUserId, order.id);
    return this.toDto(updated, {
      delivery: this.serializeDelivery(updated.delivery),
      dispute: this.serializeDispute(updated.dispute)
    });
  }

  private async notifyCompleted(
    producerUserId: string,
    millUserId: string,
    orderId: string
  ) {
    await this.notifications.notify(
      producerUserId,
      "Commande terminée",
      "Votre commande composition est terminée.",
      { type: "composition_order_completed", compositionOrderId: orderId }
    );
    await this.notifications.notify(
      millUserId,
      "Paiement versé",
      "Le paiement de la commande composition a été versé sur votre portefeuille.",
      { type: "composition_order_completed_mill", compositionOrderId: orderId }
    );
  }

  private async assertConfirmable(order: CompositionOrder) {
    if (order.status === CompositionOrderStatus.READY_FOR_PICKUP) {
      if (!order.readyActual) {
        throw new BadRequestException(
          "Confirmation impossible : readyActual manquant."
        );
      }
      return;
    }
    if (order.status === CompositionOrderStatus.OUT_FOR_DELIVERY) {
      const delivery = await this.prisma.delivery.findUnique({
        where: { compositionOrderId: order.id }
      });
      if (!delivery?.deliveredAt) {
        throw new BadRequestException(
          "Confirmez la réception seulement après remise (deliveredAt)."
        );
      }
      return;
    }
    throw new BadRequestException("Confirmation impossible dans cet état.");
  }

  private isWithinDisputeWindow(order: CompositionOrder, now = new Date()): boolean {
    if (!order.disputeWindowEndsAt) return false;
    return now.getTime() <= order.disputeWindowEndsAt.getTime();
  }

  private async assertDeliveryModuleActive(userId: string) {
    const active = await this.platformFlags.isModuleActiveForUser(
      "delivery",
      userId
    );
    if (!active) {
      const message =
        (await this.platformFlags.getInactiveMessage("delivery", "fr")) ??
        "Module delivery indisponible";
      throw new ServiceUnavailableException({
        statusCode: 503,
        code: "MODULE_INACTIVE",
        moduleId: "delivery",
        message,
        error: "Service Unavailable"
      });
    }
  }

  private serializeDelivery(
    delivery:
      | {
          id: string;
          status: DeliveryStatus;
          feeXof: { toNumber?: () => number } | number;
          note: string | null;
          scheduledAt: Date | null;
          deliveredAt: Date | null;
        }
      | null
      | undefined
  ) {
    if (!delivery) return null;
    const fee =
      typeof delivery.feeXof === "number"
        ? delivery.feeXof
        : Number(delivery.feeXof);
    return {
      id: delivery.id,
      status: delivery.status,
      feeXof: fee,
      note: delivery.note,
      scheduledAt: delivery.scheduledAt?.toISOString() ?? null,
      deliveredAt: delivery.deliveredAt?.toISOString() ?? null
    };
  }

  private serializeDispute(
    dispute:
      | {
          id: string;
          reason: string;
          status: CompositionOrderDisputeStatus;
          resolvedAt: Date | null;
          resolutionNote: string | null;
          createdAt: Date;
        }
      | null
      | undefined
  ) {
    if (!dispute) return null;
    return {
      id: dispute.id,
      reason: dispute.reason,
      status: dispute.status,
      resolvedAt: dispute.resolvedAt?.toISOString() ?? null,
      resolutionNote: dispute.resolutionNote,
      createdAt: dispute.createdAt.toISOString()
    };
  }

  private toDto(
    order: CompositionOrder,
    extra?: Record<string, unknown>
  ) {
    return {
      id: order.id,
      savedCompositionId: order.savedCompositionId,
      farmId: order.farmId,
      producerUserId: order.producerUserId,
      millProfileId: order.millProfileId,
      status: order.status,
      snapshotRation: order.snapshotRation,
      quotedPriceXof: Number(order.quotedPriceXof),
      finalPriceXof:
        order.finalPriceXof != null ? Number(order.finalPriceXof) : null,
      millNote: order.millNote,
      productionStartEstimate: order.productionStartEstimate?.toISOString() ?? null,
      readyEstimate: order.readyEstimate?.toISOString() ?? null,
      productionStartedAt: order.productionStartedAt?.toISOString() ?? null,
      readyActual: order.readyActual?.toISOString() ?? null,
      fulfillmentMode: order.fulfillmentMode,
      confirmedReceivedAt: order.confirmedReceivedAt?.toISOString() ?? null,
      disputeWindowEndsAt: order.disputeWindowEndsAt?.toISOString() ?? null,
      escrowReleasedAt: order.escrowReleasedAt?.toISOString() ?? null,
      completedAt: order.completedAt?.toISOString() ?? null,
      escrowTransactionRef: order.escrowTransactionRef,
      deadlineAt: order.deadlineAt?.toISOString() ?? null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      ...extra
    };
  }
}
