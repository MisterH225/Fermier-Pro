"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  fetchAdminMarketplaceListings,
  fetchAdminMarketplaceOverview,
  fetchAdminMarketplaceTransactions,
  type AdminMarketplaceListingRow,
  type AdminMarketplaceOverviewDto,
  type AdminMarketplaceTransactionRow
} from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterPills } from "@/components/layout/FilterPills";
import { MarketplaceOverviewCards } from "@/components/marketplace/MarketplaceOverviewCards";
import { MarketplaceListingsTable } from "@/components/marketplace/MarketplaceListingsTable";
import { MarketplaceTransactionTable } from "@/components/marketplace/MarketplaceTransactionTable";
import { WeightDisputeQueue } from "@/components/marketplace/WeightDisputeQueue";
import { PlatformRevenueSection } from "@/components/marketplace/PlatformRevenueSection";
import { MarketplaceReceiptsSection } from "@/components/marketplace/MarketplaceReceiptsSection";

const MAIN_TABS = ["listings", "transactions", "disputes", "revenue", "receipts"] as const;
type MainTab = (typeof MAIN_TABS)[number];

const LISTING_STATUS_FILTERS = [
  "all",
  "published",
  "draft",
  "reserved",
  "sold",
  "paused",
  "cancelled",
  "expired"
] as const;
type ListingStatusFilter = (typeof LISTING_STATUS_FILTERS)[number];

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
  const [mainTab, setMainTab] = useState<MainTab>("listings");
  const [listingStatusFilter, setListingStatusFilter] =
    useState<ListingStatusFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [overview, setOverview] = useState<AdminMarketplaceOverviewDto | null>(null);
  const [listings, setListings] = useState<AdminMarketplaceListingRow[]>([]);
  const [transactions, setTransactions] = useState<AdminMarketplaceTransactionRow[]>(
    []
  );
  const [disputes, setDisputes] = useState<AdminMarketplaceTransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    if (!token) return;
    const data = await fetchAdminMarketplaceOverview(token);
    setOverview(data);
  }, [token]);

  const loadListings = useCallback(async () => {
    if (!token) return;
    const status = listingStatusFilter === "all" ? undefined : listingStatusFilter;
    const rows = await fetchAdminMarketplaceListings(token, status);
    setListings(rows ?? []);
  }, [token, listingStatusFilter]);

  const loadTransactions = useCallback(async () => {
    if (!token) return;
    const status = statusFilter === "all" ? undefined : statusFilter;
    const rows = await fetchAdminMarketplaceTransactions(token, status);
    setTransactions(rows ?? []);
  }, [token, statusFilter]);

  const loadDisputes = useCallback(async () => {
    if (!token) return;
    const rows = await fetchAdminMarketplaceTransactions(token, "WEIGHT_DISPUTED");
    setDisputes(rows ?? []);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const run = async () => {
      try {
        await loadOverview();
        if (mainTab === "listings") {
          await loadListings();
        } else if (mainTab === "transactions") {
          await loadTransactions();
        } else if (mainTab === "disputes") {
          await loadDisputes();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : t("loadError"));
      }
    };
    void run().finally(() => setLoading(false));
  }, [
    token,
    mainTab,
    loadOverview,
    loadListings,
    loadTransactions,
    loadDisputes,
    t
  ]);

  if (!ready) {
    return <p className="text-muted-foreground">…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />

      {overview ? <MarketplaceOverviewCards overview={overview} /> : null}

      {error ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <FilterPills
        items={[...MAIN_TABS]}
        value={mainTab}
        onChange={setMainTab}
        label={(id) => t(`tabs.${id}`)}
      />

      {mainTab === "listings" ? (
        <>
          <FilterPills
            items={[...LISTING_STATUS_FILTERS]}
            value={listingStatusFilter}
            onChange={setListingStatusFilter}
            label={(id) =>
              id === "all"
                ? t("listings.allStatuses")
                : t(`listingStatus.${id}`, { defaultValue: id })
            }
          />
          {loading ? (
            <p className="text-muted-foreground">{t("loading")}</p>
          ) : (
            <MarketplaceListingsTable
              rows={listings}
              token={token!}
              onRefresh={() => void loadListings()}
            />
          )}
        </>
      ) : null}

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
            <p className="text-muted-foreground">{t("loading")}</p>
          ) : (
            <MarketplaceTransactionTable rows={transactions} />
          )}
        </>
      ) : null}

      {mainTab === "disputes" ? (
        loading ? (
          <p className="text-muted-foreground">{t("loading")}</p>
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

      {mainTab === "receipts" && token ? (
        <MarketplaceReceiptsSection token={token} />
      ) : null}
    </div>
  );
}
