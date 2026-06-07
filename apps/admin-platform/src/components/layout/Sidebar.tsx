"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  BarChart3,
  Bot,
  LayoutDashboard,
  Map,
  Settings,
  Shield,
  Users,
  ClipboardList,
  Store,
  Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { Button } from "@/components/ui/button";

const LOGO_SRC = "/images/fermier-pro-logo-nobg.png";
const LOGO_ASPECT = 601 / 295;

const NAV_KEYS = [
  "overview",
  "vets",
  "vetAppointments",
  "users",
  "auditLogs",
  "map",
  "marketplace",
  "stats",
  "ai",
  "modules",
  "settings"
] as const;

const NAV: Array<{
  href: string;
  icon: typeof LayoutDashboard;
  key: (typeof NAV_KEYS)[number];
  badgeKey?: "pendingVets" | "activeAlerts" | "marketplaceDisputes";
}> = [
  { href: "/", icon: LayoutDashboard, key: "overview" },
  { href: "/veterinaires", icon: Shield, key: "vets", badgeKey: "pendingVets" },
  { href: "/veterinaires/rendez-vous", icon: Calendar, key: "vetAppointments" },
  { href: "/utilisateurs", icon: Users, key: "users" },
  { href: "/audit-logs", icon: ClipboardList, key: "auditLogs" },
  { href: "/carte-sanitaire", icon: Map, key: "map", badgeKey: "activeAlerts" },
  {
    href: "/marketplace",
    icon: Store,
    key: "marketplace",
    badgeKey: "marketplaceDisputes"
  },
  { href: "/statistiques", icon: BarChart3, key: "stats" },
  { href: "/ia", icon: Bot, key: "ai" },
  { href: "/parametres", icon: Settings, key: "settings" }
];

type Props = {
  pendingVets?: number;
  activeAlerts?: number;
  marketplaceDisputes?: number;
  onLogout: () => void;
};

export function Sidebar({
  pendingVets = 0,
  activeAlerts = 0,
  marketplaceDisputes = 0,
  onLogout
}: Props) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 bg-brand text-white flex flex-col min-h-screen shadow-lg shadow-brand/10">
      <div className="p-5 border-b border-white/10">
        <Link href="/" className="flex flex-col gap-1.5">
          <Image
            src={LOGO_SRC}
            alt="Fermier Pro"
            width={148}
            height={Math.round(148 / LOGO_ASPECT)}
            priority
            className="object-contain object-left drop-shadow-sm"
          />
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold/90">
            SuperAdmin
          </span>
        </Link>
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
                : item.badgeKey === "marketplaceDisputes" && marketplaceDisputes > 0
                  ? marketplaceDisputes
                  : null;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active ? "bg-white/15 shadow-sm" : "hover:bg-white/10"
              )}
            >
              <item.icon size={18} className={active ? "text-brand-gold" : undefined} />
              <span className="flex-1">{t(item.key)}</span>
              {badge != null ? (
                <span className="bg-brand-accent text-xs font-bold px-2 py-0.5 rounded-full min-w-[1.25rem] text-center">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-white/10 space-y-3">
        <LocaleSwitcher />
        <Button
          type="button"
          variant="ghost"
          onClick={onLogout}
          className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10"
        >
          {t("logout")}
        </Button>
      </div>
    </aside>
  );
}
