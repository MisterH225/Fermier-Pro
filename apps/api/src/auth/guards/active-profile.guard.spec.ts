import { ForbiddenException } from "@nestjs/common";
import { ProfileModerationStatus } from "@prisma/client";
import { ActiveProfileGuard } from "./active-profile.guard";

describe("ActiveProfileGuard — profil désactivé", () => {
  const prisma = {
    profile: { findFirst: jest.fn() }
  };
  const guard = new ActiveProfileGuard(prisma as never);

  function ctx(profileId: string) {
    const req = {
      user: { id: "u1", accountStatus: "active" },
      headers: { "x-profile-id": profileId },
      activeProfile: undefined as unknown
    };
    return {
      switchToHttp: () => ({
        getRequest: () => req
      }),
      req
    };
  }

  beforeEach(() => jest.clearAllMocks());

  it("refuse un profil deactivated", async () => {
    prisma.profile.findFirst.mockResolvedValue({
      id: "p1",
      userId: "u1",
      profileStatus: ProfileModerationStatus.deactivated
    });
    const c = ctx("p1");
    await expect(
      guard.canActivate(c as never)
    ).rejects.toBeInstanceOf(ForbiddenException);
    try {
      await guard.canActivate(c as never);
    } catch (e) {
      expect((e as ForbiddenException).getResponse()).toMatchObject({
        code: "PROFILE_DEACTIVATED"
      });
    }
  });

  it("accepte un profil active", async () => {
    prisma.profile.findFirst.mockResolvedValue({
      id: "p1",
      userId: "u1",
      profileStatus: ProfileModerationStatus.active
    });
    const c = ctx("p1");
    await expect(guard.canActivate(c as never)).resolves.toBe(true);
    expect(c.req.activeProfile).toBeTruthy();
  });
});
