import { Reflector } from "@nestjs/core";
import { ServiceUnavailableException } from "@nestjs/common";
import { PlatformModuleEnabledGuard } from "./platform-module-enabled.guard";
import { PLATFORM_MODULE_METADATA } from "./require-platform-module.decorator";

describe("PlatformModuleEnabledGuard — allow-list", () => {
  const isModuleActiveForUser = jest.fn();
  const getInactiveMessage = jest.fn().mockResolvedValue(null);
  const platformFlags = { isModuleActiveForUser, getInactiveMessage };
  const reflector = {
    getAllAndOverride: jest.fn()
  };

  const guard = new PlatformModuleEnabledGuard(
    reflector as unknown as Reflector,
    platformFlags as never
  );

  function ctx(userId?: string) {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: userId ? { id: userId } : undefined })
      })
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    reflector.getAllAndOverride.mockReturnValue("mills");
  });

  it("laisse passer un compte de test sur module globalement OFF", async () => {
    isModuleActiveForUser.mockResolvedValue(true);
    await expect(guard.canActivate(ctx("tester") as never)).resolves.toBe(true);
    expect(isModuleActiveForUser).toHaveBeenCalledWith("mills", "tester");
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      PLATFORM_MODULE_METADATA,
      expect.any(Array)
    );
  });

  it("refuse un compte non listé quand le module est OFF", async () => {
    isModuleActiveForUser.mockResolvedValue(false);
    await expect(guard.canActivate(ctx("other") as never)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it("ignore le guard si aucun module requis", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(ctx("x") as never)).resolves.toBe(true);
    expect(isModuleActiveForUser).not.toHaveBeenCalled();
  });
});
