"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, MapPin, Shield, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Props = {
  pendingVets: number;
  activeAlerts: number;
  marketplaceDisputes?: number;
};

export function NotificationBell({
  pendingVets,
  activeAlerts,
  marketplaceDisputes = 0
}: Props) {
  const t = useTranslations("notifications");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const total = pendingVets + activeAlerts + marketplaceDisputes;

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={t("title")}
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex size-10 items-center justify-center rounded-full border border-white/60 bg-white/40 text-muted-foreground transition hover:bg-white/70 hover:text-foreground"
      >
        <Bell size={18} />
        {total > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center shadow-glow-blue">
            {total > 99 ? "99+" : total}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="glass-dropdown absolute right-0 top-full mt-2 w-72 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/40">
            <p className="text-sm font-semibold text-foreground">{t("title")}</p>
          </div>
          <div className="p-2 space-y-0.5">
            {total === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground text-center">{t("none")}</p>
            ) : null}
            {pendingVets > 0 ? (
              <Link
                href="/veterinaires"
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-white/60"
                )}
              >
                <Shield size={16} className="text-primary shrink-0" />
                <span>{t("pendingVets", { count: pendingVets })}</span>
              </Link>
            ) : null}
            {activeAlerts > 0 ? (
              <Link
                href="/carte-sanitaire"
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-white/60"
                )}
              >
                <MapPin size={16} className="text-amber-500 shrink-0" />
                <span>{t("activeAlerts", { count: activeAlerts })}</span>
              </Link>
            ) : null}
            {marketplaceDisputes > 0 ? (
              <Link
                href="/marketplace"
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-white/60"
                )}
              >
                <Store size={16} className="text-primary shrink-0" />
                <span>{t("marketplaceDisputes", { count: marketplaceDisputes })}</span>
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
