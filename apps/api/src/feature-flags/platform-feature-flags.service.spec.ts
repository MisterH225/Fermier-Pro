import { FeatureFlagHistoryAction } from "@prisma/client";
import { PlatformFeatureFlagsService } from "./platform-feature-flags.service";
import type { PlatformModuleId } from "./platform-modules.constants";
import { PLATFORM_MODULE_IDS } from "./platform-modules.constants";

type FlagRow = {
  moduleId: string;
  moduleName: string;
  icon: string | null;
  canDisable: boolean;
  isActive: boolean;
  disabledAt: Date | null;
  disabledById: string | null;
  disableReason: string | null;
  reactivatedAt: Date | null;
  reactivatedById: string | null;
  scheduledReactivation: Date | null;
  userMessageFr: string | null;
  userMessageEn: string | null;
  updatedAt: Date;
};

function flag(
  moduleId: PlatformModuleId,
  isActive: boolean,
  overrides: Partial<FlagRow> = {}
): FlagRow {
  return {
    moduleId,
    moduleName: moduleId,
    icon: null,
    canDisable: moduleId !== "core_producer",
    isActive,
    disabledAt: null,
    disabledById: null,
    disableReason: null,
    reactivatedAt: null,
    reactivatedById: null,
    scheduledReactivation: null,
    userMessageFr: null,
    userMessageEn: null,
    updatedAt: new Date(),
    ...overrides
  };
}

function allModulesActiveExcept(
  off: PlatformModuleId[] = []
): FlagRow[] {
  const offSet = new Set(off);
  return PLATFORM_MODULE_IDS.map((id) =>
    flag(id, id === "core_producer" ? true : !offSet.has(id))
  );
}

