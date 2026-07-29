import {
  BadRequestException,
  ConflictException,
  NotFoundException
} from "@nestjs/common";

jest.mock("./supabase-jwt.verifier", () => ({
  verifySupabaseAccessToken: jest.fn()
}));

import { AuthService } from "./auth.service";

describe("AuthService.checkPhoneAvailable", () => {
  const prisma = {
    user: {
      findUnique: jest.fn()
    }
  };

  const service = new AuthService({} as never, prisma as never, {} as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("refuse un numéro invalide", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      phone: null
    });

    await expect(
      service.checkPhoneAvailable("user-1", "abc")
    ).rejects.toMatchObject({
      message: "Numéro de téléphone invalide."
    });
  });

  it("refuse si le numéro est déjà celui du compte", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      phone: "+2250708123456"
    });

    await expect(
      service.checkPhoneAvailable("user-1", "+2250708123456")
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuse si le numéro est déjà pris par un autre", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: "user-1", phone: null })
      .mockResolvedValueOnce({ id: "user-2", phone: "+2250708123456" });

    await expect(
      service.checkPhoneAvailable("user-1", "+2250708123456")
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("accepte un numéro libre (ajout)", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: "user-1", phone: null })
      .mockResolvedValueOnce(null);

    await expect(
      service.checkPhoneAvailable("user-1", "+2250708123456")
    ).resolves.toEqual({
      ok: true,
      phone: "+2250708123456",
      mode: "add"
    });
  });

  it("accepte un nouveau numéro (changement)", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: "user-1", phone: "+2250708000000" })
      .mockResolvedValueOnce(null);

    await expect(
      service.checkPhoneAvailable("user-1", "+2250708123456")
    ).resolves.toEqual({
      ok: true,
      phone: "+2250708123456",
      mode: "change"
    });
  });

  it("refuse le changement si le nouveau numéro est pris", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: "user-1", phone: "+2250708000000" })
      .mockResolvedValueOnce({ id: "user-2", phone: "+2250708123456" });

    await expect(
      service.checkPhoneAvailable("user-1", "+2250708123456")
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("404 si utilisateur introuvable", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.checkPhoneAvailable("missing", "+2250708123456")
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
