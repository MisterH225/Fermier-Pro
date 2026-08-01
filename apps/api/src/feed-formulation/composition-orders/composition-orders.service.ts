import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  CompositionOrderStatus,
  MerchantKind,
  type CompositionOrder,
  type Prisma,
  type User
} from "@prisma/client";
import { FarmAccessService } from "../../common/farm-access.service";
import { FARM_SCOPE } from "../../common/farm-scopes.constants";
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
import { refuseCompositionEscrowUntilAdapterReady } from "./composition-escrow.adapter";
import {
  canTransitionCompositionOrder,
  type CompositionOrderActor,
  type CompositionOrderEvent
} from "./composition-order-state-machine";
import type {
  CreateCompositionOrderDto,
  ReviseCompositionOrderDto,
  UpdateReadyEstimateDto
} from "./dto/composition-order.dto";

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly pricing: CompositionPricingService,
    private readonly formulation: FeedFormulationService,
    private readonly availability: IngredientAvailabilityService,
    private readonly profiles: FeedRequirementProfilesService,
    private readonly notifications: UserNotificationsService
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
   * Paiement — STOP escrow (voir composition-escrow.adapter.ts).
   * Ne duplique aucun circuit ; refuse jusqu'à extension du schéma.
   */
  async initiatePayment(user: User, orderId: string) {
    const order = await this.requireProducerOrder(user, orderId);
    this.assertTransition(order.status, "PAYMENT_CONFIRMED", "producer");
    if (order.finalPriceXof == null) {
      throw new BadRequestException("Prix final manquant.");
    }
    refuseCompositionEscrowUntilAdapterReady({
      compositionOrderId: order.id,
      finalPriceXof: Number(order.finalPriceXof)
    });
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
    const updated = await this.claimTransition(
      order.id,
      order.status,
      CompositionOrderStatus.READY_FOR_PICKUP,
      { readyActual: now }
    );
    await this.audit(updated, order.status, "MARK_READY", user.id, "mill", {
      readyActual: now.toISOString(),
      readyEstimate: order.readyEstimate?.toISOString() ?? null
    });
    await this.notifications.notify(
      order.producerUserId,
      "Aliment prêt",
      `Prêt — à récupérer depuis le ${now.toLocaleDateString("fr-FR")}.`,
      {
        type: "composition_order_ready",
        compositionOrderId: order.id,
        readyActual: now.toISOString()
      }
    );
    return this.toDto(updated);
  }

  async getOne(user: User, orderId: string) {
    const order = await this.prisma.compositionOrder.findUnique({
      where: { id: orderId }
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
    return this.toDto(order);
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
      escrowTransactionRef: order.escrowTransactionRef,
      deadlineAt: order.deadlineAt?.toISOString() ?? null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      ...extra
    };
  }
}
