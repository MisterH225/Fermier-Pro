import type { ReactNode } from "react";
import { SettingsSubNav } from "@/components/settings/SettingsSubNav";
import { dashboardPageMetadata } from "@/lib/dashboard-page-metadata";

export async function generateMetadata() {
  return dashboardPageMetadata("settings");
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <SettingsSubNav />
      {children}
    </div>
  );
}
