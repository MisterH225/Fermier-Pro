import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  MembershipRole,
  Prisma,
  ProductionStage,
  type SavedComposition,
  type User
} from "@prisma/client";
import { randomUUID } from "crypto";
import { ChatService } from "../../chat/chat.service";
import type { FeedCompositionCardPayload } from "../../chat/chat-composition-message";
import { parseFeedCompositionCardBody } from "../../chat/chat-composition-message";
import { FarmAccessService } from "../../common/farm-access.service";
import { PrismaService } from "../../prisma/prisma.service";
import { UserNotificationsService } from "../../user-notifications/user-notifications.service";
import type {
  FormulateResult,
  SubstitutionResult
} from "../engine/feed-formulation.types";
import { FeedFormulationService } from "../feed-formulation.service";
import type {
  ApplyCompositionAdjustmentDto,
  ProposeCompositionAdjustmentDto,
  RejectCompositionAdjustmentDto,
  RequestVetReviewDto,
  SaveCompositionDto,
  VetReviewCompositionDto
} from "./dto/feed-composition.dto";
import { FeedRequirementProfilesService } from "../feed-requirement-profiles.service";
import { IngredientAvailabilityService } from "./ingredient-availability.service";
import {
  REFERENCE_PRICE_PER_KG,
  THEORETICAL_MAX_AVAILABLE_KG
} from "./reference-prices";

type DeviationFromCurrent = {
  crudeProteinPct: number;
  metabolizableEnergyKcal: number;
  lysinePct: number;
  methioninePct: number;
  calciumPct: number;
  phosphorusPct: number;
  crudeFiberPct: number;
  energyChangePct: number | null;
  /** true si l'énergie dépasse le plafond anti-gras du stade. */
  fatRiskAlert: boolean;
  energyCapKcal: number | null;
};

