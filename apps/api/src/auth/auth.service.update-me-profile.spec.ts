import { NotFoundException } from "@nestjs/common";

jest.mock("./supabase-jwt.verifier", () => ({
  verifySupabaseAccessToken: jest.fn()
}));

import { AuthService } from "./auth.service";

describe("AuthService.updateMeProfile", () => {
  const existing = {
    id: "user-1",
    firstName: "Ada",
    lastName: "Lovelace",
    notificationsEnabled: true
  };

  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    profile: {
      updateMany: jest.fn()
    },
    pushDevice: {
      deleteMany: jest.fn(),
      upsert: jest.fn()
    }
  };

  const service = new AuthService({} as never, prisma as never, {} as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(existing);
    prisma.profile.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.update.mockResolvedValue(existing);
  });

  it("met à jour Profile.avatarUrl sans appeler user.update vide", async () => {
    const result = await service.updateMeProfile(
      "user-1",
      { avatarUrl: "https://cdn.example/avatar.jpg?v=1" },
      "profile-tech-1"
    );

    expect(prisma.profile.updateMany).toHaveBeenCalledWith({
      where: { id: "profile-tech-1", userId: "user-1" },
      data: { avatarUrl: "https://cdn.example/avatar.jpg?v=1" }
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(result).toEqual(existing);
  });

  it("met à jour User.avatarUrl si aucun profil actif", async () => {
    await service.updateMeProfile("user-1", {
      avatarUrl: "https://cdn.example/avatar.jpg?v=2"
    });

    expect(prisma.profile.updateMany).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { avatarUrl: "https://cdn.example/avatar.jpg?v=2" }
    });
  });

  it("404 si utilisateur introuvable", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.updateMeProfile("missing", { avatarUrl: "x" }, "p1")
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
