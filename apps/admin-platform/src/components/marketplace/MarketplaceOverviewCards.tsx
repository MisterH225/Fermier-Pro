"use client";

import { useTranslations } from "next-intl";
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
      />
      <KpiCard
        label={t("overview.totalListings")}
        value={overview.listings.total}
        variant="purple"
      />
      <KpiCard
        label={t("overview.activeTransactions")}
        value={overview.transactions.active}
        variant="warning"
      />
      <KpiCard
        label={t("overview.openDisputes")}
        value={overview.transactions.openDisputes}
        variant="danger"
      />
    </div>
  );
}
