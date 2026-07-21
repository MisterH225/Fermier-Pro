import {
  ConflictException,
  ForbiddenException
} from "@nestjs/common";
import {
  ProfileModerationStatus,
  ProfileType
} from "@prisma/client";
import { PROFILE_DEACTIVATION_BLOCK } from "./profile-deactivation.types";
import { ProfileDeactivationService } from "./profile-deactivation.service";
import { buildDeactivationEffects } from "./profile-deactivation.effects";

function baseProfile(
  over: Partial<{
    id: string;
    userId: string;
    type: ProfileType;
    profileStatus: ProfileModerationStatus;
    isDefault: boolean;
  }> = {}
) {
  return {
    id: "p1",
    userId: "u1",
    type: ProfileType.buyer,
    displayName: null,
    avatarUrl: null,
    isDefault: false,
    profileStatus: ProfileModerationStatus.active,
    profileSuspendedReason: null,
    profileSuspendedAt: null,
    deactivatedAt: null,
    deactivatedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over
  };
}

describe("buildDeactivationEffects", () => {
  it("expose masqué / conservé pour chaque type", () => {
    for (const type of Object.values(ProfileType)) {
      const fx = buildDeactivationEffects(type);
      expect(fx.willHide.length).toBeGreaterThan(0);
      expect(fx.willKeep.length).toBeGreaterThan(0);
    }
  });
});

