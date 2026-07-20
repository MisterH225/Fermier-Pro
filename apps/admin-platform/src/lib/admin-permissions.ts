import type { NavKey } from "@/components/layout/nav-config";

export type AdminConsoleRole = "superadmin" | "institution";
export type AdminMenuAccess = "read" | "write";

export type AdminMenuPermissions = Partial<Record<NavKey, AdminMenuAccess>>;

export type AdminAccessProfile = {
  role: AdminConsoleRole;
  permissions: AdminMenuPermissions | "all";
  institutionLabel: string | null;
};

const ACCESS_RANK: Record<AdminMenuAccess, number> = {
  read: 1,
  write: 2
};

export function hasMenuAccess(
  profile: AdminAccessProfile | null,
  menu: NavKey,
  required: AdminMenuAccess = "read"
): boolean {
  if (!profile) {
    return false;
  }
  if (profile.role === "superadmin" || profile.permissions === "all") {
    return true;
  }
  const granted = profile.permissions[menu];
  if (!granted) {
    return false;
  }
  return ACCESS_RANK[granted] >= ACCESS_RANK[required];
}

export function canWriteMenu(
  profile: AdminAccessProfile | null,
  menu: NavKey
): boolean {
  return hasMenuAccess(profile, menu, "write");
}

export function profileFromAdminMe(me: {
  role: AdminConsoleRole;
  permissions: AdminMenuPermissions | "all";
  institutionLabel?: string | null;
}): AdminAccessProfile {
  return {
    role: me.role,
    permissions: me.permissions,
    institutionLabel: me.institutionLabel ?? null
  };
}

export function pathnameToNavKey(pathname: string): NavKey | null {
  if (pathname === "/" || pathname === "") {
    return "overview";
  }
  if (pathname.startsWith("/veterinaires/rendez-vous")) {
    return "vetAppointments";
  }
  if (pathname.startsWith("/veterinaires")) {
    return "vets";
  }
  if (pathname.startsWith("/utilisateurs")) {
    return "users";
  }
  if (pathname.startsWith("/carte-sanitaire")) {
    return "map";
  }
  if (pathname.startsWith("/marketplace")) {
    return "marketplace";
  }
  if (pathname.startsWith("/abonnements-commercant")) {
    return "merchantSubscriptions";
  }
  if (pathname.startsWith("/abonnements-producteur")) {
    return "producerSubscriptions";
  }
  if (pathname.startsWith("/producteurs-scores")) {
    return "producerScores";
  }
  if (pathname.startsWith("/statistiques")) {
    return "stats";
  }
  if (pathname.startsWith("/metriques-adoption")) {
    return "adoption";
  }
  if (pathname.startsWith("/portefeuille")) {
    return "wallet";
  }
  if (pathname.startsWith("/moderation-feed")) {
    return "feedModeration";
  }
  if (pathname.startsWith("/moderation-chat")) {
    return "chatModeration";
  }
  if (pathname.startsWith("/audit-logs")) {
    return "auditLogs";
  }
  if (pathname.startsWith("/ia")) {
    return "ai";
  }
  if (pathname.startsWith("/parametres")) {
    return "settings";
  }
  return null;
}
