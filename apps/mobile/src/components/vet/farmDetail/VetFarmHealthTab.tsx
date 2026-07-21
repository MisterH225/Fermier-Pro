import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { DiseaseModal } from "../../shared/DiseaseModal";
import { InfoRow, SectionHeader, vetPalette } from "../../common";
import { BarTrend } from "../charts";
import { HealthStatusBanner } from "./HealthStatusBanner";
import { HealthTimeline } from "./HealthTimeline";
import { useSession } from "../../../context/SessionContext";
import {
  fetchFarmActiveDiseaseCases,
  fetchFarmAnimals,
  fetchFarmBatches,
  fetchFarmVaccineCoverage,
  type VetFarmSummaryDto
} from "../../../lib/api";
import { vetColors, vetRadius, vetShadow, vetType } from "../../../theme/vetTheme";
import { mobileSpacing } from "../../../theme/mobileTheme";

type Props = {
  farmId: string;
  summary: VetFarmSummaryDto | undefined;
  summaryLoading: boolean;
  locale: string;
};

function monthShort(monthKey: string, locale: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) {
    return monthKey;
  }
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(locale, {
    month: "short"
  });
}

export function VetFarmHealthTab({
  farmId,
  summary,
  summaryLoading,
  locale
}: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const qc = useQueryClient();
  const [declareOpen, setDeclareOpen] = useState(false);

  const activeCasesQ = useQuery({
    queryKey: ["vetFarmActiveDiseases", farmId, activeProfileId],
    queryFn: () =>
      fetchFarmActiveDiseaseCases(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const coverageQ = useQuery({
    queryKey: ["vetFarmVaccineCoverage", farmId, activeProfileId],
    queryFn: () =>
      fetchFarmVaccineCoverage(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const animalsQ = useQuery({
    queryKey: ["vetFarmAnimals", farmId, activeProfileId],
    queryFn: () => fetchFarmAnimals(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken && declareOpen)
  });

  const batchesQ = useQuery({
    queryKey: ["vetFarmBatches", farmId, activeProfileId],
    queryFn: () => fetchFarmBatches(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken && declareOpen)
  });

  const coveragePct =
    summary?.vaccineCoveragePercent ??
    (coverageQ.data?.items.length
      ? Math.round(
          coverageQ.data.items.reduce(
            (a, i) => a + i.stats.coverageRate,
            0
          ) / coverageQ.data.items.length
        )
      : null);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, {
      day: "numeric",
      month: "short"
    });

  const mortalityPoints = useMemo(() => {
    const series = summary?.mortalityMonthly;
    if (!series || series.length === 0) {
      return [];
    }
    const peak = Math.max(...series.map((m) => m.count));
    return series.map((m) => ({
      key: m.month,
      label: monthShort(m.month, locale),
      value: m.count,
      highlight: peak > 0 && m.count === peak
    }));
  }, [summary?.mortalityMonthly, locale]);

  const peakHint = useMemo(() => {
    const peak = mortalityPoints.find((p) => p.highlight);
    if (!peak || peak.value <= 0) {
      return null;
    }
    return t("vet.farmDetail.mortality.peakHint", {
      month: peak.label,
      count: peak.value
    });
  }, [mortalityPoints, t]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["vetFarmActiveDiseases", farmId] });
    void qc.invalidateQueries({ queryKey: ["vetFarmSummary", farmId] });
    void qc.invalidateQueries({ queryKey: ["vetFarmHealth", farmId] });
  };

  if (summaryLoading && !summary) {
    return <ActivityIndicator color={vetColors.primary} />;
  }

  const health = summary?.health;
  const activeCases = activeCasesQ.data ?? [];

  return (
    <View style={styles.block}>
      <HealthStatusBanner
        globalHealthStatus={health?.globalHealthStatus}
        activeDiseaseCount={health?.activeDiseaseCount ?? 0}
      />

      {(health?.activeDiseaseCount ?? 0) > 0 ? (
        <View style={styles.alertCard}>
          <Text style={styles.alertTitle}>
            {t("vet.farmDetail.activeAlertTitle", {
              count: health?.activeDiseaseCount ?? 0
            })}
          </Text>
          <Text style={styles.alertMeta}>
            {t("vet.farmDetail.activeAlertBody")}
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          {t("vet.farmDetail.mortality.title")}
        </Text>
        <BarTrend
          points={mortalityPoints}
          emptyLabel={t("vet.farmDetail.mortality.empty")}
          peakHint={peakHint}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.gaugeRow}>
          <Text style={styles.gaugeLabel}>
            {t("vet.farmDetail.vaccineCoverage")}
          </Text>
          <Text style={styles.gaugePct}>
            {coveragePct != null ? `${coveragePct}%` : "—"}
          </Text>
        </View>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${Math.max(0, Math.min(100, coveragePct ?? 0))}%` }
            ]}
          />
        </View>
        {coverageQ.data?.items[0] ? (
          <Text style={styles.hint}>
            {t("vet.farmDetail.vaccineCoverageHint", {
              name: coverageQ.data.items[0].vaccine.name,
              overdue: coverageQ.data.items[0].stats.overdue
            })}
          </Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <InfoRow
          label={t("vet.farmDetail.lastVisit")}
          value={
            summary?.lastVisit
              ? `${formatDate(summary.lastVisit.at)} · ${summary.lastVisit.label}`
              : "—"
          }
          palette={vetPalette}
        />
        <InfoRow
          label={t("vet.farmDetail.overdueVaccines")}
          value={String(health?.overdueVaccineCount ?? "—")}
          palette={vetPalette}
        />
        <InfoRow
          label={t("vet.farmDetail.mortality30d")}
          value={
            health?.mortalityRate30d != null
              ? `${(Number(health.mortalityRate30d) * 100).toFixed(1)} %`
              : "—"
          }
          palette={vetPalette}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          {t("vet.farmDetail.timeline.title")}
        </Text>
        <HealthTimeline
          items={summary?.healthTimeline}
          locale={locale}
        />
      </View>

      <SectionHeader
        label={t("vet.farmDetail.recentCases")}
        palette={vetPalette}
      />
      {activeCasesQ.isLoading ? (
        <ActivityIndicator color={vetColors.primary} />
      ) : activeCases.length === 0 ? (
        <Text style={styles.empty}>{t("vet.farmDetail.noCases")}</Text>
      ) : (
        activeCases.slice(0, 8).map((d) => (
          <View key={d.id} style={styles.listCard}>
            <Text style={styles.listTitle}>
              {d.disease?.diagnosis ?? t("vet.farmDetail.caseFallback")}
            </Text>
            <Text style={styles.listMeta}>
              {formatDate(d.occurredAt)}
              {d.disease?.severity ? ` · ${d.disease.severity}` : ""}
            </Text>
          </View>
        ))
      )}

      <Pressable style={styles.btn} onPress={() => setDeclareOpen(true)}>
        <Text style={styles.btnTx}>{t("vet.farmDetail.declareCase")}</Text>
      </Pressable>

      {accessToken ? (
        <DiseaseModal
          visible={declareOpen}
          farmId={farmId}
          accessToken={accessToken}
          activeProfileId={activeProfileId}
          animals={animalsQ.data ?? []}
          batches={batchesQ.data ?? []}
          onClose={() => setDeclareOpen(false)}
          onSuccess={() => {
            setDeclareOpen(false);
            invalidate();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: mobileSpacing.sm },
  alertCard: {
    backgroundColor: vetColors.kpiRose,
    borderRadius: vetRadius.card,
    padding: mobileSpacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: vetColors.danger,
    gap: 4,
    ...vetShadow.soft
  },
  alertTitle: {
    fontWeight: "700",
    fontSize: 13,
    color: vetColors.textPrimary
  },
  alertMeta: { ...vetType.label },
  card: {
    backgroundColor: vetColors.cardBg,
    borderRadius: vetRadius.card,
    padding: mobileSpacing.lg,
    gap: mobileSpacing.sm,
    ...vetShadow.card
  },
  sectionTitle: { ...vetType.title },
  gaugeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  gaugeLabel: { ...vetType.title },
  gaugePct: { ...vetType.figureSm, color: vetColors.success },
  track: {
    height: 8,
    borderRadius: 99,
    backgroundColor: vetColors.primaryLight,
    overflow: "hidden"
  },
  fill: {
    height: "100%",
    borderRadius: 99,
    backgroundColor: vetColors.primary
  },
  hint: { ...vetType.label, color: vetColors.textMuted },
  listCard: {
    backgroundColor: vetColors.cardBg,
    borderRadius: vetRadius.button,
    padding: mobileSpacing.md,
    gap: 2,
    ...vetShadow.soft
  },
  listTitle: { fontWeight: "600", color: vetColors.textPrimary },
  listMeta: { ...vetType.label },
  empty: { color: vetColors.textSecondary },
  btn: {
    backgroundColor: vetColors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: mobileSpacing.sm
  },
  btnTx: { color: vetColors.onPrimary, fontWeight: "700", fontSize: 13 }
});