describe("ProfileDeactivationService.collectBlocks", () => {
  const prisma = {
    profile: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    },
    farm: { findMany: jest.fn() },
    animal: { count: jest.fn() },
    farmMembership: { count: jest.fn() },
    marketplaceTransaction: { count: jest.fn() },
    marketplaceOffer: { count: jest.fn() },
    vetAppointment: { count: jest.fn() },
    withdrawalRequest: { count: jest.fn() },
    merchantProfile: { findUnique: jest.fn(), updateMany: jest.fn() },
    merchantOrder: { count: jest.fn() },
    farmTask: { count: jest.fn() },
    farmInvitation: { updateMany: jest.fn() },
    vetProfile: { updateMany: jest.fn() },
    technicianProfile: { updateMany: jest.fn() },
    buyerProfile: { updateMany: jest.fn() },
    $transaction: jest.fn()
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new ProfileDeactivationService(
    prisma as never,
    audit as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.profile.count.mockResolvedValue(2);
    prisma.farm.findMany.mockResolvedValue([]);
    prisma.animal.count.mockResolvedValue(0);
    prisma.farmMembership.count.mockResolvedValue(0);
    prisma.marketplaceTransaction.count.mockResolvedValue(0);
    prisma.marketplaceOffer.count.mockResolvedValue(0);
    prisma.vetAppointment.count.mockResolvedValue(0);
    prisma.withdrawalRequest.count.mockResolvedValue(0);
    prisma.merchantProfile.findUnique.mockResolvedValue(null);
    prisma.merchantOrder.count.mockResolvedValue(0);
    prisma.farmTask.count.mockResolvedValue(0);
  });

  it("bloque le dernier profil actif", async () => {
    prisma.profile.count.mockResolvedValue(1);
    const blocks = await service.collectBlocks("u1", baseProfile());
    expect(
      blocks.some(
        (b) => b.code === PROFILE_DEACTIVATION_BLOCK.LAST_ACTIVE_PROFILE
      )
    ).toBe(true);
  });

  it("ne bloque pas si plusieurs profils actifs", async () => {
    prisma.profile.count.mockResolvedValue(2);
    const blocks = await service.collectBlocks("u1", baseProfile());
    expect(
      blocks.some(
        (b) => b.code === PROFILE_DEACTIVATION_BLOCK.LAST_ACTIVE_PROFILE
      )
    ).toBe(false);
  });

  it("bloque producer avec animaux actifs", async () => {
    prisma.farm.findMany.mockResolvedValue([{ id: "f1", name: "Ferme" }]);
    prisma.animal.count.mockResolvedValue(3);
    const blocks = await service.collectBlocks(
      "u1",
      baseProfile({ type: ProfileType.producer })
    );
    expect(
      blocks.some(
        (b) => b.code === PROFILE_DEACTIVATION_BLOCK.PRODUCER_FARM_ACTIVE
      )
    ).toBe(true);
    expect(blocks[0]?.message).toMatch(/3/);
  });

  it("ne bloque pas producer sans animaux ni membres", async () => {
    prisma.farm.findMany.mockResolvedValue([{ id: "f1", name: "Ferme" }]);
    const blocks = await service.collectBlocks(
      "u1",
      baseProfile({ type: ProfileType.producer })
    );
    expect(
      blocks.some(
        (b) => b.code === PROFILE_DEACTIVATION_BLOCK.PRODUCER_FARM_ACTIVE
      )
    ).toBe(false);
  });

  it("bloque buyer avec escrow ouvert", async () => {
    prisma.marketplaceTransaction.count.mockResolvedValue(2);
    const blocks = await service.collectBlocks(
      "u1",
      baseProfile({ type: ProfileType.buyer })
    );
    expect(
      blocks.some(
        (b) => b.code === PROFILE_DEACTIVATION_BLOCK.BUYER_OPEN_TRANSACTION
      )
    ).toBe(true);
  });

  it("ne bloque pas buyer sans transaction", async () => {
    const blocks = await service.collectBlocks(
      "u1",
      baseProfile({ type: ProfileType.buyer })
    );
    expect(
      blocks.some(
        (b) => b.code === PROFILE_DEACTIVATION_BLOCK.BUYER_OPEN_TRANSACTION
      )
    ).toBe(false);
  });

  it("bloque vet avec RDV en cours", async () => {
    prisma.vetAppointment.count.mockResolvedValue(3);
    const blocks = await service.collectBlocks(
      "u1",
      baseProfile({ type: ProfileType.veterinarian })
    );
    const hit = blocks.find(
      (b) => b.code === PROFILE_DEACTIVATION_BLOCK.VET_OPEN_APPOINTMENT
    );
    expect(hit?.message).toMatch(/3 rendez-vous/);
  });

  it("bloque vet avec retrait en attente", async () => {
    prisma.withdrawalRequest.count.mockResolvedValue(1);
    const blocks = await service.collectBlocks(
      "u1",
      baseProfile({ type: ProfileType.veterinarian })
    );
    expect(
      blocks.some(
        (b) => b.code === PROFILE_DEACTIVATION_BLOCK.VET_PENDING_WITHDRAWAL
      )
    ).toBe(true);
  });

  it("ne bloque pas vet sans RDV ni retrait", async () => {
    const blocks = await service.collectBlocks(
      "u1",
      baseProfile({ type: ProfileType.veterinarian })
    );
    expect(
      blocks.some(
        (b) =>
          b.code === PROFILE_DEACTIVATION_BLOCK.VET_OPEN_APPOINTMENT ||
          b.code === PROFILE_DEACTIVATION_BLOCK.VET_PENDING_WITHDRAWAL
      )
    ).toBe(false);
  });

  it("bloque merchant premium actif", async () => {
    prisma.merchantProfile.findUnique.mockResolvedValue({
      subscriptionTier: "premium",
      subscriptionStatus: "active"
    });
    const blocks = await service.collectBlocks(
      "u1",
      baseProfile({ type: ProfileType.merchant })
    );
    expect(
      blocks.some(
        (b) =>
          b.code === PROFILE_DEACTIVATION_BLOCK.MERCHANT_ACTIVE_SUBSCRIPTION
      )
    ).toBe(true);
  });

  it("bloque merchant avec commande en cours", async () => {
    prisma.merchantOrder.count.mockResolvedValue(2);
    const blocks = await service.collectBlocks(
      "u1",
      baseProfile({ type: ProfileType.merchant })
    );
    expect(
      blocks.some(
        (b) => b.code === PROFILE_DEACTIVATION_BLOCK.MERCHANT_OPEN_ORDER
      )
    ).toBe(true);
  });

  it("bloque technician avec tâche ouverte", async () => {
    prisma.farmTask.count.mockResolvedValue(4);
    const blocks = await service.collectBlocks(
      "u1",
      baseProfile({ type: ProfileType.technician })
    );
    expect(
      blocks.some(
        (b) => b.code === PROFILE_DEACTIVATION_BLOCK.TECHNICIAN_OPEN_TASK
      )
    ).toBe(true);
  });

  it("ne bloque pas technician sans tâche", async () => {
    const blocks = await service.collectBlocks(
      "u1",
      baseProfile({ type: ProfileType.technician })
    );
    expect(
      blocks.some(
        (b) => b.code === PROFILE_DEACTIVATION_BLOCK.TECHNICIAN_OPEN_TASK
      )
    ).toBe(false);
  });
});

