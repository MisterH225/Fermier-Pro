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
import type { NavItem } from "@/components/layout/nav-config";

const LOGO_SRC = "/images/fermier-pro-logo-nobg.png";
const LOGO_ASPECT = 601 / 295;

type Props = {
  pendingVets?: number;
  activeAlerts?: number;
  marketplaceDisputes?: number;
  userName?: string | null;
  userEmail?: string | null;
  roleLabel?: string;
  navItems?: NavItem[];
  onLogout: () => void;
};

function navActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function badgeFor(
  item: NavItem,
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
  roleLabel = "SuperAdmin",
  navItems = NAV_ITEMS,
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
  const primaryNav = navItems.filter((item) => item.primary);
  const secondaryNav = navItems.filter((item) => !item.primary);
  const secondaryActive = secondaryNav.some((item) => navActive(pathname, item.href));
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

  useEffect(() => {
    setMobileOpen(false);
    setMoreOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const navLinkClass = (active: boolean, compact = false) =>
    cn(
      "relative inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold transition-all whitespace-nowrap",
      compact ? "px-3 py-2 text-xs" : "px-3.5 py-2 text-sm xl:px-4",
      active
        ? "bg-primary text-primary-foreground shadow-glow-blue"
        : "text-muted-foreground hover:text-foreground hover:bg-white/50"
    );

  return (
    <header className="sticky top-0 z-40 w-full px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4 pb-2">
      <div className="glass-panel mx-auto w-full max-w-[1400px] rounded-2xl sm:rounded-[1.75rem] px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3">
        {/* Ligne 1 : marque + actions */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2">
            <span className="flex size-8 sm:size-9 items-center justify-center rounded-xl sm:rounded-2xl bg-primary text-primary-foreground shadow-glow-blue">
              <Sparkles className="size-3.5 sm:size-4" />
            </span>
            <div className="hidden min-w-0 sm:flex flex-col leading-none">
              <Image
                src={LOGO_SRC}
                alt="Fermier Pro"
                width={96}
                height={Math.round(96 / LOGO_ASPECT)}
                priority
                className="h-6 w-auto max-w-[7.5rem] object-contain object-left lg:h-7 lg:max-w-[6.75rem]"
              />
              <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground mt-0.5">
                {roleLabel}
              </span>
            </div>
          </Link>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              aria-label="Rechercher"
              className="hidden xl:inline-flex size-9 sm:size-10 items-center justify-center rounded-full border border-white/60 bg-white/40 text-muted-foreground transition hover:bg-white/70 hover:text-foreground"
            >
              <Search size={17} />
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
                className="flex max-w-[11rem] sm:max-w-[13rem] items-center gap-2 rounded-full border border-white/60 bg-white/40 py-1 pl-1 pr-2 sm:py-1.5 sm:pl-1.5 sm:pr-3 transition hover:bg-white/70"
              >
                <span className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-blue-400 text-[10px] sm:text-xs font-bold text-white">
                  {initials}
                </span>
                <span className="hidden min-w-0 md:block text-left leading-tight">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {displayName}
                  </span>
                  {userEmail ? (
                    <span className="block truncate text-[10px] sm:text-[11px] text-muted-foreground">
                      {userEmail}
                    </span>
                  ) : null}
                </span>
                <ChevronDown
                  size={14}
                  className={cn(
                    "hidden md:block shrink-0 text-muted-foreground transition",
                    profileOpen && "rotate-180"
                  )}
                />
              </button>
              {profileOpen ? (
                <div className="glass-dropdown absolute right-0 top-full z-50 mt-2 w-56 py-2">
                  <div className="border-b border-white/40 px-4 py-3 md:hidden">
                    <p className="truncate text-sm font-semibold">{displayName}</p>
                    {userEmail ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{userEmail}</p>
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

            <button
              type="button"
              aria-label="Menu"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/40 text-muted-foreground transition hover:bg-white/70 lg:hidden"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Ligne 2 : navigation desktop scrollable */}
        <nav
          className="mt-2 hidden min-w-0 items-center gap-1 border-t border-white/40 pt-2 lg:flex"
          aria-label="Navigation principale"
        >
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {primaryNav.map((item) => {
              const active = navActive(pathname, item.href);
              const badge = badgeFor(item, counts);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={t(item.key)}
                  className={navLinkClass(active)}
                >
                  <item.icon size={15} className="shrink-0" />
                  <span className="hidden xl:inline">{t(item.key)}</span>
                  {badge != null ? (
                    <span
                      className={cn(
                        "min-w-[1.1rem] shrink-0 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold",
                        active ? "bg-white/25 text-white" : "bg-primary/10 text-primary"
                      )}
                    >
                      {badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>

          <div className="relative shrink-0 pl-1" ref={moreRef}>
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className={cn(
                navLinkClass(secondaryActive || moreOpen, true),
                secondaryActive || moreOpen
                  ? "bg-white/70 text-foreground shadow-sm"
                  : undefined
              )}
            >
              <MoreHorizontal size={15} className="shrink-0" />
              <span>{t("more")}</span>
              <ChevronDown size={14} className={cn("shrink-0 transition", moreOpen && "rotate-180")} />
            </button>
            {moreOpen ? (
              <div className="glass-dropdown absolute right-0 top-full z-50 mt-2 w-56 py-2">
                {secondaryNav.map((item) => {
                  const active = navActive(pathname, item.href);
                  const badge = badgeFor(item, counts);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition hover:bg-white/60",
                        active && "bg-primary/5 text-primary"
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
      </div>

      {/* Menu mobile plein écran */}
      {mobileOpen ? (
        <>
          <button
            type="button"
            aria-label="Fermer le menu"
            className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px] lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="glass-dropdown fixed inset-x-3 top-[4.75rem] z-50 max-h-[calc(100vh-5.5rem)] overflow-y-auto p-2 sm:inset-x-4 lg:hidden">
            {navItems.map((item) => {
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
        </>
      ) : null}
    </header>
  );
}
