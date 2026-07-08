"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, Search, Sprout, Users } from "lucide-react";
import type { OverviewDto } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  data: OverviewDto["recentActivity"];
};

type ActivityRow = {
  id: string;
  kind: "vet" | "signup" | "alert";
  title: string;
  subtitle: string;
  tone: "amber" | "primary" | "danger";
};

function formatWhen(iso: string | undefined, locale: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

export function OverviewActivityFeed({ data }: Props) {
  const t = useTranslations("overview");
  const locale = useLocale();

  const rows = useMemo<ActivityRow[]>(() => {
    const vetRows: ActivityRow[] = data.vetRequests.map((v) => ({
      id: `vet-${v.id}`,
      kind: "vet",
      title: v.name,
      subtitle: t("activityItems.vetSubtitle", {
        country: v.country,
        when: formatWhen(v.createdAt, locale)
      }),
      tone: "amber"
    }));
    const signupRows: ActivityRow[] = data.signups.map((u) => ({
      id: `signup-${u.id}`,
      kind: "signup",
      title: u.name,
      subtitle: t("activityItems.signupSubtitle", {
        when: formatWhen(u.createdAt, locale)
      }),
      tone: "primary"
    }));
    const alertRows: ActivityRow[] = data.sanitaryAlerts.map((a) => ({
      id: `alert-${a.id}`,
      kind: "alert",
      title: a.zoneName,
      subtitle: a.message,
      tone: "danger"
    }));
    return [...vetRows, ...signupRows, ...alertRows].slice(0, 8);
  }, [data, locale, t]);

  return (
    <div className="glass-card rounded-[1.75rem] p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight">{t("activity")}</h2>
        <span className="flex size-9 items-center justify-center rounded-xl border border-white/60 bg-white/50 text-muted-foreground">
          <Search className="size-4" />
        </span>
      </div>

      <ul className="divide-y divide-border/40">
        {rows.length === 0 ? (
          <li className="py-10 text-center text-sm text-muted-foreground">{t("activityEmpty")}</li>
        ) : (
          rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0"
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-2xl",
                  row.tone === "amber" && "bg-amber-500/15 text-amber-600",
                  row.tone === "primary" && "bg-primary/10 text-primary",
                  row.tone === "danger" && "bg-destructive/10 text-destructive"
                )}
              >
                {row.kind === "vet" ? (
                  <Sprout className="size-4" />
                ) : row.kind === "signup" ? (
                  <Users className="size-4" />
                ) : (
                  <AlertTriangle className="size-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{row.title}</p>
                <p className="truncate text-xs text-muted-foreground">{row.subtitle}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  row.kind === "vet" && "bg-amber-500/10 text-amber-700",
                  row.kind === "signup" && "bg-primary/10 text-primary",
                  row.kind === "alert" && "bg-destructive/10 text-destructive"
                )}
              >
                {row.kind === "vet"
                  ? t("activityKinds.vet")
                  : row.kind === "signup"
                    ? t("activityKinds.signup")
                    : t("activityKinds.alert")}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