describe("ProfileDeactivationService.reactivate", () => {
  const prisma = {
    profile: { findFirst: jest.fn(), update: jest.fn() },
    technicianProfile: { updateMany: jest.fn() },
    buyerProfile: { updateMany: jest.fn() },
    merchantProfile: { updateMany: jest.fn() },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        profile: {
          update: jest.fn().mockResolvedValue(
            baseProfile({ profileStatus: ProfileModerationStatus.active })
          )
        },
        technicianProfile: { updateMany: jest.fn() },
        buyerProfile: { updateMany: jest.fn() },
        merchantProfile: { updateMany: jest.fn() }
      })
    )
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new ProfileDeactivationService(
    prisma as never,
    audit as never
  );
  const user = { id: "u1" } as never;

  beforeEach(() => jest.clearAllMocks());

  it("refuse la réactivation d'un profil banni", async () => {
    prisma.profile.findFirst.mockResolvedValue(
      baseProfile({ profileStatus: ProfileModerationStatus.banned })
    );
    await expect(service.reactivate(user, "p1")).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("refuse la réactivation d'un profil suspendu", async () => {
    prisma.profile.findFirst.mockResolvedValue(
      baseProfile({ profileStatus: ProfileModerationStatus.suspended })
    );
    await expect(service.reactivate(user, "p1")).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("réactive un profil désactivé", async () => {
    prisma.profile.findFirst.mockResolvedValue(
      baseProfile({ profileStatus: ProfileModerationStatus.deactivated })
    );
    const row = await service.reactivate(user, "p1");
    expect(row.profileStatus).toBe(ProfileModerationStatus.active);
    expect(audit.record).toHaveBeenCalled();
  });
});

describe("ProfileDeactivationService.deactivate", () => {
  const tx = {
    profile: {
      update: jest.fn(),
      findFirst: jest.fn()
    },
    vetProfile: { updateMany: jest.fn() },
    farmInvitation: { updateMany: jest.fn() },
    technicianProfile: { updateMany: jest.fn() },
    buyerProfile: { updateMany: jest.fn() },
    merchantProfile: { updateMany: jest.fn() }
  };
  const prisma = {
    profile: {
      findFirst: jest.fn(),
      count: jest.fn().mockResolvedValue(2)
    },
    farm: { findMany: jest.fn().mockResolvedValue([]) },
    animal: { count: jest.fn() },
    farmMembership: { count: jest.fn() },
    marketplaceTransaction: { count: jest.fn().mockResolvedValue(0) },
    marketplaceOffer: { count: jest.fn().mockResolvedValue(0) },
    vetAppointment: { count: jest.fn() },
    withdrawalRequest: { count: jest.fn() },
    merchantProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    merchantOrder: { count: jest.fn() },
    farmTask: { count: jest.fn() },
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
      fn(tx)
    )
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new ProfileDeactivationService(
    prisma as never,
    audit as never
  );
  const user = { id: "u1" } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.profile.count.mockResolvedValue(2);
    prisma.marketplaceTransaction.count.mockResolvedValue(0);
    prisma.marketplaceOffer.count.mockResolvedValue(0);
    tx.profile.update.mockResolvedValue({
      ...baseProfile({
        profileStatus: ProfileModerationStatus.deactivated,
        type: ProfileType.buyer
      }),
      deactivatedAt: new Date("2026-07-21T02:00:00Z")
    });
    tx.profile.findFirst.mockResolvedValue({ id: "p2" });
  });

  it("refuse si blocage (409)", async () => {
    prisma.profile.findFirst.mockResolvedValue(baseProfile());
    prisma.profile.count.mockResolvedValue(1);
    await expect(service.deactivate(user, "p1")).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it("désactive et bascule le profil défaut", async () => {
    prisma.profile.findFirst.mockResolvedValue(
      baseProfile({ isDefault: true, type: ProfileType.buyer })
    );
    tx.profile.update
      .mockResolvedValueOnce(
        baseProfile({
          profileStatus: ProfileModerationStatus.deactivated,
          isDefault: false,
          type: ProfileType.buyer
        })
      )
      .mockResolvedValueOnce(baseProfile({ id: "p2", isDefault: true }));

    const result = await service.deactivate(user, "p1");
    expect(result.profileStatus).toBe("deactivated");
    expect(result.suggestedActiveProfileId).toBe("p2");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "profile.deactivated"
      })
    );
  });
});
