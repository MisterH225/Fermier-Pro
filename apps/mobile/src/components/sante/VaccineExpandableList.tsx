import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import {
  fetchFarmVaccineSubjects,
  type VaccineCatalogItemDto,
  type VaccineSubjectRowDto,
  type VaccineSubjectStatus
} from "../../lib/api";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";

type InnerTab = VaccineSubjectStatus;

type Props = {
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  vaccine: VaccineCatalogItemDto;
  livestockMode: "individual" | "batch" | "hybrid";
  onVaccinateNow: (subjects: VaccineSubjectRowDto[]) => void;
};

function formatDay(iso: string | null, locale: string): string {
  if (!iso) {
    return "—";
  }
  const x = new Date(iso);
  if (Number.isNaN(x.getTime())) {
    return "—";
  }
  return x.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

export function VaccineExpandableList({
  farmId,
  accessToken,
  activeProfileId,
  vaccine,
  livestockMode,
  onVaccinateNow
}: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en" : "fr";
  const [innerTab, setInnerTab] = useState<InnerTab>("unvaccinated");

  const q = useQuery({
    queryKey: [
      "farmVaccineSubjects",
      farmId,
      vaccine.id,
      innerTab,
      activeProfileId
    ],
    queryFn: () =>
      fetchFarmVaccineSubjects(
        accessToken,
        farmId,
        vaccine.id,
        innerTab,
        activeProfileId
      ),
    enabled: Boolean(accessToken && farmId && vaccine.id)
  });

  const pills: { key: InnerTab; label: string }[] = [
    { key: "unvaccinated", label: t("health.vaccines.tabUnvaccinated") },
    { key: "vaccinated", label: t("health.vaccines.tabVaccinated") },
    { key: "upcoming", label: t("health.vaccines.tabUpcoming") }
  ];

  const isBatch = livestockMode === "batch";

  return (
    <View style={styles.wrap}>
      <View style={styles.pills}>
        {pills.map((p) => (
          <Pressable
            key={p.key}
            style={[styles.pill, innerTab === p.key && styles.pillOn]}
            onPress={() => setInnerTab(p.key)}
          >
            <Text
              style={[
                styles.pillTx,
                innerTab === p.key && styles.pillTxOn
              ]}
            >
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {q.isPending ? (
        <ActivityIndicator color={mobileColors.accent} style={{ marginTop: 12 }} />
      ) : q.error ? (
        <Text style={styles.err}>{(q.error as Error).message}</Text>
      ) : (q.data?.subjects ?? []).length === 0 ? (
        <Text style={styles.empty}>{t("health.vaccines.listEmpty")}</Text>
      ) : (
        (q.data?.subjects ?? []).map((s) => (
          <View key={s.entityId} style={styles.row}>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>
                {isBatch && s.headcount > 1
                  ? `${s.label} (${s.headcount})`
                  : s.label}
              </Text>
              <Text style={styles.rowMeta}>
                {s.categoryLabel}
                {s.penLabel ? ` · ${t("health.vaccines.pen")} ${s.penLabel}` : ""}
              </Text>
              <Text style={styles.rowMeta}>
                {t("health.vaccines.lastVaccination")}:{" "}
                {s.lastVaccinationAt
                  ? formatDay(s.lastVaccinationAt, locale)
                  : t("health.vaccines.never")}
                {s.nextDueAt
                  ? ` · ${t("health.vaccines.nextDue")}: ${formatDay(s.nextDueAt, locale)}`
                  : ""}
              </Text>
            </View>
            {innerTab === "unvaccinated" ? (
              <Pressable
                style={styles.vacBtn}
                onPress={() => onVaccinateNow([s])}
              >
                <Text style={styles.vacBtnTx}>
                  💉 {t("health.vaccines.vaccinateNow")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.sm, marginTop: mobileSpacing.sm },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.xs },
  pill: {
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 6,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  pillOn: {
    borderColor: mobileColors.accent,
    backgroundColor: `${mobileColors.accent}14`
  },
  pillTx: { fontSize: mobileFontSize.sm, color: mobileColors.textSecondary },
  pillTxOn: { color: mobileColors.accent, fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing.sm,
    paddingVertical: mobileSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border
  },
  rowBody: { flex: 1 },
  rowTitle: {
    ...mobileTypography.body,
    fontWeight: "600",
    color: mobileColors.textPrimary
  },
  rowMeta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  vacBtn: {
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 6,
    borderRadius: mobileRadius.sm,
    backgroundColor: `${mobileColors.accent}18`
  },
  vacBtnTx: { fontSize: mobileFontSize.sm, fontWeight: "700", color: mobileColors.accent },
  empty: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm
  },
  err: { color: mobileColors.error }
});
