import { ProfileModerationStatus } from "@prisma/client";

/** Profil utilisable comme contexte actif (sélecteur, X-Profile-Id). */
export function isProfileSelectable(
  status: ProfileModerationStatus | string
): boolean {
  return status === ProfileModerationStatus.active;
}

/** Profil sous sanction (ne peut pas être contourné via désactivation). */
export function isProfileSanctioned(
  status: ProfileModerationStatus | string
): boolean {
  return (
    status === ProfileModerationStatus.banned ||
    status === ProfileModerationStatus.suspended
  );
}

export function isProfileDeactivated(
  status: ProfileModerationStatus | string
): boolean {
  return status === ProfileModerationStatus.deactivated;
}
