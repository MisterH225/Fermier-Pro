"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/parametres", key: "platform" as const },
  { href: "/parametres/modules", key: "modules" as const }
] as const;

export function SettingsSubNav() {
  const t = useTranslations("settings.tabs");
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-wrap gap-2"
      aria-label={t("navLabel")}
    >
      {TABS.map((tab) => {
        const active =
          tab.href === "/parametres"
            ? pathname === "/parametres"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex h-8 items-center rounded-full border px-4 text-xs font-medium transition",
              active
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-white/70 bg-white/40 text-foreground hover:bg-white/70"
            )}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
