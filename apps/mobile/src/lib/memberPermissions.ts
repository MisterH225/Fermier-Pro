import type { InvitationPermissions } from "./api";

/** Convertit les permissions UI en liste de scopes RBAC. */
export function permissionsToScopes(perms: InvitationPermissions): string[] {
  const scopes = new Set<string>([
    "livestock.read",
    "tasks.read",
    "health.read",
    "housing.read",
    "exits.read",
    "vet.read",
    "marketplace.read",
    "chat"
  ]);
  if (perms.dataEntry) {
    scopes.add("livestock.write");
    scopes.add("tasks.write");
    scopes.add("housing.write");
    scopes.add("exits.write");
  }
  if (perms.health) {
    scopes.add("health.write");
    scopes.add("vet.write");
  }
  if (perms.finance) {
    scopes.add("finance.read");
    scopes.add("finance.write");
  }
  return Array.from(scopes);
}

/** Dérive les permissions UI à partir de la liste de scopes RBAC. */
export function scopesToPermissions(scopes: string[]): InvitationPermissions {
  return {
    readOnly: !scopes.includes("livestock.write"),
    dataEntry: scopes.includes("livestock.write"),
    health: scopes.includes("health.write"),
    finance: scopes.includes("finance.write")
  };
}

export type PermissionKey = keyof InvitationPermissions;

export const ALL_PERMISSION_KEYS: readonly PermissionKey[] = [
  "readOnly",
  "dataEntry",
  "health",
  "finance"
] as const;

/** Badge couleur selon le rôle UI (recipientKind ou MembershipRole). */
export const ROLE_BADGE_COLOR: Record<string, string> = {
  veterinarian: "#7E3FF2",
  vet: "#7E3FF2",
  technician: "#1C7ED6",
  worker: "#1C7ED6",
  partner: "#2F9E44",
  manager: "#2F9E44",
  owner: "#E8590C",
  viewer: "#868E96"
};

export const ROLE_DISPLAY_FR: Record<string, string> = {
  owner: "Propriétaire",
  manager: "Gérant",
  worker: "Technicien",
  veterinarian: "Vétérinaire",
  viewer: "Lecture seule",
  technician: "Technicien",
  partner: "Partenaire"
};
