"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  fetchAdminMarketplaceOverview,
  fetchPlatformOverview,
  fetchSanitaryAlerts
} from "@/lib/api";

type Counts = {
  pendingVets: number;
  activeAlerts: number;
  marketplaceDisputes: number;
};

export function useAdminRealtime(onChange: (counts: Counts) => void) {
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    const refresh = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token || cancelled) return;
      try {
        const [overview, alerts, marketplace] = await Promise.all([
          fetchPlatformOverview(token),
          fetchSanitaryAlerts(token),
          fetchAdminMarketplaceOverview(token)
        ]);
        if (!cancelled) {
          onChange({
            pendingVets: overview.kpis.pendingVets,
            activeAlerts: alerts.length,
            marketplaceDisputes: marketplace.transactions.openDisputes
          });
        }
      } catch {
        /* ignore */
      }
    };

    void refresh();

    const channel = supabase
      .channel("admin-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "VetProfile" },
        () => void refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "SanitaryAlert" },
        () => void refresh()
      )
      .subscribe();

    const interval = window.setInterval(() => void refresh(), 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [onChange]);
}
