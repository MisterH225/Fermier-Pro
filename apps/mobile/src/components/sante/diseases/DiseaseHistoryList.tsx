import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { EventList } from "../../lists";
import { fetchFarmDiseaseHistory, type AnimalListItem } from "../../../lib/api";
import { historyRowToEventItem } from "./diseaseUtils";

export type DiseaseHistoryFilterId = "month" | "3m" | "6m" | "all";

type Props = {
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  animals: AnimalListItem[];
  locale: string;
  filterId: DiseaseHistoryFilterId;
  onFilterChange: (id: DiseaseHistoryFilterId) => void;
};

export function DiseaseHistoryList({
  farmId,
  accessToken,
  activeProfileId,
  animals,
  locale,
  filterId,
  onFilterChange
}: Props) {
  const { t } = useTranslation();

  const historyQ = useQuery({
    queryKey: ["farmDiseaseHistory", farmId, filterId, activeProfileId],
    queryFn: () =>
      fetchFarmDiseaseHistory(accessToken, farmId, activeProfileId, {
        period: filterId
      }),
    enabled: Boolean(accessToken && farmId)
  });

  const filters = [
    { id: "month", label: t("health.diseases.historyMonth") },
    { id: "3m", label: t("health.diseases.history3m") },
    { id: "6m", label: t("health.diseases.history6m") },
    { id: "all", label: t("health.filterDiseaseAll") }
  ];

  const items = (historyQ.data ?? []).map((row) =>
    historyRowToEventItem(row, animals, locale, t)
  );

  return (
    <EventList
      layout="embedded"
      sectionTitle={t("health.diseases.history")}
      filters={filters}
      activeFilterId={filterId}
      onFilterChange={(id) => onFilterChange(id as DiseaseHistoryFilterId)}
      data={items}
      emptyMessage={t("health.diseases.noHistory")}
      isLoading={historyQ.isLoading}
      pageSize={10}
      loadMoreLabel={t("health.loadMore")}
    />
  );
}
