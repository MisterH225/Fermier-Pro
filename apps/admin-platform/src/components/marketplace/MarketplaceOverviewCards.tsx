"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, LayoutList, ShoppingBag, Store } from "lucide-react";
import type { AdminMarketplaceOverviewDto } from "@/lib/api";
import { KpiCard } from "@/components/dashboard/KpiCard";

type Props = {
  overview: AdminMarketplaceOverviewDto;
};

export function MarketplaceOverviewCards({ overview }: Props) {
  const t = useTranslations("marketplace");

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label={t("overview.publishedListings")}
        value={overview.listings.published}
        variant="blue"
        icon={<Store className="size-4" />}
      />
      <KpiCard
        label={t("overview.totalListings")}
        value={overview.listings.total}
        variant="purple"
        icon={<LayoutList className="size-4" />}
      />
      <KpiCard
        label={t("overview.activeTransactions")}
        value={overview.transactions.active}
        variant="warning"
        icon={<ShoppingBag className="size-4" />}
      />
      <KpiCard
        label={t("overview.openDisputes")}
        value={overview.transactions.openDisputes}
        variant="danger"
        icon={<AlertTriangle className="size-4" />}
      />
    </div>
  );
}
