import type { ReactNode } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { AdminAccessProvider } from "@/lib/admin-access-context";
import { InstitutionPreviewProvider } from "@/lib/institution-preview-context";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAccessProvider>
      <InstitutionPreviewProvider>
        <DashboardShell>{children}</DashboardShell>
      </InstitutionPreviewProvider>
    </AdminAccessProvider>
  );
}
