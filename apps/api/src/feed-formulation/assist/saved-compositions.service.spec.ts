import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { MembershipRole, ProductionStage } from "@prisma/client";
import { SavedCompositionsService } from "./saved-compositions.service";
import type { FarmAccessService } from "../../common/farm-access.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { UserNotificationsService } from "../../user-notifications/user-notifications.service";

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
    farmMembership: { findMany: jest.Mock; findFirst: jest.Mock };
    farm: { findUnique: jest.Mock };
  };
  let farmAccess: jest.Mocked<Pick<FarmAccessService, "requireFarmAccess">>;
  let notifications: jest.Mocked<Pick<UserNotificationsService, "notify">>;
  let service: SavedCompositionsService;

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
      }
    };
    farmAccess = {
      requireFarmAccess: jest.fn().mockResolvedValue({ id: "farm-1" })
    };
    notifications = { notify: jest.fn().mockResolvedValue(undefined) };

    service = new SavedCompositionsService(
      prisma as unknown as PrismaService,
      farmAccess as unknown as FarmAccessService,
      notifications as unknown as UserNotificationsService
    );
  });

  it("enregistre une composition (draft)", async () => {
    prisma.savedComposition.create.mockResolvedValue({
      id: "comp-1",
      farmId: "farm-1",
      createdByUserId: "prod-1",
      stage: ProductionStage.growing,
      inputParams: { animalCount: 10 },
      ration: [{ feedIngredientId: "corn" }],
      nutritionResult: { crudeProteinPct: 16 },
      totalCostXof: 1000,
      source: "manual",
      status: "draft",
      vetComment: null,
      vetReviewedBy: null,
      vetReviewedAt: null,
      millProfileId: null,
      isTheoretical: true,
      createdAt: new Date("2026-07-31T00:00:00Z"),
      updatedAt: new Date("2026-07-31T00:00:00Z")
    });

    const saved = await service.save(user, {
      farmId: "farm-1",
      stage: ProductionStage.growing,
      source: "manual",
      inputParams: { animalCount: 10 },
      ration: [{ feedIngredientId: "corn" }],
      nutritionResult: { crudeProteinPct: 16 },
      totalCostXof: 1000,
      isTheoretical: true
    });

    expect(saved.id).toBe("comp-1");
    expect(saved.status).toBe("draft");
    expect(farmAccess.requireFarmAccess).toHaveBeenCalledWith(
      "prod-1",
      "farm-1"
    );
  });

  it("envoie en revue véto + notification", async () => {
    prisma.savedComposition.findUnique.mockResolvedValue({
      id: "comp-1",
      farmId: "farm-1",
      createdByUserId: "prod-1",
      stage: ProductionStage.finishing,
      status: "draft"
    });
    prisma.farmMembership.findMany.mockResolvedValue([{ userId: "vet-1" }]);
    prisma.savedComposition.update.mockResolvedValue({
      id: "comp-1",
      farmId: "farm-1",
      createdByUserId: "prod-1",
      stage: ProductionStage.finishing,
      inputParams: {},
      ration: [],
      nutritionResult: null,
      totalCostXof: 0,
      source: "ai_assisted",
      status: "vet_review",
      vetComment: null,
      vetReviewedBy: null,
      vetReviewedAt: null,
      millProfileId: null,
      isTheoretical: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const out = await service.requestVetReview(user, "comp-1", {});
    expect(out.status).toBe("vet_review");
    expect(notifications.notify).toHaveBeenCalledWith(
      "vet-1",
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        type: "feed_composition_vet_review",
        compositionId: "comp-1"
      })
    );
  });

  it("sans véto associé → BadRequest (option absente)", async () => {
    prisma.savedComposition.findUnique.mockResolvedValue({
      id: "comp-1",
      farmId: "farm-1",
      createdByUserId: "prod-1",
      stage: ProductionStage.growing,
      status: "draft"
    });
    prisma.farmMembership.findMany.mockResolvedValue([]);
    await expect(
      service.requestVetReview(user, "comp-1", {})
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("véto approuve → validated + notif producteur", async () => {
    prisma.savedComposition.findUnique.mockResolvedValue({
      id: "comp-1",
      farmId: "farm-1",
      createdByUserId: "prod-1",
      stage: ProductionStage.growing,
      status: "vet_review"
    });
    prisma.farmMembership.findFirst.mockResolvedValue({
      userId: "vet-1",
      role: MembershipRole.veterinarian
    });
    prisma.savedComposition.update.mockResolvedValue({
      id: "comp-1",
      farmId: "farm-1",
      createdByUserId: "prod-1",
      stage: ProductionStage.growing,
      inputParams: {},
      ration: [],
      nutritionResult: null,
      totalCostXof: 0,
      source: "manual",
      status: "validated",
      vetComment: "OK",
      vetReviewedBy: "vet-1",
      vetReviewedAt: new Date(),
      millProfileId: null,
      isTheoretical: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const out = await service.vetReview(vetUser, "comp-1", {
      decision: "approve",
      comment: "OK"
    });
    expect(out.status).toBe("validated");
    expect(notifications.notify).toHaveBeenCalledWith(
      "prod-1",
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ type: "feed_composition_vet_reviewed" })
    );
  });

  it("non-véto ne peut pas valider", async () => {
    prisma.savedComposition.findUnique.mockResolvedValue({
      id: "comp-1",
      farmId: "farm-1",
      createdByUserId: "prod-1",
      status: "vet_review"
    });
    prisma.farmMembership.findFirst.mockResolvedValue(null);
    await expect(
      service.vetReview(user, "comp-1", { decision: "approve" })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
