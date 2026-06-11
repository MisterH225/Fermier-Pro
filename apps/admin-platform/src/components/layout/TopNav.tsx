"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  ChevronDown,
  LogOut,
  Menu,
  MoreHorizontal,
  Search,
  Sparkles,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { NAV_ITEMS, PRIMARY_NAV, SECONDARY_NAV } from "@/components/layout/nav-config";

const LOGO_SRC = "/images/fermier-pro-logo-nobg.png";
const LOGO_ASPECT = 601 / 295;

type Props = {
  pendingVets?: number;
  activeAlerts?: number;
  marketplaceDisputes?: number;
  userName?: string | null;
  userEmail?: string | null;
  onLogout: () => void;
};

function navActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function badgeFor(
  item: (typeof PRIMARY_NAV)[number],
  counts: { pendingVets: number; activeAlerts: number; marketplaceDisputes: number }
) {
  if (item.badgeKey === "pendingVets" && counts.pendingVets > 0) return counts.pendingVets;
  if (item.badgeKey === "activeAlerts" && counts.activeAlerts > 0) return counts.activeAlerts;
  if (item.badgeKey === "marketplaceDisputes" && counts.marketplaceDisputes > 0) {
    return counts.marketplaceDisputes;
  }
  return null;
}

export function TopNav({
  pendingVets = 0,
  activeAlerts = 0,
  marketplaceDisputes = 0,
  userName,
  userEmail,
  onLogout
}: Props) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const counts = { pendingVets, activeAlerts, marketplaceDisputes };
  const secondaryActive = SECONDARY_NAV.some((item) => navActive(pathname, item.href));
  const displayName = userName ?? "Admin";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 px-4 sm:px-6 pt-4 pb-2">
      <div className="glass-panel rounded-[1.75rem] px-4 sm:px-6 py-3 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <span className="flex size-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-glow-blue">
            <Sparkles className="size-4" />
          </span>
          <div className="hidden sm:flex flex-col leading-none">
            <Image
              src={LOGO_SRC}
              alt="Fermier Pro"
              width={108}
              height={Math.round(108 / LOGO_ASPECT)}
              priority
              className="object-contain object-left h-7 w-auto"
            />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground mt-0.5">
              SuperAdmin
            </span>
          </div>
        </Link>

        <nav className="hidden lg:flex flex-1 items-center justify-center gap-1 min-w-0">
          {PRIMARY_NAV.map((item) => {
            const active = navActive(pathname, item.href);
            const badge = badgeFor(item, counts);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-glow-blue"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/50"
                )}
              >
                <item.icon size={15} />
                <span>{t(item.key)}</span>
                {badge != null ? (
                  <span
                    className={cn(
                      "min-w-[1.1rem] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold",
                      active ? "bg-white/25 text-white" : "bg-primary/10 text-primary"
                    )}
                  >
                    {badge}
                  </span>
                ) : null}
              </Link>
            );
          })}

          <div className="relative" ref={moreRef}>
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all",
                secondaryActive || moreOpen
                  ? "bg-white/70 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/50"
              )}
            >
              <MoreHorizontal size={15} />
              <span>{t("more")}</span>
              <ChevronDown size={14} className={cn("transition", moreOpen && "rotate-180")} />
            </button>
            {moreOpen ? (
              <div className="glass-dropdown absolute left-0 top-full mt-2 w-56 py-2 z-50">
                {SECONDARY_NAV.map((item) => {
                  const active = navActive(pathname, item.href);
                  const badge = badgeFor(item, counts);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition hover:bg-white/60",
                        active && "text-primary bg-primary/5"
                      )}
                    >
                      <item.icon size={16} />
                      <span className="flex-1">{t(item.key)}</span>
                      {badge != null ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                          {badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        </nav>

        <button
          type="button"
          aria-label="Menu"
          onClick={() => setMobileOpen((v) => !v)}
          className="lg:hidden inline-flex size-10 items-center justify-center rounded-full border border-white/60 bg-white/40 text-muted-foreground transition hover:bg-white/70"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        <div className="flex items-center gap-2 sm:gap-3 ml-auto shrink-0">
          <button
            type="button"
            aria-label="Rechercher"
            className="hidden md:inline-flex size-10 items-center justify-center rounded-full border border-white/60 bg-white/40 text-muted-foreground transition hover:bg-white/70 hover:text-foreground"
          >
            <Search size={18} />
          </button>

          <NotificationBell
            pendingVets={pendingVets}
            activeAlerts={activeAlerts}
            marketplaceDisputes={marketplaceDisputes}
          />

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center gap-2.5 rounded-full border border-white/60 bg-white/40 py-1.5 pl-1.5 pr-3 transition hover:bg-white/70"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-blue-400 text-xs font-bold text-white">
                {initials}
              </span>
              <span className="hidden md:block text-left leading-tight">
                <span className="block text-sm font-semibold text-foreground max-w-[120px] truncate">
                  {displayName}
                </span>
                {userEmail ? (
                  <span className="block text-[11px] text-muted-foreground max-w-[120px] truncate">
                    {userEmail}
                  </span>
                ) : null}
              </span>
              <ChevronDown
                size={14}
                className={cn(
                  "hidden md:block text-muted-foreground transition",
                  profileOpen && "rotate-180"
                )}
              />
            </button>
            {profileOpen ? (
              <div className="glass-dropdown absolute right-0 top-full mt-2 w-56 py-2 z-50">
                <div className="px-4 py-3 border-b border-white/40">
                  <p className="text-sm font-semibold truncate">{displayName}</p>
                  {userEmail ? (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{userEmail}</p>
                  ) : null}
                </div>
                <div className="px-3 py-2">
                  <LocaleSwitcher variant="light" />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    onLogout();
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-destructive transition hover:bg-red-50/80"
                >
                  <LogOut size={16} />
                  {t("logout")}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {mobileOpen ? (
        <div className="glass-dropdown lg:hidden mt-2 mx-4 sm:mx-6 p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = navActive(pathname, item.href);
            const badge = badgeFor(item, counts);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                  active ? "bg-primary text-primary-foreground" : "hover:bg-white/60"
                )}
              >
                <item.icon size={16} />
                <span className="flex-1">{t(item.key)}</span>
                {badge != null ? (
                  <span className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold">
                    {badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ) : null}
    </header>
  );
}
