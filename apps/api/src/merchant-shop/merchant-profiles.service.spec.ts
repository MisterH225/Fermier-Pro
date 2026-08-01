import { ForbiddenException } from "@nestjs/common";
import { MerchantKind } from "@prisma/client";
import { MerchantProfilesService } from "./merchant-profiles.service";

describe("MerchantProfilesService — merchantKind / flag mills", () => {
  const user = { id: "user-1" } as never;

  function build(opts: {
    millsActive?: boolean;
    merchantKind?: MerchantKind;
  }) {
    const profile = {
      id: "mp-1",
      userId: "user-1",
      merchantKind: opts.merchantKind ?? MerchantKind.standard,
      subscriptionTier: null,
      subscriptionStatus: null,
      subscriptionChosenAt: null,
      premiumPaidAt: null,
      nextBillingAt: null,
      graceEndsAt: null,
      trialEndsAt: null,
      promoPercentOffApplied: null,
      shopSkipped: false,
      productSkipped: false,
      onboardingComplete: false,
      latitude: null,
      longitude: null,
      locationCity: null,
      departmentCode: null,
      geoResolutionSource: "unresolved" as const,
      shops: []
    };
    let currentKind = profile.merchantKind;
    const prisma = {
      merchantProfile: {
        upsert: jest.fn().mockResolvedValue(profile),
        findUnique: jest.fn().mockImplementation(async () => ({
          ...profile,
          merchantKind: currentKind,
          shops: []
        })),
        update: jest.fn().mockImplementation(async ({ data }) => {
          if (data.merchantKind != null) {
            currentKind = data.merchantKind;
          }
          return { ...profile, merchantKind: currentKind };
        })
      },
      platformSettings: {
        findUnique: jest.fn().mockResolvedValue(null)
      },
      merchantSubscriptionInvoice: {
        findFirst: jest.fn().mockResolvedValue(null)
      }
    };
    const subscriptionLimits = {
      limitsFromSettings: jest.fn().mockReturnValue({
        merchantStandardMaxShops: 1,
        merchantStandardMaxProductsPerShop: 10,
        merchantPremiumMaxShops: 5,
        merchantPremiumMaxProductsPerShop: 100
      }),
      resolveMaxShops: jest.fn().mockReturnValue(1),
      resolveMaxProductsPerShop: jest.fn().mockReturnValue(10)
    };
    const platformFlags = {
      isModuleActiveForUser: jest
        .fn()
        .mockResolvedValue(opts.millsActive ?? false)
    };
    const geoRollup = {
      resolveFarmDepartment: jest.fn().mockResolvedValue({
        departmentCode: null,
        source: "unresolved"
      })
    };
    const service = new MerchantProfilesService(
      prisma as never,
      subscriptionLimits as never,
      platformFlags as never,
      geoRollup as never
    );
    return { service, prisma, platformFlags, geoRollup, getKind: () => currentKind };
  }

  it("getMe expose merchantKind (défaut standard)", async () => {
    const { service } = build({});
    const me = await service.getMe(user);
    expect(me.merchantKind).toBe(MerchantKind.standard);
  });

  it("onboarding avec flag mills OFF refuse merchantKind=mill", async () => {
    const { service, platformFlags } = build({ millsActive: false });
    await expect(
      service.patchOnboarding(user, { merchantKind: MerchantKind.mill })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(platformFlags.isModuleActiveForUser).toHaveBeenCalledWith(
      "mills",
      "user-1"
    );
  });

  it("onboarding avec flag mills OFF accepte merchantKind=standard", async () => {
    const { service, getKind } = build({ millsActive: false });
    const me = await service.patchOnboarding(user, {
      merchantKind: MerchantKind.standard
    });
    expect(me.merchantKind).toBe(MerchantKind.standard);
    expect(getKind()).toBe(MerchantKind.standard);
  });

  it("onboarding avec flag mills ON persiste merchantKind=mill", async () => {
    const { service, getKind } = build({ millsActive: true });
    const me = await service.patchOnboarding(user, {
      merchantKind: MerchantKind.mill
    });
    expect(me.merchantKind).toBe(MerchantKind.mill);
    expect(getKind()).toBe(MerchantKind.mill);
  });

  it("patchProfile standard→mill gardé par le flag (OFF → 403)", async () => {
    const { service } = build({
      millsActive: false,
      merchantKind: MerchantKind.standard
    });
    await expect(
      service.patchProfile(user, { merchantKind: MerchantKind.mill })
    ).rejects.toMatchObject({
      response: { code: "MILLS_MODULE_INACTIVE" }
    });
  });

  it("patchProfile standard→mill OK si flag ON (aucune autre donnée touchée)", async () => {
    const { service, prisma } = build({
      millsActive: true,
      merchantKind: MerchantKind.standard
    });
    const me = await service.patchProfile(user, {
      merchantKind: MerchantKind.mill
    });
    expect(me.merchantKind).toBe(MerchantKind.mill);
    expect(prisma.merchantProfile.update).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { merchantKind: MerchantKind.mill }
    });
  });
});
