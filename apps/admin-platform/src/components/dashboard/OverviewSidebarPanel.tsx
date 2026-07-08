"use client";

import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Globe2,
  ShieldAlert,
  Stethoscope,
  Store,
  TrendingUp
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { OverviewDto } from "@/lib/api";

type Props = {
  kpis: OverviewDto["kpis"];
};

const QUICK_LINKS = [
  { href: "/veterinaires" as const, key: "vets", icon: Stethoscope },
  { href: "/marketplace" as const, key: "marketplace", icon: Store },
  { href: "/carte-sanitaire" as const, key: "healthMap", icon: ShieldAlert }
] as const;

export function OverviewSidebarPanel({ kpis }: Props) {
  const t = useTranslations("overview");

  const metrics = [
    {
      label: t("kpis.vetsPending"),
      value: kpis.pendingVets,
      href: "/veterinaires" as const
    },
    {
      label: t("kpis.vetsVerified"),
      value: kpis.verifiedVets,
      href: "/veterinaires" as const
    },
    {
      label: t("kpis.diseases"),
      value: kpis.activeDiseases,
      href: "/carte-sanitaire" as const
    },
    {
      label: t("kpis.countries"),
      value: kpis.countriesCovered
    }
  ];

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-primary via-brand-light to-blue-500 p-5 text-white shadow-glow-blue">
        <div className="absolute -right-6 -top-6 size-28 rounded-full bg-white/10 blur-2xl" />
        <div className="relative space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white/85">{t("snapshot.title")}</p>
            <span className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
              Live
            </span>
          </div>
          <div>
            <p className="text-xs text-white/75">{t("snapshot.transactions")}</p>
            <p className="text-3xl font-extrabold tabular-nums tracking-tight">
              {kpis.monthTransactions.toLocaleString()}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {metrics.map((m) => {
              const inner = (
                <>
                  <p className="text-[11px] text-white/75 leading-tight">{m.label}</p>
                  <p className="text-xl font-bold tabular-nums text-white">
                    {m.value.toLocaleString()}
                  </p>
                </>
              );
              return m.href ? (
                <Link
                  key={m.label}
                  href={m.href}
                  className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2.5 transition hover:bg-white/15"
                >
                  {inner}
                </Link>
              ) : (
                <div
                  key={m.label}
                  className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2.5"
                >
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="glass-card rounded-[1.75rem] p-5">
        <div className="mb-4 flex items-center gap-2">
          <Globe2 className="size-4 text-primary" />
          <h3 className="font-bold">{t("quickLinks.title")}</h3>
        </div>
        <ul className="space-y-2">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <li key={link.key}>
                <Link
                  href={link.href}
                  className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/40 px-3.5 py-3 text-sm font-medium transition hover:bg-white/70"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </span>
                    {t(`quickLinks.${link.key}`)}
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="glass-card rounded-[1.75rem] p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <TrendingUp className="size-5" />
          </span>
          <div>
            <h3 className="font-bold">{t("insight.title")}</h3>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              {t("insight.body", {
                farms: kpis.activeFarms,
                users: kpis.totalUsers
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
