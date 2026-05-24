"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  BarChart3,
  Bot,
  LayoutDashboard,
  Map,
  Settings,
  Shield,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";

const NAV_KEYS = [
  "overview",
  "vets",
  "users",
  "map",
  "stats",
  "ai",
  "settings"
] as const;

const NAV: Array<{
  href: string;
  icon: typeof LayoutDashboard;
  key: (typeof NAV_KEYS)[number];
  badgeKey?: "pendingVets" | "activeAlerts";
}> = [
  { href: "/", icon: LayoutDashboard, key: "overview" },
  { href: "/veterinaires", icon: Shield, key: "vets", badgeKey: "pendingVets" },
  { href: "/utilisateurs", icon: Users, key: "users" },
  { href: "/carte-sanitaire", icon: Map, key: "map", badgeKey: "activeAlerts" },
  { href: "/statistiques", icon: BarChart3, key: "stats" },
  { href: "/ia", icon: Bot, key: "ai" },
  { href: "/parametres", icon: Settings, key: "settings" }
];

type Props = {
  pendingVets?: number;
  activeAlerts?: number;
  onLogout: () => void;
};

export function Sidebar({ pendingVets = 0, activeAlerts = 0, onLogout }: Props) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 bg-brand text-white flex flex-col min-h-screen">
      <div className="p-6 border-b border-white/10">
        <p className="font-bold text-lg">Fermier Pro</p>
        <p className="text-xs text-white/70">SuperAdmin</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const badge =
            item.badgeKey === "pendingVets" && pendingVets > 0
              ? pendingVets
              : item.badgeKey === "activeAlerts" && activeAlerts > 0
                ? activeAlerts
                : null;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                active ? "bg-white/15" : "hover:bg-white/10"
              )}
            >
              <item.icon size={18} />
              <span className="flex-1">{t(item.key)}</span>
              {badge != null ? (
                <span className="bg-red-500 text-xs font-bold px-2 py-0.5 rounded-full">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-white/10 space-y-3">
        <LocaleSwitcher />
        <button
          type="button"
          onClick={onLogout}
          className="w-full text-sm text-white/80 hover:text-white"
        >
          {t("logout")}
        </button>
      </div>
    </aside>
  );
}
