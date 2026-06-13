"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

type Props = {
  variant?: "dark" | "light";
};

export function LocaleSwitcher({ variant = "dark" }: Props) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const isLight = variant === "light";

  return (
    <div
      className={cn(
        "flex gap-1 p-1 rounded-full",
        isLight ? "bg-muted/80" : "bg-white/10"
      )}
    >
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => router.replace(pathname, { locale: l })}
          className={cn(
            "px-2.5 py-1 text-xs font-bold uppercase rounded-full transition",
            isLight
              ? locale === l
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
              : locale === l
                ? "bg-white text-primary"
                : "text-white/70 hover:text-white"
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
