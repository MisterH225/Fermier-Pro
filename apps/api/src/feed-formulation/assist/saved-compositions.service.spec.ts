import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { MembershipRole, ProductionStage } from "@prisma/client";
import { SavedCompositionsService } from "./saved-compositions.service";
import type { FarmAccessService } from "../../common/farm-access.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { UserNotificationsService } from "../../user-notifications/user-notifications.service";
import type { ChatService } from "../../chat/chat.service";
import type { FeedFormulationService } from "../feed-formulation.service";
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
      findFirst?: jest.Mock;
    };
    farmMembership: { findMany: jest.Mock; findFirst: jest.Mock };
    farm: { findUnique: jest.Mock };
    vetConsultation: { create: jest.Mock; update: jest.Mock };
    chatRoom: { findFirst: jest.Mock; findUnique: jest.Mock };
    chatMessage: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
    feedIngredient: { findUnique: jest.Mock };
  };
  let farmAccess: jest.Mocked<Pick<FarmAccessService, "requireFarmAccess">>;
  let notifications: jest.Mocked<Pick<UserNotificationsService, "notify">>;
  let chat: jest.Mocked<
    Pick<
      ChatService,
      | "ensureCompositionReviewRoom"
      | "postCompositionCardMessage"
      | "findCompositionRoomId"
    >
  >;
  let formulation: jest.Mocked<
    Pick<FeedFormulationService, "recomputeWithSubstitution">
  >;
  let availability: jest.Mocked<
    Pick<IngredientAvailabilityService, "resolve">
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
    nutritionResult: { crudeProteinPct: 16 },
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

  beforeEach(() => {
    prisma = {
      savedComposition: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn()
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
      feedIngredient: { findUnique: jest.fn() }
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
      findCompositionRoomId: jest.fn().mockResolvedValue("room-1")
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

    service = new SavedCompositionsService(
      prisma as unknown as PrismaService,
      farmAccess as unknown as FarmAccessService,
      notifications as unknown as UserNotificationsService,
      chat as unknown as ChatService,
      formulation as unknown as FeedFormulationService,
      availability as unknown as IngredientAvailabilityService
    );
  });

  it("enregistre une composition (draft)", async () => {
    prisma.savedComposition.create.mockResolvedValue(baseRow);
    const saved = await service.save(user, {
      farmId: "farm-1",
      stage: ProductionStage.finishing,
      source: "manual",
      inputParams: { animalCount: 10 },
      ration: baseRow.ration,
      nutritionResult: { crudeProteinPct: 16 },
      totalCostXof: 20000,
      isTheoretical: true
    });
    expect(saved.id).toBe("comp-1");
    expect(saved.status).toBe("draft");
  });

  it("envoie en revue → consultation + salon + membres + notif", async () => {
    prisma.savedComposition.findUnique.mockResolvedValue(baseRow);
    prisma.farmMembership.findMany.mockResolvedValue([{ userId: "vet-1" }]);
    prisma.savedComposition.update.mockResolvedValue({
      ...baseRow,
      status: "vet_review"
    });

    const out = await service.requestVetReview(user, "comp-1", {});
    expect(out.status).toBe("vet_review");
    expect(out.chatRoomId).toBe("room-1");
    expect(prisma.vetConsultation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          primaryVetUserId: "vet-1",
          openedByUserId: "prod-1",
          status: "open"
        })
      })
    );
    expect(chat.ensureCompositionReviewRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        producerUserId: "prod-1",
        veterinarianUserId: "vet-1",
        compositionId: "comp-1"
      })
    );
    expect(chat.postCompositionCardMessage).toHaveBeenCalled();
    expect(notifications.notify).toHaveBeenCalledWith(
      "vet-1",
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        type: "feed_composition_vet_review",
        roomId: "room-1"
      })
    );
  });

  it("sans véto associé → BadRequest", async () => {
    prisma.savedComposition.findUnique.mockResolvedValue(baseRow);
    prisma.farmMembership.findMany.mockResolvedValue([]);
    await expect(
      service.requestVetReview(user, "comp-1", {})
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("déjà en revue → BadRequest (pas de double envoi)", async () => {
    prisma.savedComposition.findUnique.mockResolvedValue({
      ...baseRow,
      status: "vet_review"
    });
    await expect(
      service.requestVetReview(user, "comp-1", {})
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.vetConsultation.create).not.toHaveBeenCalled();
  });

  it("après retour en draft → peut re-soumettre", async () => {
    prisma.savedComposition.findUnique.mockResolvedValue({
      ...baseRow,
      status: "draft"
    });
    prisma.farmMembership.findMany.mockResolvedValue([{ userId: "vet-1" }]);
    prisma.savedComposition.update.mockResolvedValue({
      ...baseRow,
      status: "vet_review"
    });

    const out = await service.requestVetReview(user, "comp-1", {});
    expect(out.status).toBe("vet_review");
    expect(prisma.vetConsultation.create).toHaveBeenCalled();
  });

  it("véto non associé → Forbidden sur validation", async () => {
    prisma.savedComposition.findUnique.mockResolvedValue({
      ...baseRow,
      status: "vet_review"
    });
    prisma.farmMembership.findFirst.mockResolvedValue(null);
    await expect(
      service.vetReview(user, "comp-1", { decision: "approve" })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("validation → validated + ferme consultation (resolved)", async () => {
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
      decision: "approve",
      comment: "OK"
    });
    expect(out.status).toBe("validated");
    expect(prisma.vetConsultation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "resolved" })
      })
    );
    expect(notifications.notify).toHaveBeenCalledWith(
      "prod-1",
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ type: "feed_composition_validated" })
    );
  });

  it("demande d'ajustements → reste vet_review, consultation ouverte", async () => {
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

  it("ajustement véto passe par le moteur", async () => {
    prisma.savedComposition.findUnique.mockResolvedValue({
      ...baseRow,
      status: "vet_review"
    });
    prisma.farmMembership.findFirst.mockResolvedValue({
      userId: "vet-1",
      role: MembershipRole.veterinarian
    });
    formulation.recomputeWithSubstitution.mockResolvedValue({
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
      nutritionResult: null,
      deviations: [],
      warnings: [],
      infeasibilityReasons: [],
      nutritionDelta: {
        crudeProteinPct: 1,
        metabolizableEnergyKcal: -50,
        lysinePct: 0,
        methioninePct: 0,
        calciumPct: 0.1,
        phosphorusPct: 0,
        crudeFiberPct: 0,
        energyChangePct: -1.5
      },
      baseFeasible: true
    });

    const out = await service.proposeAdjustment(vetUser, "comp-1", {
      removeIngredientId: "corn",
      addIngredientId: "soy",
      comment: "Plus de soja"
    });
    expect(formulation.recomputeWithSubstitution).toHaveBeenCalled();
    expect(chat.postCompositionCardMessage).toHaveBeenCalled();
    expect(out.messageId).toBe("msg-1");
    expect(notifications.notify).toHaveBeenCalledWith(
      "prod-1",
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ type: "feed_composition_adjustment" })
    );
  });

  it("producteur applique une version ajustée", async () => {
    prisma.savedComposition.findUnique.mockResolvedValue({
      ...baseRow,
      status: "vet_review"
    });
    const card = {
      _type: "feed_composition_card",
      variant: "adjustment",
      compositionId: "comp-1",
      farmId: "farm-1",
      stage: "finishing",
      status: "vet_review",
      feasible: true,
      totalCostXof: 24000,
      costPerKg: 240,
      totalFeedKg: 100,
      dailyIntakeKg: 1.5,
      ration: [
        {
          feedIngredientId: "soy",
          quantityKg: 60,
          proportionPct: 60,
          costContribution: 24000
        }
      ],
      nutritionResult: null,
      deviations: [],
      infeasibilityReasons: [],
      nutritionDelta: null,
      versionId: "v2",
      proposedByUserId: "vet-1"
    };
    prisma.chatMessage.findUnique.mockResolvedValue({
      id: "msg-1",
      roomId: "room-1",
      body: JSON.stringify(card),
      room: { savedCompositionId: "comp-1" }
    });
    prisma.savedComposition.update.mockResolvedValue({
      ...baseRow,
      status: "vet_review",
      ration: card.ration,
      totalCostXof: 24000
    });

    const out = await service.applyAdjustment(user, "comp-1", {
      messageId: "msg-1"
    });
    expect(out.totalCostXof).toBe(24000);
    expect(notifications.notify).toHaveBeenCalledWith(
      "vet-1",
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ type: "feed_composition_vet_review" })
    );
  });
});
