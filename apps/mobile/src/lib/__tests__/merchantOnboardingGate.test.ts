import type { AuthMeResponse } from "../api";
import { needsMerchantOnboarding } from "../merchantOnboardingState";

function authMe(overrides: {
  profileId: string;
  onboardingComplete: boolean;
  subscriptionTier?: "free" | "premium" | null;
}): AuthMeResponse {
  return {
    user: {
      id: "u1",
      supabaseUserId: "s1",
      email: "t@example.com",
      phone: null,
      fullName: "Test",
      firstName: null,
      lastName: null,
      avatarUrl: null,
      producerHomeFarmName: null,
      homeLatitude: null,
      homeLongitude: null,
      homeLocationLabel: null,
      homeLocationSource: null,
      isActive: true,
      notificationsEnabled: true,
      pushNotificationsRegistered: false,
      isOnboarded: true,
      onboardingSkipped: false,
      cguAcceptedAt: "2026-01-01T00:00:00.000Z",
      cguVersionAccepted: "1"
    },
    primaryFarm: null,
    activeFarm: null,
    profiles: [
      {
        id: overrides.profileId,
        type: "merchant",
        displayName: "Commerçant",
        isDefault: true,
        avatarUrl: null
      }
    ],
    activeProfile: {
      id: overrides.profileId,
      type: "merchant",
      displayName: "Commerçant",
      isDefault: true,
      avatarUrl: null
    },
    merchantProfile: {
      profileId: "mp1",
      subscriptionTier: overrides.subscriptionTier ?? null,
      shopSkipped: false,
      productSkipped: false,
      onboardingComplete: overrides.onboardingComplete
    }
  } as AuthMeResponse;
}

describe("needsMerchantOnboarding", () => {
  const profileId = "prof-merchant-1";

  it("true tant que onboardingComplete est false (même Premium)", () => {
    expect(
      needsMerchantOnboarding(
        authMe({ profileId, onboardingComplete: false, subscriptionTier: "premium" }),
        profileId
      )
    ).toBe(true);
  });

  it("false quand onboardingComplete est true", () => {
    expect(
      needsMerchantOnboarding(
        authMe({ profileId, onboardingComplete: true, subscriptionTier: "premium" }),
        profileId
      )
    ).toBe(false);
  });

  it("false si le profil actif n'est pas commerçant", () => {
    const me = authMe({ profileId, onboardingComplete: false });
    me.profiles[0].type = "producer";
    me.activeProfile!.type = "producer";
    expect(needsMerchantOnboarding(me, profileId)).toBe(false);
  });
});
