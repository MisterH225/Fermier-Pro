"use client";

import { NotificationBell } from "@/components/layout/NotificationBell";

type Props = {
  pendingVets: number;
  activeAlerts: number;
};

export function DashboardHeader({ pendingVets, activeAlerts }: Props) {
  return (
    <header className="flex items-center justify-end mb-6 pb-4 border-b border-slate-200/80">
      <NotificationBell pendingVets={pendingVets} activeAlerts={activeAlerts} />
    </header>
  );
}
