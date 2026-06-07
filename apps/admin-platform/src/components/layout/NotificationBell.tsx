"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, MapPin, Shield } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  pendingVets: number;
  activeAlerts: number;
};

export function NotificationBell({ pendingVets, activeAlerts }: Props) {
  const t = useTranslations("notifications");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const total = pendingVets + activeAlerts;

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
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="relative border-border/80 bg-card hover:bg-muted"
        aria-label={t("title")}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={18} className="text-brand" />
        {total > 0 ? (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-accent text-white text-[10px] font-bold flex items-center justify-center">
            {total > 99 ? "99+" : total}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-border bg-card shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/40">
            <p className="text-sm font-semibold text-foreground">{t("title")}</p>
          </div>
          <div className="p-2 space-y-1">
            {total === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground text-center">{t("none")}</p>
            ) : null}
            {pendingVets > 0 ? (
              <Link
                href="/veterinaires"
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition hover:bg-muted"
                )}
              >
                <Shield size={16} className="text-brand shrink-0" />
                <span>{t("pendingVets", { count: pendingVets })}</span>
              </Link>
            ) : null}
            {activeAlerts > 0 ? (
              <Link
                href="/carte-sanitaire"
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition hover:bg-muted"
                )}
              >
                <MapPin size={16} className="text-brand-accent shrink-0" />
                <span>{t("activeAlerts", { count: activeAlerts })}</span>
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
