import { MerchantKind } from "@prisma/client";
import { MerchantProfilesService } from "./merchant-profiles.service";

/**
 * Persistance géo commerçant — réutilise GeoRollupService (cas P-10 Abidjan/Bouaké/Korhogo).
 */
describe("MerchantProfilesService — géolocalisation", () => {
  const user = { id: "user-geo" } as never;

  function build(opts?: {
    resolve?: { departmentCode: string | null; source: string };
    profile?: Record<string, unknown>;
  }) {
    const base = {
      id: "mp-geo",
      userId: "user-geo",
      merchantKind: MerchantKind.mill,
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
      onboardingComplete: true,
      latitude: null as number | null,
      longitude: null as number | null,
      locationCity: null as string | null,
      departmentCode: null as string | null,
      geoResolutionSource: "unresolved",
      shops: [],
      ...opts?.profile
    };

    let stored = { ...base };

    const prisma = {
      merchantProfile: {
        upsert: jest.fn().mockImplementation(async () => stored),
        findUnique: jest.fn().mockImplementation(async () => ({
          ...stored,
          shops: []
        })),
        update: jest.fn().mockImplementation(async ({ data }) => {
          stored = {
            ...stored,
            ...data,
            latitude: data.latitude ?? stored.latitude,
            longitude: data.longitude ?? stored.longitude,
            locationCity:
              data.locationCity !== undefined
                ? data.locationCity
                : stored.locationCity,
            departmentCode:
              data.departmentCode !== undefined
                ? data.departmentCode
                : stored.departmentCode,
            geoResolutionSource:
              data.geoResolutionSource ?? stored.geoResolutionSource
          };
          return stored;
        })
      },
      platformSettings: { findUnique: jest.fn().mockResolvedValue(null) },
      merchantSubscriptionInvoice: {
        findFirst: jest.fn().mockResolvedValue(null)
      }
    };

    const resolve = opts?.resolve ?? {
      departmentCode: null,
      source: "unresolved"
    };
    const geoRollup = {
      resolveFarmDepartment: jest.fn().mockResolvedValue(resolve)
    };

    const service = new MerchantProfilesService(
      prisma as never,
      {
        limitsFromSettings: () => ({
          merchantStandardMaxShops: 1,
          merchantStandardMaxProductsPerShop: 10,
          merchantPremiumMaxShops: 5,
          merchantPremiumMaxProductsPerShop: 100
        }),
        resolveMaxShops: () => 1,
        resolveMaxProductsPerShop: () => 10
      } as never,
      { isModuleActiveForUser: jest.fn().mockResolvedValue(true) } as never,
      geoRollup as never
    );

    return { service, prisma, geoRollup, getStored: () => stored };
  }

  it("GPS Abidjan → source gps + departmentCode", async () => {
    const { service, geoRollup, getStored } = build({
      resolve: { departmentCode: "CI-AB", source: "gps" }
    });
    await service.patchProfile(user, {
      latitude: 5.36,
      longitude: -4.0083
    });
    expect(geoRollup.resolveFarmDepartment).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: 5.36,
        longitude: -4.0083
      })
    );
    expect(getStored().departmentCode).toBe("CI-AB");
    expect(getStored().geoResolutionSource).toBe("gps");
  });

  it("localité Bouaké → source locality", async () => {
    const { service, geoRollup, getStored } = build({
      resolve: { departmentCode: "CI-BK", source: "locality" }
    });
    await service.patchProfile(user, { locationCity: "Bouaké" });
    expect(geoRollup.resolveFarmDepartment).toHaveBeenCalledWith(
      expect.objectContaining({ locationCity: "Bouaké" })
    );
    expect(getStored().departmentCode).toBe("CI-BK");
    expect(getStored().geoResolutionSource).toBe("locality");
  });

  it("localité Korhogo → source locality", async () => {
    const { service, getStored } = build({
      resolve: { departmentCode: "CI-KO", source: "locality" }
    });
    await service.patchProfile(user, { locationCity: "Korhogo" });
    expect(getStored().departmentCode).toBe("CI-KO");
    expect(getStored().geoResolutionSource).toBe("locality");
  });

  it("sans géo → unresolved + needsLocationNudge pour moulin", async () => {
    const { service } = build({
      resolve: { departmentCode: null, source: "unresolved" }
    });
    const me = await service.getMe(user);
    expect(me.geoResolutionSource).toBe("unresolved");
    expect(me.needsLocationNudge).toBe(true);
  });

  it("moulin localisé → pas de rappel", async () => {
    const { service } = build({
      profile: {
        latitude: 5.36,
        longitude: -4.01,
        departmentCode: "CI-AB",
        geoResolutionSource: "gps"
      }
    });
    const me = await service.getMe(user);
    expect(me.needsLocationNudge).toBe(false);
  });
});
