"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/navigation";
import { TopNav } from "@/components/layout/TopNav";
import { ShellLoading } from "@/components/layout/PageSkeleton";
import { useAdminRealtime } from "@/lib/useAdminRealtime";

export function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [pendingVets, setPendingVets] = useState(0);
  const [activeAlerts, setActiveAlerts] = useState(0);
  const [marketplaceDisputes, setMarketplaceDisputes] = useState(0);

  const onCounts = useCallback(
    (c: { pendingVets: number; activeAlerts: number; marketplaceDisputes: number }) => {
      setPendingVets(c.pendingVets);
      setActiveAlerts(c.activeAlerts);
      setMarketplaceDisputes(c.marketplaceDisputes);
    },
    []
  );

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      const t = data.session?.access_token;
      if (!t) {
        router.replace("/login");
        return;
      }
      setToken(t);
      const user = data.session?.user;
      if (user) {
        setUserEmail(user.email ?? null);
        const meta = user.user_metadata as { full_name?: string } | undefined;
        setUserName(
          meta?.full_name ?? user.email?.split("@")[0] ?? "Admin"
        );
      }
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
    <div className="min-h-screen dashboard-bg">
      <TopNav
        pendingVets={pendingVets}
        activeAlerts={activeAlerts}
        marketplaceDisputes={marketplaceDisputes}
        userName={userName}
        userEmail={userEmail}
        onLogout={logout}
      />
      <main className="px-4 sm:px-6 pb-8">
        <div className="glass-panel rounded-[2rem] p-5 sm:p-8 max-w-[1400px] mx-auto min-h-[calc(100vh-7rem)]">
          {children}
        </div>
      </main>
    </div>
  );
}
