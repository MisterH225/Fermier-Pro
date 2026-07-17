import {
  type AdminConsoleMenuPermissions,
  hasMenuAccess,
  type AdminConsoleMenuAccess
} from "./admin-console-menu.constants";

/** Sections de statistiques régionales accordables par institution (deny-by-default). */
export const INSTITUTION_STAT_SECTIONS = [
  "mortality",
  "herd",
  "reproduction",
  "growth",
  "vetCoverage",
  "economy",
  "health",
  "lifecycle",
  "adoption",
  "movements"
] as const;

export type InstitutionStatSection = (typeof INSTITUTION_STAT_SECTIONS)[number];

export type InstitutionStatSectionPermissions = Partial<
  Record<InstitutionStatSection, boolean>
>;

/** Mapping section → endpoint API (movements réservé P-14, non servi pour l'instant). */
export const INSTITUTION_STAT_SECTION_ENDPOINTS: Record<
  InstitutionStatSection,
  string
> = {
  mortality: "/admin/stats/regional/mortality",
  herd: "/admin/stats/regional/herd",
  reproduction: "/admin/stats/regional/reproduction",
  growth: "/admin/stats/regional/growth",
  vetCoverage: "/admin/stats/regional/vet-coverage",
  economy: "/admin/stats/regional/economy",
  health: "/admin/stats/regional/health",
  lifecycle: "/admin/stats/regional/lifecycle",
  adoption: "/admin/stats/regional/adoption",
  movements: "/admin/stats/regional/movements"
};

export type StatSectionAccessProfile = {
  role: "superadmin" | "institution";
  permissions: AdminConsoleMenuPermissions | "all";
  statSectionPermissions: InstitutionStatSectionPermissions | "all";
};

/**
 * Parse les permissions de sections stockées en JSON.
 * Clés inconnues ignorées ; valeurs non booléennes ignorées.
 */
export function parseStatSectionPermissions(
  raw: unknown
): InstitutionStatSectionPermissions {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const out: InstitutionStatSectionPermissions = {};
  for (const key of INSTITUTION_STAT_SECTIONS) {
    const value = (raw as Record<string, unknown>)[key];
    if (value === true) {
      out[key] = true;
    } else if (value === false) {
      out[key] = false;
    }
  }
  return out;
}

/** Sanitize l'entrée DTO : conserve uniquement les clés connues et des booléens. */
export function sanitizeStatSectionPermissions(
  input?: Record<string, boolean>
): InstitutionStatSectionPermissions {
  return parseStatSectionPermissions(input ?? {});
}

/**
 * Sections visibles pour un profil console.
 * - Superadmin : toutes les sections.
 * - Institution : intersection menu « stats » (read/write) ET section === true.
 *   Section absente ou false → refusée (deny-by-default).
 */
export function resolveStatSections(
  profile: StatSectionAccessProfile
): InstitutionStatSection[] {
  if (profile.role === "superadmin") {
    return [...INSTITUTION_STAT_SECTIONS];
  }

  if (!hasMenuAccess(profile.permissions, "stats", "read")) {
    return [];
  }

  const perms = profile.statSectionPermissions;
  if (perms === "all") {
    return [...INSTITUTION_STAT_SECTIONS];
  }

  return INSTITUTION_STAT_SECTIONS.filter((section) => perms[section] === true);
}

export function hasStatSectionAccess(
  profile: StatSectionAccessProfile,
  section: InstitutionStatSection,
  requiredMenu: AdminConsoleMenuAccess = "read"
): boolean {
  if (profile.role === "superadmin") {
    return true;
  }
  if (!hasMenuAccess(profile.permissions, "stats", requiredMenu)) {
    return false;
  }
  const perms = profile.statSectionPermissions;
  if (perms === "all") {
    return true;
  }
  return perms[section] === true;
}
