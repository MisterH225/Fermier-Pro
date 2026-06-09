import { apiFetch } from "./api";

export type AdminMeDto = {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: "superadmin";
};

/** Vérifie que le JWT correspond à un super-admin plateforme. */
export async function verifyAdminSuperUser(
  accessToken: string
): Promise<boolean> {
  try {
    await apiFetch<AdminMeDto>("/admin/me", accessToken);
    return true;
  } catch {
    return false;
  }
}
