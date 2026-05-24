"use client";

import { Bell } from "lucide-react";
import { Link } from "@/i18n/navigation";

type Props = {
  pendingVets: number;
  activeAlerts: number;
};

export function NotificationBell({ pendingVets, activeAlerts }: Props) {
  const total = pendingVets + activeAlerts;

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/veterinaires"
        className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-600"
        title="Vétérinaires en attente"
      >
        <Bell size={20} />
        {total > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {total > 99 ? "99+" : total}
          </span>
        ) : null}
      </Link>
    </div>
  );
}
