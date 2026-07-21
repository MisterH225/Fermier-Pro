import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SmartChart, type SmartChartPeriod } from "../../charts";
import {
  fetchCheptelGmqSummary,
  fetchCheptelWeightSeries,
  fetchDetectedBatches,
  fetchFarmAnimals
} from "../../../lib/api";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../../theme/mobileTheme";
import { AddWeightModal } from "./AddWeightModal";
import { ConfirmDetectedBatchModal } from "./ConfirmDetectedBatchModal";
import { GMQCard } from "./GMQCard";
import type { DetectedBatchDto } from "../../../lib/api";

type Props = {
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  readOnly?: boolean;
};

export function CheptelWeightTab({ farmId, accessToken, activeProfileId, readOnly = false }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";
  const [period, setPeriod] = useState<SmartChartPeriod>("6M");
  const [animalId, setAnimalId] = useState<string | undefined>(undefined);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmBatch, setConfirmBatch] = useState<DetectedBatchDto | null>(null);

  const months = period === "3M" ? 3 : period === "6M" ? 6 : 12;

  const animalsQuery = useQuery({
    queryKey: ["farmAnimals", farmId, activeProfileId],
    queryFn: () => fetchFarmAnimals(accessToken, farmId, activeProfileId)
  });

  const seriesQuery = useQuery({
    queryKey: ["cheptelWeightSeries", farmId, activeProfileId, animalId, months],
    queryFn: () =>
      fetchCheptelWeightSeries(accessToken, farmId, activeProfileId, {
        animalId,
        months
      })
  });

  const gmqQuery = useQuery({
    queryKey: ["cheptelGmq", farmId, activeProfileId],
    queryFn: () => fetchCheptelGmqSummary(accessToken, farmId, activeProfileId)
  });

  const batchesQ = useQuery({
    queryKey: ["detectedBatches", farmId, activeProfileId],
    queryFn: () => fetchDetectedBatches(accessToken, farmId, activeProfileId)
  });

  const chartLines = useMemo(() => {
    const points = seriesQuery.data ?? [];
    const byMonth = new Map<string, number[]>();
    for (const p of points) {
      const d = new Date(p.measuredAt);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const arr = byMonth.get(key) ?? [];
      arr.push(p.weightKg);
      byMonth.set(key, arr);
    }
    const data = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, vals]) => ({
        month,
        value: vals.reduce((a, b) => a + b, 0) / vals.length
      }));
    return [
      {
        key: "weight",
        label: t("cheptel.weight.chartLabel"),
        color: mobileColors.accent,
        data
      }
    ];
  }, [seriesQuery.data, t]);

  const animals = animalsQuery.data ?? [];
  const gmqRows = gmqQuery.data?.animals ?? [];

  return (
    <View>
      {!readOnly ? (
        <View style={styles.toolbar}>
          <Pressable onPress={() => setAddOpen(true)} style={styles.settingsBtn}>
            <Text style={styles.settingsTx}>＋ {t("cheptel.weight.addShort")}</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.animalPills}>
        <Pressable
          style={[styles.pill, !animalId && styles.pillOn]}
          onPress={() => setAnimalId(undefined)}
        >
          <Text style={[styles.pillTx, !animalId && styles.pillTxOn]}>
            {t("cheptel.weight.allAnimals")}
          </Text>
        </Pressable>
        {animals
          .filter((a) => a.status === "active")
          .slice(0, 24)
          .map((a) => (
            <Pressable
              key={a.id}
              style={[styles.pill, animalId === a.id && styles.pillOn]}
              onPress={() => setAnimalId(a.id)}
            >
              <Text style={[styles.pillTx, animalId === a.id && styles.pillTxOn]}>
                {a.tagCode ?? a.publicId.slice(0, 8)}
              </Text>
            </Pressable>
          ))}
      </ScrollView>

      {seriesQuery.isPending ? (
        <ActivityIndicator color={mobileColors.accent} />
      ) : (
        <SmartChart
          lines={chartLines}
          period={period}
          onPeriodChange={setPeriod}
          unit="kg"
          monthLabel={(m) => {
            const [y, mo] = m.split("-").map(Number);
            return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString(locale, {
              month: "short"
            });
          }}
          emptyLabel={t("cheptel.weight.noChart")}
        />
      )}

      {(batchesQ.data?.batches?.length ?? 0) > 0 ? (
        <>
          <Text style={styles.sectionTitle}>{t("cheptel.batches.detectedTitle")}</Text>
          {(batchesQ.data?.batches ?? []).map((b) => {
            const labels = (b.animals ?? [])
              .map((a) => a.label)
              .slice(0, 6)
              .join(", ");
            const more =
              (b.animals?.length ?? b.animalIds.length) > 6
                ? ` +${(b.animals?.length ?? b.animalIds.length) - 6}`
                : "";
            return (
              <View key={b.id} style={styles.batchCard}>
                <View style={styles.batchHeader}>
                  <Text style={styles.batchName}>{b.name}</Text>
                  {!readOnly ? (
                    <View style={styles.batchActions}>
                      <Pressable
                        style={styles.editBtn}
                        onPress={() => setConfirmBatch(b)}
                      >
                        <Text style={styles.editBtnTx}>
                          {t("cheptel.batches.editAction")}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={styles.confirmBtn}
                        onPress={() => setConfirmBatch(b)}
                      >
                        <Text style={styles.confirmBtnTx}>
                          {t("cheptel.batches.confirmAction")}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.batchMeta}>
                  {b.headcount} {t("health.diseases.unitSubjects")}
                  {b.generationLabel
                    ? ` · ${t("cheptel.batches.generation")}: ${b.generationLabel}`
                    : ""}
                  {b.avgAgeWeeks != null
                    ? ` · ${b.avgAgeWeeks} ${t("cheptel.weight.weeksAbbr")}`
                    : ""}
                  {b.avgWeightKg != null ? ` · ${b.avgWeightKg} kg` : ""}
                </Text>
                {labels ? (
                  <Text style={styles.batchMeta} numberOfLines={2}>
                    {labels}
                    {more}
                  </Text>
                ) : null}
                {b.penNames.length > 0 ? (
                  <Text style={styles.batchMeta}>{b.penNames.join(", ")}</Text>
                ) : null}
              </View>
            );
          })}
        </>
      ) : null}

      <Text style={styles.sectionTitle}>{t("cheptel.weight.gmqSection")}</Text>
      {gmqQuery.isPending ? (
        <ActivityIndicator color={mobileColors.accent} />
      ) : gmqRows.length === 0 ? (
        <Text style={styles.empty}>{t("cheptel.weight.noGmq")}</Text>
      ) : (
        gmqRows.slice(0, 12).map((row) => <GMQCard key={row.animalId} row={row} />)
      )}

      {!readOnly ? (
      <ConfirmDetectedBatchModal
        visible={confirmBatch != null}
        batch={confirmBatch}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        onClose={() => setConfirmBatch(null)}
        onConfirmed={() => {
          void batchesQ.refetch();
        }}
      />
      ) : null}

      {!readOnly ? (
      <AddWeightModal
        visible={addOpen}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        preselectedAnimalId={animalId ?? null}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          void seriesQuery.refetch();
          void gmqQuery.refetch();
        }}
      />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 8 },
  settingsBtn: { padding: 8 },
  settingsTx: { color: mobileColors.accent, fontWeight: "600" },
  animalPills: { marginBottom: mobileSpacing.md, maxHeight: 44 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  pillOn: { borderColor: mobileColors.accent, backgroundColor: mobileColors.accentSoft },
  pillTx: { ...mobileTypography.meta },
  pillTxOn: { color: mobileColors.accent, fontWeight: "700" },
  sectionTitle: {
    ...mobileTypography.body,
    fontWeight: "700",
    marginTop: mobileSpacing.lg,
    marginBottom: mobileSpacing.sm
  },
  empty: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  batchCard: {
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.sm
  },
  batchHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing.sm
  },
  batchName: { fontWeight: "700", color: mobileColors.textPrimary, flex: 1 },
  batchActions: { flexDirection: "row", gap: 6, alignItems: "center" },
  editBtn: {
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: mobileColors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  editBtnTx: {
    color: mobileColors.accent,
    fontWeight: "700",
    fontSize: mobileFontSize.sm
  },
  confirmBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  confirmBtnTx: {
    color: mobileColors.onAccent,
    fontWeight: "700",
    fontSize: mobileFontSize.sm
  },
  batchMeta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 4
  }
});
