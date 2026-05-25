"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { ShellLoading } from "@/components/layout/PageSkeleton";
import { useAdminRealtime } from "@/lib/useAdminRealtime";

export function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [pendingVets, setPendingVets] = useState(0);
  const [activeAlerts, setActiveAlerts] = useState(0);

  const onCounts = useCallback((c: { pendingVets: number; activeAlerts: number }) => {
    setPendingVets(c.pendingVets);
    setActiveAlerts(c.activeAlerts);
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      const t = data.session?.access_token;
      if (!t) {
        router.replace("/login");
        return;
      }
      setToken(t);
    });
  }, [router]);

  useAdminRealtime(onCounts);

  const logout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (!token) {
    return <ShellLoading />;
  }

  return (
    <div className="flex min-h-screen bg-brand-cream">
      <Sidebar
        pendingVets={pendingVets}
        activeAlerts={activeAlerts}
        onLogout={logout}
      />
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
          <DashboardHeader pendingVets={pendingVets} activeAlerts={activeAlerts} />
          {children}
        </div>
      </main>
    </div>
  );
}
