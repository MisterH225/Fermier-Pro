import { ProfilesService } from "./profiles.service";

describe("ProfilesService.remove — délègue à la désactivation", () => {
  const prisma = {
    profile: { delete: jest.fn() }
  };
  const deactivation = {
    deactivate: jest.fn().mockResolvedValue({
      profileId: "p1",
      profileStatus: "deactivated",
      deactivatedAt: new Date().toISOString(),
      suggestedActiveProfileId: null
    })
  };

  const service = new ProfilesService(prisma as never, deactivation as never);
  const user = { id: "user-1" } as never;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("n'appelle jamais profile.delete", async () => {
    await service.remove(user, "p1");
    expect(prisma.profile.delete).not.toHaveBeenCalled();
    expect(deactivation.deactivate).toHaveBeenCalledWith(user, "p1", {
      reason: undefined
    });
  });
});
