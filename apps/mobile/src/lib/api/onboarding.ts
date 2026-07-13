import { apiGetJson, apiPostJson } from "./http";

  isOnboarded: boolean;
  onboardingSkipped: boolean;
};

export type CompleteOnboardingPayload = {
  farmName: string;
  speciesFocus?: string;
  locationSource: "gps" | "manual";
  locationLabel?: string;
  latitude?: number;
  longitude?: number;
  femaleBreeders: number;
  maleBreeders: number;
  starterHeadcount: number;
  fatteningHeadcount: number;
  buildingsCount: number;
  pensPerBuilding: number;
  maxPigsPerPen: number;
  productionEstimatedAgeWeeks?: number;
};

export type CompleteOnboardingResult = OnboardingStatusDto & {
  farm: { id: string; name: string };
};

export function fetchOnboardingStatus(
  accessToken: string,
  activeProfileId?: string | null
): Promise<OnboardingStatusDto> {
  return apiGetJson<OnboardingStatusDto>(
    "/onboarding/status",
    accessToken,
    activeProfileId
  );
}

export function postOnboardingComplete(
  accessToken: string,
  payload: CompleteOnboardingPayload,
  activeProfileId?: string | null
): Promise<CompleteOnboardingResult> {
  return apiPostJson<CompleteOnboardingResult>(
    "/onboarding/complete",
    payload,
    accessToken,
    activeProfileId
  );
}

export function postOnboardingSkip(
  accessToken: string,
  activeProfileId?: string | null
): Promise<OnboardingStatusDto> {
  return apiPostJson<OnboardingStatusDto>(
    "/onboarding/skip",
    {},
    accessToken,
    activeProfileId
  );
}

