import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { EventListFilter } from "../../lists/EventListFilter";
import { EventListItem } from "../../lists/EventListItem";
import type { FilterPill } from "../../lists/types";
import { ScreenSection } from "../../layout/ScreenSection";
import type { AnimalListItem, FarmHealthRecordRowDto } from "../../../lib/api";
import { activeCaseToEventItem } from "./diseaseUtils";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../../theme/mobileTheme";

export type DiseaseCaseFilterId =
  | "all"
  | "severe"
  | "moderate"
  | "mild"
  | "isolation";

type Props = {
  records: FarmHealthRecordRowDto[];
  animals: AnimalListItem[];
  locale: string;
  isLoading: boolean;
  onAddPress?: () => void;
  onOpenCase: (record: FarmHealthRecordRowDto) => void;
  onSwipeResolve?: (record: FarmHealthRecordRowDto) => void;
  onSwipeTreatment?: (record: FarmHealthRecordRowDto) => void;
  resolvingId?: string | null;
};

function SwipeableCaseRow({
  item,
  onPress,
  onResolve,
  onTreatment,
  resolving
}: {
  item: ReturnType<typeof activeCaseToEventItem>;
  onPress: () => void;
  onResolve: () => void;
  onTreatment: () => void;
  resolving: boolean;
}) {
  const { t } = useTranslation();

  const renderRight = () => (
    <View style={styles.swipeRow}>
      <Pressable
        style={styles.swipeTreatment}
        onPress={onTreatment}
        accessibilityRole="button"
        accessibilityLabel={t("health.diseases.swipeTreatment")}
      >
        <Ionicons name="medical" size={20} color={mobileColors.onAccent} />
        <Text style={styles.swipeLabel}>{t("health.diseases.swipeTreatment")}</Text>
      </Pressable>
      <Pressable
        style={[styles.swipeResolve, resolving && styles.swipeDisabled]}
        onPress={onResolve}
        disabled={resolving}
        accessibilityRole="button"
        accessibilityLabel={t("health.diseases.swipeRecovered")}
      >
        {resolving ? (
          <ActivityIndicator color={mobileColors.onAccent} size="small" />
        ) : (
          <>
            <Ionicons name="checkmark-done" size={20} color={mobileColors.onAccent} />
            <Text style={styles.swipeLabel}>{t("health.diseases.swipeRecovered")}</Text>
          </>
        )}
      </Pressable>
    </View>
  );

  return (
    <Swipeable renderRightActions={renderRight} overshootRight={false}>
      <EventListItem item={item} onPress={onPress} />
    </Swipeable>
  );
}

export function ActiveCasesList({
  records,
  animals,
  locale,
  isLoading,
  onAddPress,
  onOpenCase,
  onSwipeResolve,
  onSwipeTreatment,
  resolvingId
}: Props) {
  const { t } = useTranslation();
  const [filterId, setFilterId] = useState<DiseaseCaseFilterId>("all");

  const filters: FilterPill[] = [
    { id: "all", label: t("health.filterDiseaseAll") },
    { id: "severe", label: t("health.diseaseModal.severitySevere") },
    { id: "moderate", label: t("health.diseaseModal.severityModerate") },
    { id: "mild", label: t("health.diseaseModal.severityMild") },
    { id: "isolation", label: t("health.diseases.filterIsolation") }
  ];

  const items = useMemo(() => {
    return records
      .filter((r) => r.kind === "disease" && r.disease?.caseStatus === "active")
      .filter((r) => {
        if (filterId === "all") {
          return true;
        }
        if (filterId === "isolation") {
          return r.disease?.inIsolation === true;
        }
        return r.disease?.severity === filterId;
      })
      .map((r) => activeCaseToEventItem(r, animals, locale, t));
  }, [records, animals, locale, filterId, t]);

  return (
    <ScreenSection
      title={t("health.diseases.activeCases")}
      plain
      headerRight={
        onAddPress ? (
          <Pressable onPress={onAddPress} hitSlop={8} accessibilityRole="button">
            <Ionicons name="add-circle" size={28} color={mobileColors.accent} />
          </Pressable>
        ) : undefined
      }
    >
      {filters.length > 0 ? (
        <EventListFilter
          pills={filters}
          activeId={filterId}
          onChange={(id: string) => setFilterId(id as DiseaseCaseFilterId)}
        />
      ) : null}

      {isLoading ? (
        <ActivityIndicator style={{ marginVertical: mobileSpacing.lg }} />
      ) : items.length === 0 ? (
        <Text style={styles.empty}>{t("health.diseases.noActiveCases")}</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => {
            const record = item.meta as FarmHealthRecordRowDto;
            if (!onSwipeResolve && !onSwipeTreatment) {
              return (
                <EventListItem item={item} onPress={() => onOpenCase(record)} />
              );
            }
            return (
              <SwipeableCaseRow
                item={item}
                onPress={() => onOpenCase(record)}
                onResolve={() => onSwipeResolve?.(record)}
                onTreatment={() => onSwipeTreatment?.(record)}
                resolving={resolvingId === record.id}
              />
            );
          }}
        />
      )}
    </ScreenSection>
  );
}

const styles = StyleSheet.create({
  empty: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    textAlign: "center",
    paddingVertical: mobileSpacing.lg
  },
  swipeRow: {
    flexDirection: "row",
    marginBottom: mobileSpacing.sm
  },
  swipeTreatment: {
    width: 88,
    backgroundColor: mobileColors.accent,
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    borderTopLeftRadius: mobileRadius.md,
    borderBottomLeftRadius: mobileRadius.md
  },
  swipeResolve: {
    width: 88,
    backgroundColor: mobileColors.success,
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    borderTopRightRadius: mobileRadius.md,
    borderBottomRightRadius: mobileRadius.md
  },
  swipeDisabled: { opacity: 0.6 },
  swipeLabel: {
    color: mobileColors.onAccent,
    fontSize: mobileFontSize.xs,
    fontWeight: "700",
    textAlign: "center"
  }
});
