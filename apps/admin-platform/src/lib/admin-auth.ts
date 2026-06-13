import { apiFetch } from "./api";

export type AdminMeDto = {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: "superadmin";
};

export function fetchAdminMe(accessToken: string): Promise<AdminMeDto> {
  return apiFetch<AdminMeDto>("/admin/me", accessToken);
}

/** Vérifie que le JWT correspond à un super-admin plateforme. */
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
