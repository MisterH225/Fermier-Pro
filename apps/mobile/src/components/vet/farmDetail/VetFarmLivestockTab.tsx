import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { LineTrend } from "../charts";
import { VetEmptyState } from "./VetEmptyState";
import { VetReadingCard } from "./VetReadingCard";
import type { VetFarmSummaryDto, VetStatusLevel } from "../../../lib/api/vet";
import type { RootStackParamList } from "../../../types/navigation";
import {
  vetColors,
  vetRadius,
  vetShadow,
  vetStatus,
  vetType
} from "../../../theme/vetTheme";
import { mobileSpacing, mobileRadius, mobileFontSize } from "../../../theme/mobileTheme";


type Props = {
  farmId: string;
  farmName: string;
  summary: VetFarmSummaryDto | undefined;
  summaryLoading?: boolean;
};

function weekShort(weekKey: string): string {
  const parts = weekKey.split("-W");
  return parts[1] ? `S${parts[1]}` : weekKey;
}

function statusToken(status: VetStatusLevel) {
  return vetStatus[status];
}

export function VetFarmLivestockTab({
  farmId,
  farmName,
  summary,
  summaryLoading
}: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const gmqPoints = useMemo(() => {
    const weeks = summary?.gmqWeekly?.weeks;
    if (!weeks) {
      return [];
    }
    return weeks.map((w) => ({
      key: w.week,
      label: weekShort(w.week),
      value: w.avgGmq
    }));
  }, [summary?.gmqWeekly?.weeks]);

  if (summaryLoading && !summary) {
    return <ActivityIndicator color={vetColors.primary} />;
  }

  const ls = summary?.livestock;
  const batches = summary?.batches ?? [];
  const targetGmq = summary?.gmqWeekly?.targetGmq ?? null;

  const kpis = [
    {
      key: "head",
      label: t("vet.farmDetail.livestockKpis.headcount"),
      value:
        ls?.activeHeadcount != null ? String(ls.activeHeadcount) : "—"
    },
    {
      key: "batches",
      label: t("vet.farmDetail.livestockKpis.batches"),
      value:
        ls?.activeBatchesCount != null
          ? String(ls.activeBatchesCount)
          : "—"
    },
    {
      key: "gmq30",
      label: t("vet.farmDetail.livestockKpis.gmq30d"),
      value:
        ls?.avgGmq30d != null
          ? t("vet.farmDetail.avgGmqValue", { g: ls.avgGmq30d })
          : "—"
    },
    {
      key: "fcr",
      label: t("vet.farmDetail.livestockKpis.feedConversion"),
      value:
        ls?.feedConversionIndex != null
          ? String(ls.feedConversionIndex)
          : "—"
    }
  ];

  return (
    <View style={styles.block}>
      <View style={styles.kpiRow}>
        {kpis.map((k) => (
          <View key={k.key} style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{k.value}</Text>
            <Text style={styles.kpiLabel}>{k.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          {t("vet.farmDetail.gmqChart.title")}
        </Text>
        <LineTrend
          points={gmqPoints}
          target={targetGmq}
          emptyLabel={t("vet.farmDetail.gmqChart.empty")}
          targetLabel={t("vet.farmDetail.gmqChart.target")}
        />
      </View>

      <Text style={styles.sectionTitle}>
        {t("vet.farmDetail.batchPerf.title")}
      </Text>
      {batches.length === 0 ? (
        <VetEmptyState
          icon="layers-outline"
          message={t("vet.farmDetail.batchPerf.empty")}
        />
      ) : (
        batches.map((b) => {
          const tok = statusToken(b.status);
          const pct =
            b.avgGmq != null && b.targetGmq != null && b.targetGmq > 0
              ? Math.round((b.avgGmq / b.targetGmq) * 100)
              : null;
          const barPct = Math.max(0, Math.min(100, pct ?? 0));
          const gmqColor =
            b.status === "alert"
              ? vetStatus.alert.fg
              : b.status === "watch"
                ? vetStatus.watch.fg
                : vetStatus.ok.fg;

          return (
            <Pressable
              key={b.id}
              style={styles.batchCard}
              onPress={() =>
                navigation.navigate("BatchDetail", {
                  farmId,
                  farmName,
                  batchId: b.id,
                  batchName: b.name
                })
              }
              accessibilityRole="button"
              accessibilityLabel={t("vet.farmDetail.batchPerf.openDetail")}
            >
              <View style={styles.batchHead}>
                <Text style={styles.batchName}>{b.name}</Text>
                <View
                  style={[styles.statusPill, { backgroundColor: tok.bg }]}
                >
                  <Ionicons name={tok.icon} size={12} color={tok.fg} />
                  <Text style={[styles.statusTx, { color: tok.fg }]}>
                    {t(`vet.farmDetail.batchPerf.status.${b.status}`)}
                  </Text>
                </View>
              </View>
              <Text style={styles.batchMeta}>
                {b.stage ?? "—"}
                {" · "}
                {b.headcount}{" "}
                {b.ageWeeks != null ? `· ${b.ageWeeks} sem.` : ""}
              </Text>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${barPct}%`,
                      backgroundColor: gmqColor
                    }
                  ]}
                />
              </View>
              <View style={styles.batchFoot}>
                <Text style={[styles.gmqTx, { color: gmqColor }]}>
                  {b.avgGmq != null
                    ? t("vet.farmDetail.batchPerf.gmq", { g: b.avgGmq })
                    : "—"}
                  {pct != null
                    ? ` · ${t("vet.farmDetail.batchPerf.vsTarget", { pct })}`
                    : ""}
                </Text>
                {b.activeCases > 0 ? (
                  <Text style={styles.casesTx}>
                    {t("vet.farmDetail.batchPerf.cases", {
                      count: b.activeCases
                    })}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })
      )}

      <Text style={styles.readonlyHint}>
        {t("vet.farmDetail.livestockReadonly")}
      </Text>

      <VetReadingCard
        reading={summary?.readings?.livestock}
        farmId={farmId}
        farmName={farmName}
        batchName={
          batches.find((b) => b.id === summary?.readings?.livestock?.batchId)
            ?.name
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: mobileSpacing.sm },
  kpiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.sm
  },
  kpiCard: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: vetColors.cardBg,
    borderRadius: vetRadius.card,
    padding: mobileSpacing.md,
    gap: 4,
    ...vetShadow.soft
  },
  kpiValue: { ...vetType.figureSm },
  kpiLabel: { ...vetType.label },
  card: {
    backgroundColor: vetColors.cardBg,
    borderRadius: vetRadius.card,
    padding: mobileSpacing.lg,
    gap: mobileSpacing.sm,
    ...vetShadow.card
  },
  sectionTitle: { ...vetType.title },
  batchCard: {
    backgroundColor: vetColors.cardBg,
    borderRadius: vetRadius.card,
    padding: mobileSpacing.md,
    gap: 6,
    ...vetShadow.soft
  },
  batchHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8
  },
  batchName: { ...vetType.title, flex: 1 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: vetRadius.pill
  },
  statusTx: { fontSize: mobileFontSize.xs, fontWeight: "700" },
  batchMeta: { ...vetType.label },
  track: {
    height: 8,
    borderRadius: mobileRadius.pill,
    backgroundColor: vetColors.primaryLight,
    overflow: "hidden"
  },
  fill: { height: "100%", borderRadius: mobileRadius.pill },
  batchFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  gmqTx: { fontWeight: "700", fontSize: mobileFontSize.sm },
  casesTx: { ...vetType.label, color: vetColors.danger },
  readonlyHint: { ...vetType.label, textAlign: "center", marginTop: 4 }
});
