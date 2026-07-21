import { GoneException, NotFoundException } from "@nestjs/common";
import { ProfilesService } from "./profiles.service";

describe("ProfilesService.remove — plus de hard delete", () => {
  const prisma = {
    profile: {
      findFirst: jest.fn(),
      delete: jest.fn()
    }
  };

  const service = new ProfilesService(prisma as never);
  const user = { id: "user-1" } as never;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renvoie 410 Gone et n'appelle jamais profile.delete", async () => {
    prisma.profile.findFirst.mockResolvedValue({ id: "p1" });
    await expect(service.remove(user, "p1")).rejects.toBeInstanceOf(
      GoneException
    );
    expect(prisma.profile.delete).not.toHaveBeenCalled();
  });

  it("renvoie 404 si profil introuvable (sans delete)", async () => {
    prisma.profile.findFirst.mockResolvedValue(null);
    await expect(service.remove(user, "missing")).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(prisma.profile.delete).not.toHaveBeenCalled();
  });

  it("expose un code machine PROFILE_DELETE_GONE", async () => {
    prisma.profile.findFirst.mockResolvedValue({ id: "p1" });
    const err = await service.remove(user, "p1").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GoneException);
    const body = (err as GoneException).getResponse() as {
      code: string;
      deactivatePath: string;
    };
    expect(body.code).toBe("PROFILE_DELETE_GONE");
    expect(body.deactivatePath).toBe("/profiles/p1/deactivate");
  });
});

