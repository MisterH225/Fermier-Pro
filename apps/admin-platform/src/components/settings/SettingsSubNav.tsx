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
      className="flex gap-6 border-b border-border/60"
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
              "-mb-px border-b-2 pb-3 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
