import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { EventList, type EventItem } from "../../../components/lists";
import type { FilterPill } from "../../../components/lists/types";
import { ScreenSection } from "../../../components/layout";
import { HealthSubjectPicker } from "../../../components/sante/HealthSubjectPicker";
import type {
  DiseaseFilterId,
  HealthKindTab,
  TreatmentFilterId
} from "../../../components/sante/healthUtils";
import {
  healthKindSectionTitle,
  healthKindShortLabel,
  matchesDiseaseFilter,
  matchesTreatmentFilter,
  recordToEventItem
} from "../../../components/sante/healthUtils";
import type {
  AnimalListItem,
  BatchListItem,
  FarmHealthEntityType,
  FarmHealthRecordRowDto
} from "../../../lib/api";

type Props = {
  kind: HealthKindTab;
  locale: string;
  livestockMode: "individual" | "batch" | "hybrid";
  animals: AnimalListItem[];
  batches: BatchListItem[];
  subjectType: FarmHealthEntityType;
  subjectId: string;
  onSubjectSelect: (type: FarmHealthEntityType, id: string) => void;
  records: FarmHealthRecordRowDto[];
  isLoading: boolean;
  onAddPress: () => void;
  renderDetail: (item: EventItem, ctx: { close: () => void }) => ReactNode;
  prependContent?: ReactNode;
  showSubjectPicker?: boolean;
  diseaseFilter?: DiseaseFilterId;
  treatmentFilter?: TreatmentFilterId;
};

export function HealthKindListTab({
  kind,
  locale,
  livestockMode,
  animals,
  batches,
  subjectType,
  subjectId,
  onSubjectSelect,
  records,
  isLoading,
  onAddPress,
  renderDetail,
  prependContent,
  showSubjectPicker = true,
  diseaseFilter = "all",
  treatmentFilter = "all"
}: Props) {
  const { t } = useTranslation();
  const [filterId, setFilterId] = useState<string>(
    kind === "disease" ? diseaseFilter : kind === "treatment" ? treatmentFilter : "all"
  );

  const filters: FilterPill[] = useMemo(() => {
    if (kind === "disease") {
      return [
        { id: "all", label: t("health.filterDiseaseAll") },
        { id: "active", label: t("health.filterDiseaseActive") },
        { id: "resolved", label: t("health.filterDiseaseResolved") },
        { id: "chronic", label: t("health.filterDiseaseChronic") }
      ];
    }
    if (kind === "treatment") {
      return [
        { id: "ongoing", label: t("health.filterTreatmentOngoing") },
        { id: "completed", label: t("health.filterTreatmentDone") },
        { id: "all", label: t("health.filterTreatmentAll") }
      ];
    }
    return [];
  }, [kind, t]);

  const items = useMemo(() => {
    const kindLabel = healthKindShortLabel(kind, t);
    return records
      .filter((r) => r.kind === kind)
      .filter((r) => {
        if (kind === "disease") {
          return matchesDiseaseFilter(r, filterId as DiseaseFilterId);
        }
        if (kind === "treatment") {
          return matchesTreatmentFilter(r, filterId as TreatmentFilterId);
        }
        return true;
      })
      .map((r) => recordToEventItem(r, locale, kindLabel));
  }, [records, kind, filterId, locale, t]);

  return (
    <>
      {prependContent}
      {showSubjectPicker ? (
        <ScreenSection>
          <HealthSubjectPicker
            livestockMode={livestockMode}
            animals={animals}
            batches={batches}
            subjectType={subjectType}
            subjectId={subjectId}
            onSelect={onSubjectSelect}
            labels={{
              title: t("health.subjectTitle"),
              modeHint: t(`health.modeHint.${livestockMode}` as const),
              pickAnimal: t("health.pickAnimal"),
              pickBatch: t("health.pickBatch")
            }}
          />
        </ScreenSection>
      ) : null}
      <EventList
        layout="embedded"
        sectionTitle={healthKindSectionTitle(kind, t)}
        filters={filters}
        activeFilterId={filterId}
        onFilterChange={setFilterId}
        onAddPress={onAddPress}
        data={items}
        renderDetail={renderDetail}
        emptyMessage={t("health.noEvents")}
        isLoading={isLoading}
        pageSize={15}
        loadMoreLabel={t("health.loadMore")}
      />
    </>
  );
}
