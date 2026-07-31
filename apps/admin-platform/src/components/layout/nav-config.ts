import {
  BarChart3,
  Bot,
  Calendar,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Map,
  MessageSquare,
  MessageSquareWarning,
  Settings,
  Shield,
  Store,
  Users,
  Award,
  Wallet,
  type LucideIcon
} from "lucide-react";

/** Clés de permission / ACL — inchangées (merchant vs producer restent distincts). */
export const NAV_KEYS = [
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
  "producerSubscriptions",
  "producerScores",
  "stats",
  "adoption",
  "wallet",
  "ai",
  "settings"
] as const;

export type NavKey = (typeof NAV_KEYS)[number];

/** Libellés i18n `nav.*` pour groupes (pas des clés de permission). */
export type NavGroupLabelKey = "subscriptions";

export type NavItem = {
  href: string;
  icon: LucideIcon;
  key: NavKey;
  badgeKey?: "pendingVets" | "activeAlerts" | "marketplaceDisputes";
  primary?: boolean;
};

export type NavGroup = {
  kind: "group";
  id: string;
  labelKey: NavGroupLabelKey;
  icon: LucideIcon;
  primary?: boolean;
  children: NavItem[];
};

export type NavEntry =
  | (NavItem & { kind?: "item" })
  | NavGroup;

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return (entry as NavGroup).kind === "group";
}

export const NAV_ENTRIES: NavEntry[] = [
  { href: "/", icon: LayoutDashboard, key: "overview", primary: true },
  {
    href: "/veterinaires",
    icon: Shield,
    key: "vets",
    badgeKey: "pendingVets",
    primary: true
  },
  { href: "/utilisateurs", icon: Users, key: "users", primary: true },
  {
    href: "/carte-sanitaire",
    icon: Map,
    key: "map",
    badgeKey: "activeAlerts",
    primary: true
  },
  {
    href: "/marketplace",
    icon: Store,
    key: "marketplace",
    badgeKey: "marketplaceDisputes",
    primary: true
  },
  {
    kind: "group",
    id: "subscriptions",
    labelKey: "subscriptions",
    icon: CreditCard,
    primary: true,
    children: [
      {
        href: "/abonnements-commercant",
        icon: CreditCard,
        key: "merchantSubscriptions"
      },
      {
        href: "/abonnements-producteur",
        icon: Users,
        key: "producerSubscriptions"
      }
    ]
  },
  { href: "/producteurs-scores", icon: Award, key: "producerScores", primary: true },
  { href: "/statistiques", icon: BarChart3, key: "stats", primary: true },
  { href: "/metriques-adoption", icon: BarChart3, key: "adoption" },
  { href: "/portefeuille", icon: Wallet, key: "wallet" },
  { href: "/veterinaires/rendez-vous", icon: Calendar, key: "vetAppointments" },
  { href: "/moderation-feed", icon: MessageSquareWarning, key: "feedModeration" },
  { href: "/moderation-chat", icon: MessageSquare, key: "chatModeration" },
  { href: "/audit-logs", icon: ClipboardList, key: "auditLogs" },
  { href: "/ia", icon: Bot, key: "ai" },
  { href: "/parametres", icon: Settings, key: "settings" }
];

/** Liste plate (permissions, Sidebar, matrice institution). */
export const NAV_ITEMS: NavItem[] = NAV_ENTRIES.flatMap((entry) =>
  isNavGroup(entry) ? entry.children : [entry]
);

export const PRIMARY_NAV = NAV_ITEMS.filter((item) => item.primary);
export const SECONDARY_NAV = NAV_ITEMS.filter((item) => !item.primary);

export function filterNavEntries(
  entries: NavEntry[],
  canRead: (key: NavKey) => boolean
): NavEntry[] {
  const out: NavEntry[] = [];
  for (const entry of entries) {
    if (isNavGroup(entry)) {
      const children = entry.children.filter((c) => canRead(c.key));
      if (children.length === 0) continue;
      out.push({ ...entry, children });
      continue;
    }
    if (canRead(entry.key)) {
      out.push(entry);
    }
  }
  return out;
}
