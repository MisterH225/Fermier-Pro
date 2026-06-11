import {
  BarChart3,
  Bot,
  Calendar,
  ClipboardList,
  LayoutDashboard,
  Map,
  MessageSquareWarning,
  Settings,
  Shield,
  Store,
  Users,
  type LucideIcon
} from "lucide-react";

export const NAV_KEYS = [
  "overview",
  "vets",
  "vetAppointments",
  "users",
  "feedModeration",
  "auditLogs",
  "map",
  "marketplace",
  "stats",
  "ai",
  "settings"
] as const;

export type NavKey = (typeof NAV_KEYS)[number];

export type NavItem = {
  href: string;
  icon: LucideIcon;
  key: NavKey;
  badgeKey?: "pendingVets" | "activeAlerts" | "marketplaceDisputes";
  primary?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", icon: LayoutDashboard, key: "overview", primary: true },
  { href: "/veterinaires", icon: Shield, key: "vets", badgeKey: "pendingVets", primary: true },
  { href: "/utilisateurs", icon: Users, key: "users", primary: true },
  { href: "/carte-sanitaire", icon: Map, key: "map", badgeKey: "activeAlerts", primary: true },
  {
    href: "/marketplace",
    icon: Store,
    key: "marketplace",
    badgeKey: "marketplaceDisputes",
    primary: true
  },
  { href: "/statistiques", icon: BarChart3, key: "stats", primary: true },
  { href: "/veterinaires/rendez-vous", icon: Calendar, key: "vetAppointments" },
  { href: "/moderation-feed", icon: MessageSquareWarning, key: "feedModeration" },
  { href: "/audit-logs", icon: ClipboardList, key: "auditLogs" },
  { href: "/ia", icon: Bot, key: "ai" },
  { href: "/parametres", icon: Settings, key: "settings" }
];

export const PRIMARY_NAV = NAV_ITEMS.filter((item) => item.primary);
export const SECONDARY_NAV = NAV_ITEMS.filter((item) => !item.primary);
