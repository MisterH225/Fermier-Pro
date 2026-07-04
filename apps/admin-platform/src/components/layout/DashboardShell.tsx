"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/navigation";
import { TopNav } from "@/components/layout/TopNav";
import { ShellLoading } from "@/components/layout/PageSkeleton";
import { useAdminRealtime } from "@/lib/useAdminRealtime";
import { useAdminAccess } from "@/lib/admin-access-context";
import { hasMenuAccess } from "@/lib/admin-permissions";
import { NAV_ITEMS } from "@/components/layout/nav-config";

export function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { profile, ready: accessReady } = useAdminAccess();
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

  if (!token || !accessReady) {
    return <ShellLoading />;
  }

  const visibleNavItems = NAV_ITEMS.filter((item) =>
    hasMenuAccess(profile, item.key, "read")
  );

  return (
    <div className="min-h-screen w-full overflow-x-hidden dashboard-bg">
      <TopNav
        pendingVets={pendingVets}
        activeAlerts={activeAlerts}
        marketplaceDisputes={marketplaceDisputes}
        userName={userName}
        userEmail={userEmail}
        roleLabel={
          profile?.role === "institution"
            ? profile.institutionLabel ?? "Institution"
            : "SuperAdmin"
        }
        navItems={visibleNavItems}
        onLogout={logout}
      />
      <main className="w-full px-3 sm:px-4 lg:px-6 pb-6 sm:pb-8">
        <div className="glass-panel mx-auto w-full max-w-[1400px] rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-8rem)] lg:min-h-[calc(100vh-9.5rem)]">
          {children}
        </div>
      </main>
    </div>
  );
}
