"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const LOCALES = ["fr", "en"] as const;

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex gap-1 p-1 rounded-lg bg-white/10">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => router.replace(pathname, { locale: l })}
          className={cn(
            "px-2.5 py-1 text-xs font-bold uppercase rounded-md transition",
            locale === l ? "bg-white text-brand" : "text-white/70 hover:text-white"
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