@Injectable()
export class SavedCompositionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly notifications: UserNotificationsService,
    private readonly chat: ChatService,
    private readonly formulation: FeedFormulationService,
    private readonly availability: IngredientAvailabilityService,
    private readonly profiles: FeedRequirementProfilesService
  ) {}

  async save(user: User, dto: SaveCompositionDto) {
    await this.farmAccess.requireFarmAccess(user.id, dto.farmId);
    const created = await this.prisma.savedComposition.create({
      data: {
        farmId: dto.farmId,
        createdByUserId: user.id,
        stage: dto.stage,
        inputParams: dto.inputParams as Prisma.InputJsonValue,
        ration: dto.ration as unknown as Prisma.InputJsonValue,
        nutritionResult: (dto.nutritionResult ?? null) as Prisma.InputJsonValue,
        totalCostXof: dto.totalCostXof,
        source: dto.source,
        status: "draft",
        millProfileId: dto.millProfileId ?? null,
        isTheoretical: dto.isTheoretical ?? false
      }
    });
    return this.toDto(created);
  }

  async listForFarm(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const rows = await this.prisma.savedComposition.findMany({
      where: { farmId },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    return Promise.all(rows.map((r) => this.toDtoWithLinks(r)));
  }

  async getOne(user: User, id: string) {
    const row = await this.requireReadable(user, id);
    return this.toDtoWithLinks(row);
  }

  /** Véto associés à la ferme (membres role veterinarian). */
  async listAssociatedVeterinarians(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const members = await this.prisma.farmMembership.findMany({
      where: {
        farmId,
        role: MembershipRole.veterinarian,
        archived: false
      },
      include: {
        user: {
          select: { id: true, fullName: true, phone: true, email: true }
        }
      }
    });
    return members.map((m) => ({
      userId: m.userId,
      fullName: m.user.fullName,
      phone: m.user.phone,
      email: m.user.email
    }));
  }

  /**
   * Envoi en validation : ouvre VetConsultation + ChatRoom feed_composition,
   * poste la carte composition, notifie le véto.
   */
  async requestVetReview(
    user: User,
    compositionId: string,
    dto: RequestVetReviewDto
  ) {
    const row = await this.requireOwnedOrMember(user, compositionId);
    if (row.status === "validated") {
      throw new BadRequestException("Composition déjà validée");
    }
    if (row.status === "vet_review") {
      throw new BadRequestException(
        "Composition déjà en revue vétérinaire — attendez la réponse ou l'annulation du dossier"
      );
    }

    const vets = await this.prisma.farmMembership.findMany({
      where: {
        farmId: row.farmId,
        role: MembershipRole.veterinarian,
        archived: false
      },
      select: { userId: true }
    });
    if (vets.length === 0) {
      throw new BadRequestException(
        "Aucun vétérinaire associé à cette ferme — option indisponible"
      );
    }

    const targetUserId =
      dto.veterinarianUserId?.trim() || vets[0]!.userId;
    if (!vets.some((v) => v.userId === targetUserId)) {
      throw new BadRequestException(
        "Ce vétérinaire n'est pas associé à la ferme"
      );
    }

    const stageLabel = stageLabelFr(row.stage);
    const consultation = await this.prisma.vetConsultation.create({
      data: {
        farmId: row.farmId,
        subject: `Validation composition — ${stageLabel}`,
        summary: `Revue vétérinaire d'une ration (${stageLabel}).`,
        status: "open",
        openedByUserId: user.id,
        primaryVetUserId: targetUserId
      }
    });

    const room = await this.chat.ensureCompositionReviewRoom({
      producerUserId: row.createdByUserId,
      veterinarianUserId: targetUserId,
      compositionId: row.id,
      consultationId: consultation.id,
      title: `Composition — ${stageLabel}`
    });

    const updated = await this.prisma.savedComposition.update({
      where: { id: row.id },
      data: {
        status: "vet_review",
        vetComment: null,
        vetReviewedBy: null,
        vetReviewedAt: null
      }
    });

    const card = this.buildCardFromSaved(updated, {
      variant: "initial",
      proposedByUserId: user.id
    });
    await this.chat.postCompositionCardMessage(room.id, user.id, card);

    const farm = await this.prisma.farm.findUnique({
      where: { id: row.farmId },
      select: { name: true }
    });

    await this.notifications.notify(
      targetUserId,
      "Composition à valider",
      `Une ration (${stageLabel}) de « ${farm?.name ?? "ferme"} » attend votre avis.`,
      {
        type: "feed_composition_vet_review",
        farmId: row.farmId,
        farmName: farm?.name ?? "—",
        compositionId: row.id,
        roomId: room.id,
        consultationId: consultation.id,
        stage: row.stage
      }
    );

    return {
      ...(await this.toDtoWithLinks(updated)),
      chatRoomId: room.id,
      vetConsultationId: consultation.id
    };
  }

  async vetReview(
    user: User,
    compositionId: string,
    dto: VetReviewCompositionDto
  ) {
    const row = await this.requireAssociatedVet(user, compositionId);
    if (row.status !== "vet_review") {
      throw new BadRequestException(
        "Cette composition n'est pas en attente de revue vétérinaire"
      );
    }

    const approved = dto.decision === "approve";
    const updated = await this.prisma.savedComposition.update({
      where: { id: row.id },
      data: {
        // Demande d'ajustements : reste en vet_review (fil ouvert).
        status: approved ? "validated" : "vet_review",
        vetComment: dto.comment?.trim() || null,
        vetReviewedBy: user.id,
        vetReviewedAt: approved ? new Date() : null
      }
    });

    const roomId = await this.chat.findCompositionRoomId(row.id);
    const consultation = roomId
      ? await this.prisma.chatRoom.findUnique({
          where: { id: roomId },
          select: { vetConsultationId: true }
        })
      : null;

    if (approved && consultation?.vetConsultationId) {
      // « Closed » métier = resolved + closedAt (enum VetConsultationStatus).
      await this.prisma.vetConsultation.update({
        where: { id: consultation.vetConsultationId },
        data: { status: "resolved", closedAt: new Date() }
      });
    }

    if (roomId) {
      const card = this.buildCardFromSaved(updated, {
        variant: approved ? "validated" : "request_changes",
        proposedByUserId: user.id,
        note: dto.comment?.trim() || null
      });
      await this.chat.postCompositionCardMessage(roomId, user.id, card);
    }

    const vet = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { fullName: true }
    });

    const farm = await this.prisma.farm.findUnique({
      where: { id: row.farmId },
      select: { name: true }
    });

    await this.notifications.notify(
      row.createdByUserId,
      approved ? "Composition validée" : "Ajustements demandés sur la ration",
      approved
        ? `Validée par ${vet?.fullName ?? "votre vétérinaire"}.`
        : dto.comment?.trim() ||
          "Votre vétérinaire demande des modifications — discutez dans le fil.",
      {
        type: approved
          ? "feed_composition_validated"
          : "feed_composition_vet_reviewed",
        farmId: row.farmId,
        farmName: farm?.name ?? "—",
        compositionId: row.id,
        decision: dto.decision,
        ...(roomId ? { roomId } : {})
      }
    );

    return this.toDtoWithLinks(updated);
  }

  /**
   * Prévisualise un ajustement (moteur) sans persister — pour confirmation véto.
   */
  async previewVetAdjustment(
    user: User,
    compositionId: string,
    dto: ProposeCompositionAdjustmentDto
  ) {
    const row = await this.requireAssociatedVet(user, compositionId);
    if (row.status !== "vet_review") {
      throw new BadRequestException(
        "La composition doit être en revue pour proposer un ajustement"
      );
    }
    const computed = await this.computeSubstitutionAdjustment(row, dto, user.id);
    return {
      feasible: computed.result.feasible,
      formulation: computed.result,
      deviationFromCurrent: computed.deviation,
      fatRiskAlert: computed.deviation.fatRiskAlert,
      infeasibilityReasons: computed.result.infeasibilityReasons
    };
  }

  /**
   * Véto propose un ajustement : moteur recomputeWithSubstitution,
   * enregistre CompositionAdjustmentProposal, carte dans le fil.
   * Jamais de quantités inventées. Infaisable → erreur claire, pas de proposition.
   */
  async proposeAdjustment(
    user: User,
    compositionId: string,
    dto: ProposeCompositionAdjustmentDto
  ) {
    const row = await this.requireAssociatedVet(user, compositionId);
    if (row.status !== "vet_review") {
      throw new BadRequestException(
        "La composition doit être en revue pour proposer un ajustement"
      );
    }

    const roomId = await this.chat.findCompositionRoomId(row.id);
    if (!roomId) {
      throw new BadRequestException(
        "Aucun salon de discussion pour cette composition"
      );
    }

    const computed = await this.computeSubstitutionAdjustment(row, dto, user.id);
    if (!computed.result.feasible) {
      throw new BadRequestException({
        code: "ADJUSTMENT_INFEASIBLE",
        message:
          "Cet ajustement rend le mélange infaisable avec les intrants disponibles. " +
          "Choisissez un autre substitut, ou gardez la ration actuelle.",
        infeasibilityReasons: computed.result.infeasibilityReasons
      });
    }

    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      select: { vetConsultationId: true }
    });

    const proposal = await this.prisma.compositionAdjustmentProposal.create({
      data: {
        savedCompositionId: row.id,
        proposedByUserId: user.id,
        vetConsultationId: room?.vetConsultationId ?? null,
        kind: "substitute_ingredient",
        payload: {
          removeIngredientId: dto.removeIngredientId,
          addIngredientId: dto.addIngredientId,
          comment: dto.comment?.trim() || null
        } as Prisma.InputJsonValue,
        resultRation: computed.result.ration as unknown as Prisma.InputJsonValue,
        nutritionResult: (computed.result.nutritionResult ??
          null) as Prisma.InputJsonValue,
        deviationFromCurrent: computed.deviation as unknown as Prisma.InputJsonValue,
        status: "proposed"
      }
    });

    const card = this.buildCardFromFormulation(row, computed.result, {
      variant: "adjustment",
      proposedByUserId: user.id,
      note: dto.comment?.trim() || null,
      proposalId: proposal.id,
      fatRiskAlert: computed.deviation.fatRiskAlert
    });
    const msg = await this.chat.postCompositionCardMessage(
      roomId,
      user.id,
      card
    );

    await this.prisma.compositionAdjustmentProposal.update({
      where: { id: proposal.id },
      data: { chatMessageId: msg.id }
    });

    await this.notifications.notify(
      row.createdByUserId,
      "Ajustement proposé sur votre ration",
      dto.comment?.trim() ||
        "Votre vétérinaire a proposé une nouvelle version — regardez le fil.",
      {
        type: "feed_composition_adjustment",
        farmId: row.farmId,
        farmName: (await this.farmName(row.farmId)) ?? "—",
        compositionId: row.id,
        roomId,
        messageId: msg.id,
        proposalId: proposal.id
      }
    );

    return {
      proposalId: proposal.id,
      messageId: msg.id,
      formulation: computed.result,
      deviationFromCurrent: computed.deviation,
      fatRiskAlert: computed.deviation.fatRiskAlert,
      card
    };
  }

  /**
   * Producteur applique une proposition → remplace la ration, reste en vet_review.
   * Autres propositions ouvertes → superseded. Pas d'auto-validation.
   */
  async applyAdjustment(
    user: User,
    compositionId: string,
    dto: ApplyCompositionAdjustmentDto
  ) {
    const row = await this.requireOwnedOrMember(user, compositionId);
    if (row.status === "validated") {
      throw new BadRequestException("Composition déjà validée");
    }

    const proposal = await this.resolveProposal(row.id, dto);
    if (proposal.status !== "proposed") {
      throw new BadRequestException(
        "Cette proposition n'est plus ouverte (déjà appliquée, refusée ou remplacée)"
      );
    }
    if (!Array.isArray(proposal.resultRation) || proposal.resultRation.length === 0) {
      throw new BadRequestException(
        "Cette version n'est pas faisable — ne peut pas être appliquée"
      );
    }

    const ration = proposal.resultRation as Prisma.InputJsonValue;
    const nutritionResult = (proposal.nutritionResult ??
      null) as Prisma.InputJsonValue;
    const totalCost = this.totalCostFromRation(proposal.resultRation);

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.savedComposition.update({
        where: { id: row.id },
        data: {
          ration,
          nutritionResult,
          totalCostXof: totalCost,
          explanation: Prisma.DbNull,
          // Reste en revue — le véto doit re-valider explicitement.
          status: "vet_review",
          vetComment: null,
          vetReviewedBy: null,
          vetReviewedAt: null
        }
      });

      await tx.compositionAdjustmentProposal.update({
        where: { id: proposal.id },
        data: {
          status: "applied",
          previousRation: row.ration as Prisma.InputJsonValue,
          previousNutritionResult: (row.nutritionResult ??
            null) as Prisma.InputJsonValue,
          previousTotalCostXof: row.totalCostXof
        }
      });

      await tx.compositionAdjustmentProposal.updateMany({
        where: {
          savedCompositionId: row.id,
          status: "proposed",
          id: { not: proposal.id }
        },
        data: { status: "superseded" }
      });

      return next;
    });

    const roomId =
      (await this.chat.findCompositionRoomId(row.id)) ??
      (proposal.chatMessageId
        ? (
            await this.prisma.chatMessage.findUnique({
              where: { id: proposal.chatMessageId },
              select: { roomId: true }
            })
          )?.roomId
        : null);

    if (roomId) {
      const appliedCard = this.buildCardFromSaved(updated, {
        variant: "initial",
        proposedByUserId: user.id,
        note: "Version appliquée — en attente de validation du véto"
      });
      await this.chat.postCompositionCardMessage(roomId, user.id, appliedCard);

      const room = await this.prisma.chatRoom.findUnique({
        where: { id: roomId },
        select: { members: { select: { userId: true } } }
      });
      const vetIds = (room?.members ?? [])
        .map((m) => m.userId)
        .filter((id) => id !== user.id);
      for (const vetId of vetIds) {
        await this.notifications.notify(
          vetId,
          "Proposition d'ajustement appliquée",
          "Le producteur a appliqué votre ajustement — merci de revoir et valider la ration.",
          {
            type: "feed_composition_vet_review",
            farmId: row.farmId,
            farmName: (await this.farmName(row.farmId)) ?? "—",
            compositionId: row.id,
            roomId,
            proposalId: proposal.id
          }
        );
      }
    }

    return this.toDtoWithLinks(updated);
  }

  /** Producteur refuse une proposition — status rejected + message dans le fil. */
  async rejectAdjustment(
    user: User,
    compositionId: string,
    proposalId: string,
    dto: RejectCompositionAdjustmentDto
  ) {
    const row = await this.requireOwnedOrMember(user, compositionId);
    const proposal = await this.prisma.compositionAdjustmentProposal.findFirst({
      where: { id: proposalId, savedCompositionId: row.id }
    });
    if (!proposal) {
      throw new NotFoundException("Proposition introuvable");
    }
    if (proposal.status !== "proposed") {
      throw new BadRequestException(
        "Cette proposition n'est plus ouverte"
      );
    }

    await this.prisma.compositionAdjustmentProposal.update({
      where: { id: proposal.id },
      data: { status: "rejected" }
    });

    const roomId = await this.chat.findCompositionRoomId(row.id);
    if (roomId) {
      const note =
        dto.comment?.trim() ||
        "Proposition d'ajustement refusée — on garde la ration actuelle.";
      await this.chat.createMessage(user.id, roomId, note);
    }

    await this.notifications.notify(
      proposal.proposedByUserId,
      "Proposition d'ajustement refusée",
      dto.comment?.trim() ||
        "Le producteur a refusé votre proposition d'ajustement.",
      {
        type: "feed_composition_adjustment_rejected",
        farmId: row.farmId,
        farmName: (await this.farmName(row.farmId)) ?? "—",
        compositionId: row.id,
        proposalId: proposal.id,
        ...(roomId ? { roomId } : {})
      }
    );

    return { proposalId: proposal.id, status: "rejected" as const };
  }


  /** Catalogue intrants actifs (recherche pour ajustement véto). */
  async searchIngredients(user: User, q: string) {
    // Accès : producteur/membre ferme OU véto avec membership.
    const membership = await this.prisma.farmMembership.findFirst({
      where: { userId: user.id, archived: false },
      select: { id: true }
    });
    const ownsFarm = await this.prisma.farm.findFirst({
      where: { ownerId: user.id },
      select: { id: true }
    });
    if (!membership && !ownsFarm) {
      throw new ForbiddenException("Accès catalogue refusé");
    }
    const term = q.trim();
    return this.prisma.feedIngredient.findMany({
      where: {
        isActive: true,
        ...(term
          ? {
              OR: [
                { canonicalName: { contains: term, mode: "insensitive" } },
                { aliases: { has: term } }
              ]
            }
          : {})
      },
      take: 30,
      orderBy: { canonicalName: "asc" },
      select: {
        id: true,
        canonicalName: true,
        category: true
      }
    });
  }

  /** Compositions en revue pour le véto connecté (toutes ses fermes). */
  async listPendingForVeterinarian(user: User) {
    const memberships = await this.prisma.farmMembership.findMany({
      where: {
        userId: user.id,
        role: MembershipRole.veterinarian,
        archived: false
      },
      select: { farmId: true }
    });
    const farmIds = memberships.map((m) => m.farmId);
    if (farmIds.length === 0) return [];

    const rows = await this.prisma.savedComposition.findMany({
      where: { farmId: { in: farmIds }, status: "vet_review" },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        farm: { select: { id: true, name: true } }
      }
    });

    return Promise.all(
      rows.map(async (r) => ({
        ...(await this.toDtoWithLinks(r)),
        farmName: r.farm.name
      }))
    );
  }

  private async requireAssociatedVet(user: User, compositionId: string) {
    const row = await this.prisma.savedComposition.findUnique({
      where: { id: compositionId }
    });
    if (!row) {
      throw new NotFoundException("Composition introuvable");
    }
    const membership = await this.prisma.farmMembership.findFirst({
      where: {
        farmId: row.farmId,
        userId: user.id,
        role: MembershipRole.veterinarian,
        archived: false
      }
    });
    if (!membership) {
      throw new ForbiddenException(
        "Seuls les vétérinaires associés à la ferme peuvent agir"
      );
    }
    return row;
  }

  private async requireReadable(user: User, id: string) {
    const row = await this.prisma.savedComposition.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Composition introuvable");
    await this.farmAccess.requireFarmAccess(user.id, row.farmId);
    return row;
  }

  private async requireOwnedOrMember(user: User, id: string) {
    return this.requireReadable(user, id);
  }

  /**
   * Recalcule via recomputeWithSubstitution — seule voie d'ajustement supportée.
   * (Pas d'API moteur pour adjust_constraint / cible nutritionnelle.)
   */
  private async computeSubstitutionAdjustment(
    row: SavedComposition,
    dto: ProposeCompositionAdjustmentDto,
    userId: string
  ): Promise<{
    result: SubstitutionResult;
    deviation: DeviationFromCurrent;
  }> {
    if (dto.removeIngredientId === dto.addIngredientId) {
      throw new BadRequestException(
        "L'intrant retiré et le substitut doivent être différents"
      );
    }

    const params = (row.inputParams ?? {}) as Record<string, unknown>;
    const animalCount = Number(params.animalCount);
    const avgWeightKg = Number(params.avgWeightKg);
    const durationDays = Number(params.durationDays);
    if (!(animalCount > 0) || !(avgWeightKg > 0) || !(durationDays > 0)) {
      throw new BadRequestException(
        "Paramètres d'entrée incomplets — reformulez d'abord la ration"
      );
    }

    const millId =
      typeof params.millId === "string"
        ? params.millId
        : row.millProfileId ?? undefined;
    const avail = await this.availability.resolve(millId);
    const addFromAvail = avail.availableIngredients.find(
      (a) => a.feedIngredientId === dto.addIngredientId
    );
    let addIngredient = addFromAvail;
    if (!addIngredient) {
      const ing = await this.prisma.feedIngredient.findUnique({
        where: { id: dto.addIngredientId },
        select: { id: true, category: true, isActive: true }
      });
      if (!ing?.isActive) {
        throw new BadRequestException("Intrant substitut introuvable");
      }
      addIngredient = {
        feedIngredientId: dto.addIngredientId,
        pricePerKg:
          dto.addPricePerKg != null && dto.addPricePerKg > 0
            ? dto.addPricePerKg
            : REFERENCE_PRICE_PER_KG[ing.category] ?? 300,
        maxAvailableKg:
          dto.addMaxAvailableKg != null && dto.addMaxAvailableKg > 0
            ? dto.addMaxAvailableKg
            : THEORETICAL_MAX_AVAILABLE_KG
      };
    } else if (dto.addPricePerKg != null && dto.addPricePerKg > 0) {
      addIngredient = {
        ...addIngredient,
        pricePerKg: dto.addPricePerKg,
        maxAvailableKg:
          dto.addMaxAvailableKg != null && dto.addMaxAvailableKg > 0
            ? dto.addMaxAvailableKg
            : addIngredient.maxAvailableKg
      };
    }

    // Garantit que l'intrant retiré est bien dans le pool (sinon le moteur ignore).
    const availableIngredients = [...avail.availableIngredients];
    if (
      !availableIngredients.some(
        (a) => a.feedIngredientId === dto.removeIngredientId
      )
    ) {
      // Autorise quand même le retrait d'une ligne de la ration courante.
      availableIngredients.push({
        feedIngredientId: dto.removeIngredientId,
        pricePerKg: 300,
        maxAvailableKg: THEORETICAL_MAX_AVAILABLE_KG
      });
    }

    const result = await this.formulation.recomputeWithSubstitution(
      {
        stage: row.stage,
        animalCount,
        avgWeightKg,
        avgAgeWeeks:
          params.avgAgeWeeks != null ? Number(params.avgAgeWeeks) : undefined,
        durationDays,
        availableIngredients
      },
      dto.removeIngredientId,
      addIngredient,
      userId
    );

    const deviation = await this.buildDeviationFromCurrent(row, result);
    return { result, deviation };
  }

  private async buildDeviationFromCurrent(
    row: SavedComposition,
    result: SubstitutionResult
  ): Promise<DeviationFromCurrent> {
    const profile = await this.profiles.getActiveByStage(row.stage);
    const energyCap = profile.maxMetabolizableEnergyKcal;
    const delta = result.nutritionDelta;
    const newEnergy = result.nutritionResult?.metabolizableEnergyKcal ?? null;
    const fatRiskAlert =
      energyCap != null &&
      newEnergy != null &&
      newEnergy > energyCap + 1e-4;

    if (delta) {
      return {
        ...delta,
        fatRiskAlert,
        energyCapKcal: energyCap
      };
    }

    // Fallback : comparer à la nutrition sauvegardée si le moteur n'a pas de delta.
    const current =
      row.nutritionResult && typeof row.nutritionResult === "object"
        ? (row.nutritionResult as Record<string, number>)
        : null;
    const next = result.nutritionResult;
    if (!current || !next) {
      return {
        crudeProteinPct: 0,
        metabolizableEnergyKcal: 0,
        lysinePct: 0,
        methioninePct: 0,
        calciumPct: 0,
        phosphorusPct: 0,
        crudeFiberPct: 0,
        energyChangePct: null,
        fatRiskAlert,
        energyCapKcal: energyCap
      };
    }
    const energyChangePct =
      Number(current.metabolizableEnergyKcal) > 0
        ? ((next.metabolizableEnergyKcal -
            Number(current.metabolizableEnergyKcal)) /
            Number(current.metabolizableEnergyKcal)) *
          100
        : null;
    return {
      crudeProteinPct:
        next.crudeProteinPct - Number(current.crudeProteinPct || 0),
      metabolizableEnergyKcal:
        next.metabolizableEnergyKcal -
        Number(current.metabolizableEnergyKcal || 0),
      lysinePct: next.lysinePct - Number(current.lysinePct || 0),
      methioninePct: next.methioninePct - Number(current.methioninePct || 0),
      calciumPct: next.calciumPct - Number(current.calciumPct || 0),
      phosphorusPct: next.phosphorusPct - Number(current.phosphorusPct || 0),
      crudeFiberPct: next.crudeFiberPct - Number(current.crudeFiberPct || 0),
      energyChangePct,
      fatRiskAlert,
      energyCapKcal: energyCap
    };
  }

  private async resolveProposal(
    compositionId: string,
    dto: ApplyCompositionAdjustmentDto
  ) {
    if (dto.proposalId) {
      const p = await this.prisma.compositionAdjustmentProposal.findFirst({
        where: { id: dto.proposalId, savedCompositionId: compositionId }
      });
      if (!p) throw new NotFoundException("Proposition introuvable");
      return p;
    }
    if (dto.messageId) {
      const byMsg = await this.prisma.compositionAdjustmentProposal.findFirst({
        where: {
          savedCompositionId: compositionId,
          chatMessageId: dto.messageId
        }
      });
      if (byMsg) return byMsg;

      // Legacy : carte chat sans ligne proposal (avant modèle).
      const msg = await this.prisma.chatMessage.findUnique({
        where: { id: dto.messageId },
        include: { room: true }
      });
      if (!msg || msg.room.savedCompositionId !== compositionId) {
        throw new NotFoundException("Version proposée introuvable");
      }
      const card = parseFeedCompositionCardBody(msg.body);
      if (!card || card.compositionId !== compositionId) {
        throw new BadRequestException(
          "Message invalide — pas une carte composition"
        );
      }
      if (!card.feasible) {
        throw new BadRequestException(
          "Cette version n'est pas faisable — ne peut pas être appliquée"
        );
      }
      // Matérialise une proposal éphémère pour unifier le flux apply.
      return this.prisma.compositionAdjustmentProposal.create({
        data: {
          savedCompositionId: compositionId,
          proposedByUserId: card.proposedByUserId,
          kind: "substitute_ingredient",
          payload: { legacyMessageId: dto.messageId } as Prisma.InputJsonValue,
          resultRation: card.ration as unknown as Prisma.InputJsonValue,
          nutritionResult: (card.nutritionResult ??
            null) as Prisma.InputJsonValue,
          deviationFromCurrent: (card.nutritionDelta ??
            null) as Prisma.InputJsonValue,
          status: "proposed",
          chatMessageId: dto.messageId
        }
      });
    }
    throw new BadRequestException("proposalId ou messageId requis");
  }

  private totalCostFromRation(ration: unknown): number {
    if (!Array.isArray(ration)) return 0;
    return ration.reduce(
      (s, l) => s + (Number((l as { costContribution?: number }).costContribution) || 0),
      0
    );
  }

  private async farmName(farmId: string): Promise<string | null> {
    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      select: { name: true }
    });
    return farm?.name ?? null;
  }

  private buildCardFromSaved(
    row: SavedComposition,
    meta: {
      variant: FeedCompositionCardPayload["variant"];
      proposedByUserId: string;
      note?: string | null;
      proposalId?: string | null;
      fatRiskAlert?: boolean;
    }
  ): FeedCompositionCardPayload {
    const ration = Array.isArray(row.ration)
      ? (row.ration as FeedCompositionCardPayload["ration"])
      : [];
    const nutritionResult =
      row.nutritionResult && typeof row.nutritionResult === "object"
        ? (row.nutritionResult as FeedCompositionCardPayload["nutritionResult"])
        : null;
    const totalCost = Number(row.totalCostXof);
    const totalFeedKg = ration.reduce(
      (s, l) => s + (Number(l.quantityKg) || 0),
      0
    );
    return {
      _type: "feed_composition_card",
      variant: meta.variant,
      compositionId: row.id,
      farmId: row.farmId,
      stage: row.stage,
      status: row.status,
      feasible: ration.length > 0,
      totalCostXof: totalCost,
      costPerKg: totalFeedKg > 0 ? totalCost / totalFeedKg : 0,
      totalFeedKg,
      dailyIntakeKg: 0,
      ration,
      nutritionResult,
      deviations: [],
      infeasibilityReasons: [],
      nutritionDelta: null,
      proposalId: meta.proposalId ?? null,
      fatRiskAlert: meta.fatRiskAlert ?? false,
      versionId: randomUUID(),
      proposedByUserId: meta.proposedByUserId,
      note: meta.note ?? null
    };
  }

  private buildCardFromFormulation(
    row: SavedComposition,
    result: FormulateResult | SubstitutionResult,
    meta: {
      variant: FeedCompositionCardPayload["variant"];
      proposedByUserId: string;
      note?: string | null;
      proposalId?: string | null;
      fatRiskAlert?: boolean;
    }
  ): FeedCompositionCardPayload {
    const delta =
      "nutritionDelta" in result ? result.nutritionDelta : null;
    return {
      _type: "feed_composition_card",
      variant: meta.variant,
      compositionId: row.id,
      farmId: row.farmId,
      stage: row.stage,
      status: row.status,
      feasible: result.feasible,
      totalCostXof: result.totalCostXof,
      costPerKg: result.costPerKg,
      totalFeedKg: result.totalFeedKg,
      dailyIntakeKg: result.dailyIntakeKg,
      ration: result.ration.map((l) => ({
        feedIngredientId: l.feedIngredientId,
        canonicalName: l.canonicalName,
        quantityKg: l.quantityKg,
        proportionPct: l.proportionPct,
        costContribution: l.costContribution
      })),
      nutritionResult: result.nutritionResult,
      deviations: result.deviations,
      infeasibilityReasons: result.infeasibilityReasons,
      nutritionDelta: delta,
      proposalId: meta.proposalId ?? null,
      fatRiskAlert: meta.fatRiskAlert ?? false,
      versionId: randomUUID(),
      proposedByUserId: meta.proposedByUserId,
      note: meta.note ?? null
    };
  }

  private toDto(row: SavedComposition) {
    return {
      id: row.id,
      farmId: row.farmId,
      createdByUserId: row.createdByUserId,
      stage: row.stage,
      inputParams: row.inputParams,
      ration: row.ration,
      nutritionResult: row.nutritionResult,
      explanation: row.explanation ?? null,
      totalCostXof: Number(row.totalCostXof),
      source: row.source,
      status: row.status,
      vetComment: row.vetComment,
      vetReviewedBy: row.vetReviewedBy,
      vetReviewedAt: row.vetReviewedAt?.toISOString() ?? null,
      millProfileId: row.millProfileId,
      isTheoretical: row.isTheoretical,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private async toDtoWithLinks(row: SavedComposition) {
    const base = this.toDto(row);
    const room = await this.prisma.chatRoom.findFirst({
      where: {
        kind: "feed_composition",
        savedCompositionId: row.id
      },
      select: {
        id: true,
        vetConsultationId: true
      },
      orderBy: { createdAt: "desc" }
    });

    let vetReviewedByName: string | null = null;
    if (row.vetReviewedBy) {
      const vet = await this.prisma.user.findUnique({
        where: { id: row.vetReviewedBy },
        select: { fullName: true }
      });
      vetReviewedByName = vet?.fullName ?? null;
    }

    return {
      ...base,
      chatRoomId: room?.id ?? null,
      vetConsultationId: room?.vetConsultationId ?? null,
      vetReviewedByName
    };
  }
}

function stageLabelFr(stage: ProductionStage): string {
  const map: Record<ProductionStage, string> = {
    piglet_weaning: "Sevrage",
    growing: "Croissance",
    fattening: "Engraissement",
    finishing: "Finition",
    gestating_sow: "Truie gestante",
    lactating_sow: "Truie allaitante"
  };
  return map[stage] ?? stage;
}
