"use client";

import { useTranslations } from "next-intl";
import { NotificationBell } from "@/components/layout/NotificationBell";

type Props = {
  pendingVets: number;
  activeAlerts: number;
};

export function DashboardHeader({ pendingVets, activeAlerts }: Props) {
  const t = useTranslations("app");

  return (
    <header className="flex items-center justify-between mb-6 pb-4 border-b border-border/80">
      <p className="text-sm font-medium text-muted-foreground hidden sm:block">{t("subtitle")}</p>
      <NotificationBell pendingVets={pendingVets} activeAlerts={activeAlerts} />
    </header>
  );
}
