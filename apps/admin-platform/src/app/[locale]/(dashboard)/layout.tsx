import type { ReactNode } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { AdminAccessProvider } from "@/lib/admin-access-context";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAccessProvider>
      <DashboardShell>{children}</DashboardShell>
    </AdminAccessProvider>
  );
}
