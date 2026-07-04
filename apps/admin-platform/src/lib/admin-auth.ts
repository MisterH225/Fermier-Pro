import { apiFetch } from "./api";
import type { AdminMenuPermissions } from "./admin-permissions";

export type AdminMeDto = {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: "superadmin" | "institution";
  permissions: AdminMenuPermissions | "all";
  institutionLabel: string | null;
};

export function fetchAdminMe(accessToken: string): Promise<AdminMeDto> {
  return apiFetch<AdminMeDto>("/admin/me", accessToken);
}

/** Vérifie que le JWT a accès à la console (SuperAdmin ou institution). */
export async function verifyConsoleAccess(
  accessToken: string
): Promise<AdminMeDto> {
  return fetchAdminMe(accessToken);
}

/** @deprecated Utiliser verifyConsoleAccess */
export async function verifyAdminSuperUser(
  accessToken: string
): Promise<boolean> {
  try {
    await fetchAdminMe(accessToken);
    return true;
  } catch {
    return false;
  }
}
