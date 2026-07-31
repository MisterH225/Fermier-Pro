import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { MembershipRole, ProductionStage } from "@prisma/client";
import { SavedCompositionsService } from "./saved-compositions.service";
import type { FarmAccessService } from "../../common/farm-access.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { UserNotificationsService } from "../../user-notifications/user-notifications.service";
import type { ChatService } from "../../chat/chat.service";
import type { FeedFormulationService } from "../feed-formulation.service";
import type { FeedRequirementProfilesService } from "../feed-requirement-profiles.service";
import type { IngredientAvailabilityService } from "./ingredient-availability.service";

describe("SavedCompositionsService", () => {
  const user = { id: "prod-1" } as never;
  const vetUser = { id: "vet-1" } as never;

  let prisma: {
    savedComposition: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    compositionAdjustmentProposal: {
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    farmMembership: { findMany: jest.Mock; findFirst: jest.Mock };
    farm: { findUnique: jest.Mock };
    vetConsultation: { create: jest.Mock; update: jest.Mock };
    chatRoom: { findFirst: jest.Mock; findUnique: jest.Mock };
    chatMessage: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
    feedIngredient: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let farmAccess: jest.Mocked<Pick<FarmAccessService, "requireFarmAccess">>;
  let notifications: jest.Mocked<Pick<UserNotificationsService, "notify">>;
  let chat: jest.Mocked<
    Pick<
      ChatService,
      | "ensureCompositionReviewRoom"
      | "postCompositionCardMessage"
      | "findCompositionRoomId"
      | "createMessage"
    >
  >;
  let formulation: jest.Mocked<
    Pick<FeedFormulationService, "recomputeWithSubstitution">
  >;
  let availability: jest.Mocked<
    Pick<IngredientAvailabilityService, "resolve">
  >;
  let profiles: jest.Mocked<
    Pick<FeedRequirementProfilesService, "getActiveByStage">
  >;
  let service: SavedCompositionsService;

  const baseRow = {
    id: "comp-1",
    farmId: "farm-1",
    createdByUserId: "prod-1",
    stage: ProductionStage.finishing,
    inputParams: {
      animalCount: 10,
      avgWeightKg: 80,
      durationDays: 30
    },
    ration: [
      {
        feedIngredientId: "corn",
        canonicalName: "Maïs",
        quantityKg: 70,
        proportionPct: 70,
        costContribution: 14000
      }
    ],
    nutritionResult: {
      crudeProteinPct: 16,
      metabolizableEnergyKcal: 3100,
      lysinePct: 0.9,
      methioninePct: 0.3,
      calciumPct: 0.8,
      phosphorusPct: 0.6,
      crudeFiberPct: 4
    },
    totalCostXof: 20000,
    source: "manual" as const,
    status: "draft" as const,
    vetComment: null,
    vetReviewedBy: null,
    vetReviewedAt: null,
    millProfileId: null,
    isTheoretical: true,
    createdAt: new Date("2026-07-31T00:00:00Z"),
    updatedAt: new Date("2026-07-31T00:00:00Z")
  };

  const feasibleSub = {
    feasible: true,
    ration: [
      {
        feedIngredientId: "soy",
        canonicalName: "Soja",
        quantityKg: 60,
        proportionPct: 60,
        costContribution: 24000
      }
    ],
    totalFeedKg: 100,
    dailyIntakeKg: 1.5,
    totalCostXof: 24000,
    costPerKg: 240,
    nutritionResult: {
      crudeProteinPct: 17,
      metabolizableEnergyKcal: 3050,
      lysinePct: 0.95,
      methioninePct: 0.3,
      calciumPct: 0.9,
      phosphorusPct: 0.6,
      crudeFiberPct: 4,
      lysinePerMcal: 3.1
    },
    deviations: [],
    warnings: [],
    infeasibilityReasons: [],
    nutritionDelta: {
      crudeProteinPct: 1,
      metabolizableEnergyKcal: -50,
      lysinePct: 0.05,
      methioninePct: 0,
      calciumPct: 0.1,
      phosphorusPct: 0,
      crudeFiberPct: 0,
      energyChangePct: -1.5
    },
    baseFeasible: true
  };

  beforeEach(() => {
    prisma = {
      savedComposition: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn()
      },
      compositionAdjustmentProposal: {
        create: jest.fn().mockResolvedValue({
          id: "prop-1",
          savedCompositionId: "comp-1",
          proposedByUserId: "vet-1",
          status: "proposed",
          resultRation: feasibleSub.ration,
          nutritionResult: feasibleSub.nutritionResult,
          chatMessageId: null
        }),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      farmMembership: {
        findMany: jest.fn(),
        findFirst: jest.fn()
      },
      farm: {
        findUnique: jest.fn().mockResolvedValue({ name: "Ferme A" })
      },
      vetConsultation: {
        create: jest.fn().mockResolvedValue({
          id: "consult-1",
          farmId: "farm-1",
          status: "open"
        }),
        update: jest.fn()
      },
      chatRoom: {
        findFirst: jest.fn().mockResolvedValue({
          id: "room-1",
          vetConsultationId: "consult-1"
        }),
        findUnique: jest.fn().mockResolvedValue({
          vetConsultationId: "consult-1",
          members: [{ userId: "prod-1" }, { userId: "vet-1" }]
        })
      },
      chatMessage: { findUnique: jest.fn() },
      user: {
        findUnique: jest.fn().mockResolvedValue({ fullName: "Dr Vet" })
      },
      feedIngredient: { findUnique: jest.fn() },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          savedComposition: prisma.savedComposition,
          compositionAdjustmentProposal: prisma.compositionAdjustmentProposal
        })
      )
    };
    farmAccess = {
      requireFarmAccess: jest.fn().mockResolvedValue({ id: "farm-1" })
    };
    notifications = { notify: jest.fn().mockResolvedValue(undefined) };
    chat = {
      ensureCompositionReviewRoom: jest
        .fn()
        .mockResolvedValue({ id: "room-1" }),
      postCompositionCardMessage: jest.fn().mockResolvedValue({
        id: "msg-1",
        body: "{}"
      }),
      findCompositionRoomId: jest.fn().mockResolvedValue("room-1"),
      createMessage: jest.fn().mockResolvedValue({ id: "msg-reject" })
    };
    formulation = {
      recomputeWithSubstitution: jest.fn()
    };
    availability = {
      resolve: jest.fn().mockResolvedValue({
        availableIngredients: [
          { feedIngredientId: "corn", pricePerKg: 200, maxAvailableKg: 1000 },
          { feedIngredientId: "soy", pricePerKg: 400, maxAvailableKg: 500 }
        ],
        isTheoretical: true,
        millProfileId: null
      })
    };
    profiles = {
      getActiveByStage: jest.fn().mockResolvedValue({
        stage: "finishing",
        maxMetabolizableEnergyKcal: 3200,
        minMetabolizableEnergyKcal: 3000
      })
    };

    service = new SavedCompositionsService(
      prisma as unknown as PrismaService,
      farmAccess as unknown as FarmAccessService,
      notifications as unknown as UserNotificationsService,
      chat as unknown as ChatService,
      formulation as unknown as FeedFormulationService,
      availability as unknown as IngredientAvailabilityService,
      profiles as unknown as FeedRequirementProfilesService
    );
  });

  it("enregistre une composition (draft)", async () => {
    prisma.savedComposition.create.mockResolvedValue(baseRow);
    const saved = await service.save(user, {
      farmId: "farm-1",
      stage: ProductionStage.finishing,
      inputParams: baseRow.inputParams,
      ration: baseRow.ration,
      totalCostXof: 20000,
      source: "manual"
    });
    expect(saved.status).toBe("draft");
    expect(farmAccess.requireFarmAccess).toHaveBeenCalledWith(
      "prod-1",
      "farm-1"
    );
  });

  it("refuse un véto non associé", async () => {
    prisma.savedComposition.findUnique.mockResolvedValue({
      ...baseRow,
      status: "vet_review"
    });
    prisma.farmMembership.findFirst.mockResolvedValue(null);
    await expect(
      service.vetReview(vetUser, "comp-1", { decision: "approve" })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("approbation véto → validated + ferme consultation", async () => {
    prisma.savedComposition.findUnique.mockResolvedValue({
      ...baseRow,
      status: "vet_review"
    });
    prisma.farmMembership.findFirst.mockResolvedValue({
      userId: "vet-1",
      role: MembershipRole.veterinarian
    });
    prisma.savedComposition.update.mockResolvedValue({
      ...baseRow,
      status: "validated",
      vetReviewedBy: "vet-1",
      vetReviewedAt: new Date()
    });

    const out = await service.vetReview(vetUser, "comp-1", {
      decision: "approve"
    });
    expect(out.status).toBe("validated");
    expect(prisma.vetConsultation.update).toHaveBeenCalled();
  });

  it("demande d'ajustements texte → reste vet_review", async () => {
    prisma.savedComposition.findUnique.mockResolvedValue({
      ...baseRow,
      status: "vet_review"
    });
    prisma.farmMembership.findFirst.mockResolvedValue({
      userId: "vet-1",
      role: MembershipRole.veterinarian
    });
    prisma.savedComposition.update.mockResolvedValue({
      ...baseRow,
      status: "vet_review",
      vetComment: "Baisse le tourteau"
    });

    const out = await service.vetReview(vetUser, "comp-1", {
      decision: "request_changes",
      comment: "Baisse le tourteau"
    });
    expect(out.status).toBe("vet_review");
    expect(prisma.vetConsultation.update).not.toHaveBeenCalled();
  });

  it("ajustement véto passe par le moteur (jamais de quantités manuelles)", async () => {
    prisma.savedComposition.findUnique.mockResolvedValue({
      ...baseRow,
      status: "vet_review"
    });
    prisma.farmMembership.findFirst.mockResolvedValue({
      userId: "vet-1",
      role: MembershipRole.veterinarian
    });
    formulation.recomputeWithSubstitution.mockResolvedValue(feasibleSub);

    const out = await service.proposeAdjustment(vetUser, "comp-1", {
      removeIngredientId: "corn",
      addIngredientId: "soy",
      comment: "Plus de soja"
    });
    expect(formulation.recomputeWithSubstitution).toHaveBeenCalledWith(
      expect.objectContaining({ stage: ProductionStage.finishing }),
      "corn",
      expect.objectContaining({ feedIngredientId: "soy" }),
      "vet-1"
    );
    expect(prisma.compositionAdjustmentProposal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "substitute_ingredient",
          status: "proposed",
          payload: expect.objectContaining({
            removeIngredientId: "corn",
            addIngredientId: "soy"
          })
        })
      })
    );
    expect(chat.postCompositionCardMessage).toHaveBeenCalled();
    expect(out.proposalId).toBe("prop-1");
    expect(out.deviationFromCurrent.fatRiskAlert).toBe(false);
    expect(out.deviationFromCurrent.metabolizableEnergyKcal).toBe(-50);
    expect(notifications.notify).toHaveBeenCalledWith(
      "prod-1",
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ type: "feed_composition_adjustment" })
    );
  });

  it("ajustement infaisable → pas de proposition bancale", async () => {
    prisma.savedComposition.findUnique.mockResolvedValue({
      ...baseRow,
      status: "vet_review"
    });
    prisma.farmMembership.findFirst.mockResolvedValue({
      userId: "vet-1",
      role: MembershipRole.veterinarian
    });
    formulation.recomputeWithSubstitution.mockResolvedValue({
      ...feasibleSub,
      feasible: false,
      ration: [],
      nutritionResult: null,
      nutritionDelta: null,
      infeasibilityReasons: ["protéines insuffisantes"]
    });

    await expect(
      service.proposeAdjustment(vetUser, "comp-1", {
        removeIngredientId: "soy",
        addIngredientId: "corn"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.compositionAdjustmentProposal.create).not.toHaveBeenCalled();
    expect(chat.postCompositionCardMessage).not.toHaveBeenCalled();
  });

  it("alerte risque de gras si énergie > plafond du stade", async () => {
    prisma.savedComposition.findUnique.mockResolvedValue({
      ...baseRow,
      status: "vet_review"
    });
    prisma.farmMembership.findFirst.mockResolvedValue({
      userId: "vet-1",
      role: MembershipRole.veterinarian
    });
    profiles.getActiveByStage.mockResolvedValue({
      stage: "finishing",
      maxMetabolizableEnergyKcal: 3200,
      minMetabolizableEnergyKcal: 3000
    } as never);
    formulation.recomputeWithSubstitution.mockResolvedValue({
      ...feasibleSub,
      nutritionResult: {
        ...feasibleSub.nutritionResult!,
        metabolizableEnergyKcal: 3300
      },
      nutritionDelta: {
        ...feasibleSub.nutritionDelta!,
        metabolizableEnergyKcal: 200,
        energyChangePct: 6.5
      }
    });

    const out = await service.proposeAdjustment(vetUser, "comp-1", {
      removeIngredientId: "corn",
      addIngredientId: "soy"
    });
    expect(out.fatRiskAlert).toBe(true);
    expect(out.deviationFromCurrent.fatRiskAlert).toBe(true);
    expect(out.deviationFromCurrent.energyCapKcal).toBe(3200);
  });

  it("preview ne persiste pas de proposition", async () => {
    prisma.savedComposition.findUnique.mockResolvedValue({
      ...baseRow,
      status: "vet_review"
    });
    prisma.farmMembership.findFirst.mockResolvedValue({
      userId: "vet-1",
      role: MembershipRole.veterinarian
    });
    formulation.recomputeWithSubstitution.mockResolvedValue(feasibleSub);

    const out = await service.previewVetAdjustment(vetUser, "comp-1", {
      removeIngredientId: "corn",
      addIngredientId: "soy"
    });
    expect(out.feasible).toBe(true);
    expect(prisma.compositionAdjustmentProposal.create).not.toHaveBeenCalled();
    expect(chat.postCompositionCardMessage).not.toHaveBeenCalled();
  });

  it("producteur applique → ration remplacée, vet_review, autres superseded", async () => {
    prisma.savedComposition.findUnique.mockResolvedValue({
      ...baseRow,
      status: "vet_review"
    });
    prisma.compositionAdjustmentProposal.findFirst.mockResolvedValue({
      id: "prop-1",
      savedCompositionId: "comp-1",
      proposedByUserId: "vet-1",
      status: "proposed",
      resultRation: feasibleSub.ration,
      nutritionResult: feasibleSub.nutritionResult,
      chatMessageId: "msg-1"
    });
    prisma.savedComposition.update.mockResolvedValue({
      ...baseRow,
      status: "vet_review",
      ration: feasibleSub.ration,
      totalCostXof: 24000
    });

    const out = await service.applyAdjustment(user, "comp-1", {
      proposalId: "prop-1"
    });
    expect(out.status).toBe("vet_review");
    expect(out.totalCostXof).toBe(24000);
    expect(prisma.compositionAdjustmentProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prop-1" },
        data: expect.objectContaining({ status: "applied" })
      })
    );
    expect(prisma.compositionAdjustmentProposal.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "proposed" }),
        data: { status: "superseded" }
      })
    );
    expect(notifications.notify).toHaveBeenCalledWith(
      "vet-1",
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ type: "feed_composition_vet_review" })
    );
  });

  it("producteur refuse une proposition", async () => {
    prisma.savedComposition.findUnique.mockResolvedValue({
      ...baseRow,
      status: "vet_review"
    });
    prisma.compositionAdjustmentProposal.findFirst.mockResolvedValue({
      id: "prop-1",
      savedCompositionId: "comp-1",
      proposedByUserId: "vet-1",
      status: "proposed"
    });

    const out = await service.rejectAdjustment(user, "comp-1", "prop-1", {
      comment: "On garde le maïs"
    });
    expect(out.status).toBe("rejected");
    expect(prisma.compositionAdjustmentProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "rejected" }
      })
    );
    expect(chat.createMessage).toHaveBeenCalled();
    expect(notifications.notify).toHaveBeenCalledWith(
      "vet-1",
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        type: "feed_composition_adjustment_rejected"
      })
    );
  });

  it("véto non associé ne peut pas proposer d'ajustement", async () => {
    prisma.savedComposition.findUnique.mockResolvedValue({
      ...baseRow,
      status: "vet_review"
    });
    prisma.farmMembership.findFirst.mockResolvedValue(null);
    await expect(
      service.proposeAdjustment(vetUser, "comp-1", {
        removeIngredientId: "corn",
        addIngredientId: "soy"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(formulation.recomputeWithSubstitution).not.toHaveBeenCalled();
  });
});
