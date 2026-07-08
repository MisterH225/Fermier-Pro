/** Clés de menu alignées sur `apps/admin-platform/src/components/layout/nav-config.ts`. */
export const ADMIN_CONSOLE_MENU_KEYS = [
  "overview",
  "vets",
  "vetAppointments",
  "users",
  "feedModeration",
  "chatModeration",
  "auditLogs",
  "map",
  "marketplace",
  "merchantSubscriptions",
  "producerScores",
  "stats",
  "wallet",
  "ai",
  "settings"
] as const;

export type AdminConsoleMenuKey = (typeof ADMIN_CONSOLE_MENU_KEYS)[number];

export type AdminConsoleMenuAccess = "read" | "write";

export type AdminConsoleMenuPermissions = Partial<
  Record<AdminConsoleMenuKey, AdminConsoleMenuAccess>
>;

export const ADMIN_CONSOLE_ACCESS_RANK: Record<AdminConsoleMenuAccess, number> = {
  read: 1,
  write: 2
};

/** Routes réservées aux SuperAdmin uniquement. */
export const SUPERADMIN_ONLY_PATH_PREFIXES = [
  "/admin/superadmins",
  "/admin/institution-users",
  "/admin/feature-flags"
] as const;

type RouteMenuRule = {
  prefix: string;
  menu: AdminConsoleMenuKey;
};

/**
 * Association préfixe de route API → menu console.
 * Les méthodes POST/PATCH/DELETE/PUT exigent `write` sur le menu.
 */
export const ADMIN_ROUTE_MENU_RULES: RouteMenuRule[] = [
  { prefix: "/admin/me", menu: "overview" },
  { prefix: "/admin/platform/overview", menu: "overview" },
  { prefix: "/admin/vet-profiles", menu: "vets" },
  { prefix: "/admin/vet-appointments", menu: "vetAppointments" },
  { prefix: "/admin/users", menu: "users" },
  { prefix: "/admin/messages", menu: "users" },
  { prefix: "/admin/feed", menu: "feedModeration" },
  { prefix: "/admin/chat", menu: "chatModeration" },
  { prefix: "/admin/audit-logs", menu: "auditLogs" },
  { prefix: "/admin/sanitary", menu: "map" },
  { prefix: "/admin/health-map", menu: "map" },
  { prefix: "/admin/marketplace", menu: "marketplace" },
  { prefix: "/admin/merchant-subscriptions", menu: "merchantSubscriptions" },
  { prefix: "/admin/producer-scores", menu: "producerScores" },
  { prefix: "/admin/stats", menu: "stats" },
  { prefix: "/admin/wallet", menu: "wallet" },
  { prefix: "/admin/ai", menu: "ai" },
  { prefix: "/admin/settings", menu: "settings" },
  { prefix: "/admin/pig-price-index", menu: "marketplace" },
  { prefix: "/admin/pen-allocation", menu: "settings" }
];

export function normalizeAdminApiPath(path: string): string {
  const withoutQuery = path.split("?")[0] ?? path;
  const apiIdx = withoutQuery.indexOf("/api/v1");
  const normalized =
    apiIdx >= 0 ? withoutQuery.slice(apiIdx + "/api/v1".length) : withoutQuery;
  return normalized.replace(/\/+$/, "") || "/";
}

export function resolveMenuForAdminPath(path: string): AdminConsoleMenuKey | null {
  const normalized = normalizeAdminApiPath(path);
  for (const rule of ADMIN_ROUTE_MENU_RULES) {
    if (normalized === rule.prefix || normalized.startsWith(`${rule.prefix}/`)) {
      return rule.menu;
    }
  }
  if (normalized.startsWith("/admin")) {
    return "overview";
  }
  return null;
}

export function isSuperAdminOnlyPath(path: string): boolean {
  const normalized = normalizeAdminApiPath(path);
  return SUPERADMIN_ONLY_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}

export function isWriteHttpMethod(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

export function parseMenuPermissions(raw: unknown): AdminConsoleMenuPermissions {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const out: AdminConsoleMenuPermissions = {};
  for (const key of ADMIN_CONSOLE_MENU_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (value === "read" || value === "write") {
      out[key] = value;
    }
  }
  return out;
}

export function hasMenuAccess(
  permissions: AdminConsoleMenuPermissions | "all",
  menu: AdminConsoleMenuKey,
  required: AdminConsoleMenuAccess
): boolean {
  if (permissions === "all") {
    return true;
  }
  const granted = permissions[menu];
  if (!granted) {
    return false;
  }
  return ADMIN_CONSOLE_ACCESS_RANK[granted] >= ADMIN_CONSOLE_ACCESS_RANK[required];
}