describe("PlatformFeatureFlagsService — résolution + allow-list", () => {
  const historyCreate = jest.fn();
  const testAccountFindUnique = jest.fn();
  const testAccountCreate = jest.fn();
  const testAccountDelete = jest.fn();
  const testAccountFindMany = jest.fn();
  const testAccountGroupBy = jest.fn();
  const userFindFirst = jest.fn();
  const platformFindMany = jest.fn();
  const platformFindUnique = jest.fn();
  const platformCreateMany = jest.fn();

  const prisma = {
    platformFeatureFlag: {
      findMany: platformFindMany,
      findUnique: platformFindUnique,
      createMany: platformCreateMany,
      update: jest.fn()
    },
    featureFlagHistory: {
      create: historyCreate,
      findMany: jest.fn()
    },
    featureFlagTestAccount: {
      findUnique: testAccountFindUnique,
      create: testAccountCreate,
      delete: testAccountDelete,
      findMany: testAccountFindMany,
      groupBy: testAccountGroupBy
    },
    user: { findFirst: userFindFirst },
    reactivationWaitlist: { upsert: jest.fn() }
  };

  const archive = {
    previewArchive: jest.fn().mockResolvedValue([]),
    archiveModuleData: jest.fn().mockResolvedValue({}),
    restoreModuleData: jest.fn().mockResolvedValue({})
  };

  let service: PlatformFeatureFlagsService;

  beforeEach(() => {
    jest.clearAllMocks();
    testAccountGroupBy.mockResolvedValue([]);
    platformCreateMany.mockResolvedValue({ count: 0 });
    service = new PlatformFeatureFlagsService(
      prisma as never,
      archive as never
    );
  });

  function stubRows(rows: FlagRow[]) {
    platformFindMany.mockResolvedValue(rows);
    platformFindUnique.mockImplementation(
      ({ where }: { where: { moduleId: string } }) =>
        Promise.resolve(rows.find((r) => r.moduleId === where.moduleId) ?? null)
    );
  }

  it("les 3 nouveaux modules sont déclarés et OFF global par défaut au bootstrap", async () => {
    platformFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(
        PLATFORM_MODULE_IDS.map((id) =>
          flag(
            id,
            !["mills", "feed_composition", "delivery"].includes(id)
          )
        )
      );

    const rows = await service.listPublicModules();
    expect(platformCreateMany).toHaveBeenCalled();
    const seed = platformCreateMany.mock.calls[0][0].data as Array<{
      moduleId: string;
      isActive: boolean;
      moduleName: string;
    }>;
    for (const id of ["mills", "feed_composition", "delivery"]) {
      const row = seed.find((r) => r.moduleId === id);
      expect(row?.isActive).toBe(false);
      expect(row?.moduleName).toBeTruthy();
    }
    expect(rows.find((r) => r.moduleId === "mills")?.isActive).toBe(false);
  });

  it("compte de test voit un module OFF global ; compte non listé ne le voit pas", async () => {
    stubRows(
      allModulesActiveExcept(["mills", "feed_composition", "delivery"])
    );
    // marketplace actif → prérequis mills OK une fois allow-list mills
    testAccountFindUnique.mockImplementation(
      ({
        where
      }: {
        where: { moduleId_userId: { moduleId: string; userId: string } };
      }) => {
        const { moduleId, userId } = where.moduleId_userId;
        if (userId === "tester" && moduleId === "mills") {
          return Promise.resolve({ id: "ta1" });
        }
        return Promise.resolve(null);
      }
    );

    await expect(
      service.isModuleActiveForUser("mills", "tester")
    ).resolves.toBe(true);
    await expect(
      service.isModuleActiveForUser("mills", "other")
    ).resolves.toBe(false);
    await expect(service.isModuleActive("mills")).resolves.toBe(false);
  });

  it("prérequis respectés même via allow-list (feed_composition sans mills)", async () => {
    stubRows(
      allModulesActiveExcept(["mills", "feed_composition", "delivery"])
    );
    testAccountFindUnique.mockImplementation(
      ({
        where
      }: {
        where: { moduleId_userId: { moduleId: string; userId: string } };
      }) => {
        const { moduleId, userId } = where.moduleId_userId;
        if (userId === "tester" && moduleId === "feed_composition") {
          return Promise.resolve({ id: "ta-fc" });
        }
        return Promise.resolve(null);
      }
    );

    await expect(
      service.isModuleActiveForUser("feed_composition", "tester")
    ).resolves.toBe(false);
  });

  it("allow-list feed_composition OK si marketplace+mills actifs pour le user", async () => {
    stubRows(
      allModulesActiveExcept(["mills", "feed_composition", "delivery"])
    );
    // marketplace reste actif globalement ; mills + feed_composition via allow-list
    testAccountFindUnique.mockImplementation(
      ({
        where
      }: {
        where: { moduleId_userId: { moduleId: string; userId: string } };
      }) => {
        const { moduleId, userId } = where.moduleId_userId;
        if (
          userId === "tester" &&
          (moduleId === "mills" || moduleId === "feed_composition")
        ) {
          return Promise.resolve({ id: `ta-${moduleId}` });
        }
        return Promise.resolve(null);
      }
    );

    await expect(
      service.isModuleActiveForUser("feed_composition", "tester")
    ).resolves.toBe(true);
    await expect(
      service.isModuleActiveForUser("feed_composition", "stranger")
    ).resolves.toBe(false);
  });

  it("n'altère pas la résolution globale des modules historiques actifs", async () => {
    stubRows(allModulesActiveExcept(["mills", "feed_composition", "delivery"]));
    await expect(service.isModuleActive("marketplace")).resolves.toBe(true);
    await expect(
      service.isModuleActiveForUser("marketplace", "anyone")
    ).resolves.toBe(true);
    await expect(service.isModuleActive("buyer")).resolves.toBe(true);
  });

  it("écrit l'historique à l'ajout / retrait d'un compte de test", async () => {
    stubRows(
      allModulesActiveExcept(["mills", "feed_composition", "delivery"])
    );
    userFindFirst.mockResolvedValue({
      id: "tester",
      email: "tester@example.com",
      phone: null
    });
    testAccountFindUnique.mockResolvedValue(null);
    testAccountCreate.mockResolvedValue({
      id: "ta1",
      moduleId: "mills",
      userId: "tester",
      addedBy: "admin",
      createdAt: new Date("2026-07-30T00:00:00.000Z"),
      user: { email: "tester@example.com", phone: null }
    });

    await service.addTestAccount("mills", "tester@example.com", "admin");
    expect(userFindFirst).toHaveBeenCalledWith({
      where: { email: "tester@example.com" },
      select: { id: true, email: true, phone: true }
    });
    expect(historyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        moduleId: "mills",
        action: FeatureFlagHistoryAction.test_account_added,
        performedById: "admin",
        affectedDataSummary: expect.objectContaining({
          userId: "tester",
          email: "tester@example.com"
        })
      })
    });

    testAccountFindUnique.mockResolvedValue({
      id: "ta1",
      moduleId: "mills",
      userId: "tester",
      user: { email: "tester@example.com", phone: null }
    });
    testAccountDelete.mockResolvedValue({});
    await service.removeTestAccount("mills", "tester", "admin");
    expect(historyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        moduleId: "mills",
        action: FeatureFlagHistoryAction.test_account_removed,
        performedById: "admin",
        affectedDataSummary: expect.objectContaining({
          userId: "tester",
          email: "tester@example.com"
        })
      })
    });
  });

  it("résout un compte de test par numéro de téléphone", async () => {
    stubRows(
      allModulesActiveExcept(["mills", "feed_composition", "delivery"])
    );
    userFindFirst.mockResolvedValue({
      id: "u-phone",
      email: null,
      phone: "+2250708123456"
    });
    testAccountFindUnique.mockResolvedValue(null);
    testAccountCreate.mockResolvedValue({
      id: "ta2",
      moduleId: "delivery",
      userId: "u-phone",
      addedBy: "admin",
      createdAt: new Date("2026-07-30T00:00:00.000Z"),
      user: { email: null, phone: "+2250708123456" }
    });

    const created = await service.addTestAccount(
      "delivery",
      "+225 07 08 12 34 56",
      "admin"
    );
    expect(userFindFirst).toHaveBeenCalledWith({
      where: { phone: "+2250708123456" },
      select: { id: true, email: true, phone: true }
    });
    expect(created.label).toBe("+2250708123456");
  });
});
