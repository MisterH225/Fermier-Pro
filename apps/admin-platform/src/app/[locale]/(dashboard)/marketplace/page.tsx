"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  fetchAdminMarketplaceDisputes,
  fetchAdminMarketplaceTransactions,
  type AdminMarketplaceTransactionRow
} from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterPills } from "@/components/layout/FilterPills";
import { MarketplaceTransactionTable } from "@/components/marketplace/MarketplaceTransactionTable";
import { WeightDisputeQueue } from "@/components/marketplace/WeightDisputeQueue";
import { PlatformRevenueSection } from "@/components/marketplace/PlatformRevenueSection";

const MAIN_TABS = ["transactions", "disputes", "revenue"] as const;
type MainTab = (typeof MAIN_TABS)[number];

const STATUS_FILTERS = [
  "all",
  "PAYMENT_PENDING",
  "PAYMENT_HELD",
  "PICKUP_SCHEDULED",
  "WEIGHT_DECLARED",
  "WEIGHT_DISPUTED",
  "WEIGHT_VALIDATED",
  "TRANSACTION_CLOSED",
  "CANCELLED_BY_BUYER",
  "CANCELLED_BY_SELLER",
  "CANCELLED_SOLD_TO_OTHER"
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export default function MarketplaceAdminPage() {
  const t = useTranslations("marketplace");
  const { token, ready } = useAdminToken();
  const [mainTab, setMainTab] = useState<MainTab>("transactions");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [transactions, setTransactions] = useState<AdminMarketplaceTransactionRow[]>(
    []
  );
  const [disputes, setDisputes] = useState<AdminMarketplaceTransactionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTransactions = useCallback(async () => {
    if (!token) return;
    const status = statusFilter === "all" ? undefined : statusFilter;
    const rows = await fetchAdminMarketplaceTransactions(token, status);
    setTransactions(rows ?? []);
  }, [token, statusFilter]);

  const loadDisputes = useCallback(async () => {
    if (!token) return;
    const rows = await fetchAdminMarketplaceDisputes(token);
    setDisputes(rows ?? []);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const run = async () => {
      if (mainTab === "transactions") {
        await loadTransactions();
      } else if (mainTab === "disputes") {
        await loadDisputes();
      }
    };
    void run().finally(() => setLoading(false));
  }, [token, mainTab, loadTransactions, loadDisputes]);

  if (!ready) {
    return <p className="text-muted-foreground">…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />

      <FilterPills
        items={[...MAIN_TABS]}
        value={mainTab}
        onChange={setMainTab}
        label={(id) => t(`tabs.${id}`)}
      />

      {mainTab === "transactions" ? (
        <>
          <FilterPills
            items={[...STATUS_FILTERS]}
            value={statusFilter}
            onChange={setStatusFilter}
            label={(id) =>
              id === "all" ? t("transactions.allStatuses") : t(`status.${id}`, { defaultValue: id })
            }
          />
          {loading ? (
            <p className="text-muted-foreground">…</p>
          ) : (
            <MarketplaceTransactionTable rows={transactions} />
          )}
        </>
      ) : null}

      {mainTab === "disputes" ? (
        loading ? (
          <p className="text-muted-foreground">…</p>
        ) : (
          <WeightDisputeQueue
            token={token!}
            rows={disputes}
            onReload={() => void loadDisputes()}
          />
        )
      ) : null}

      {mainTab === "revenue" && token ? (
        <PlatformRevenueSection token={token} />
      ) : null}
    </div>
  );
}
