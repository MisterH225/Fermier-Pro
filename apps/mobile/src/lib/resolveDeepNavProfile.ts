import type { AuthMeResponse } from "./api";
import type { DeepNavProfile } from "../services/navigation/deepNavigation.types";

/** Dérive le profil navigation depuis la session (alertes, push). */
export function resolveDeepNavProfile(
  authMe: AuthMeResponse | null | undefined,
  activeProfileId: string | null | undefined
): DeepNavProfile {
  const profileType =
    authMe?.profiles.find((p) => p.id === activeProfileId)?.type ?? "producer";
  if (profileType === "technician") return "technician";
  if (profileType === "veterinarian") return "veterinarian";
  if (profileType === "buyer") return "buyer";
  return "producer";
}
