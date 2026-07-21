import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { VetEmptyState } from "./VetEmptyState";
import { VetReadingCard } from "./VetReadingCard";
import type { VetFarmSummaryDto, VetStatusLevel } from "../../../lib/api/vet";
import {
  vetColors,
  vetRadius,
  vetShadow,
  vetStatus,
  vetType
} from "../../../theme/vetTheme";
import { mobileSpacing, mobileFontSize } from "../../../theme/mobileTheme";

type Props = {
  farmId: string;
  farmName: string;
  summary: VetFarmSummaryDto | undefined;
  summaryLoading?: boolean;
  locale: string;
};

function fmtNull(v: number | null | undefined, suffix = ""): string {
  if (v == null) {
    return "—";
  }
  return `${v}${suffix}`;
}

export function VetFarmReproTab({
  farmId,
  farmName,
  summary,
  summaryLoading,
  locale
}: Props) {
  const { t } = useTranslation();

  if (summaryLoading && !summary) {
    return <ActivityIndicator color={vetColors.primary} />;
  }

  const repro = summary?.reproduction;
  const bio = summary?.biosecurity;
  const upcoming = repro?.upcomingFarrowings ?? [];
  const barns = bio?.barns ?? [];
  const quarantine = bio?.quarantineCompliance ?? null;

  const kpis = [
    {
      key: "sows",
      label: t("vet.farmDetail.repro.activeSows"),
      value: fmtNull(repro?.activeSows)
    },
    {
      key: "gest",
      label: t("vet.farmDetail.repro.gestations"),
      value: fmtNull(repro?.ongoingGestations)
    },
    {
      key: "born",
      label: t("vet.farmDetail.repro.avgBornAlive"),
      value: fmtNull(repro?.avgBornAlive)
    },
    {
      key: "suck",
      label: t("vet.farmDetail.repro.sucklingMortality"),
      value: fmtNull(repro?.sucklingMortalityPercent, " %")
    }
  ];

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, {
      day: "numeric",
      month: "short"
    });

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

      <Text style={styles.sectionTitle}>
        {t("vet.farmDetail.repro.upcomingTitle")}
      </Text>
      {upcoming.length === 0 ? (
        <VetEmptyState
          icon="calendar-outline"
          message={t("vet.farmDetail.repro.upcomingEmpty")}
        />
      ) : (
        upcoming.map((f) => {
          const imminent = f.daysRemaining <= 7;
          return (
            <View key={f.gestationId} style={styles.listCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.listTitle}>{f.sowLabel}</Text>
                {imminent ? (
                  <View style={styles.imminentPill}>
                    <Ionicons
                      name="flash"
                      size={12}
                      color={vetStatus.alert.fg}
                    />
                    <Text style={styles.imminentTx}>
                      {t("vet.farmDetail.repro.imminent")}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.daysTx}>
                    {t("vet.farmDetail.repro.days", {
                      n: f.daysRemaining
                    })}
                  </Text>
                )}
              </View>
              <Text style={styles.listMeta}>
                {formatDate(f.expectedBirthDate)}
              </Text>
            </View>
          );
        })
      )}

      <Text style={styles.sectionTitle}>
        {t("vet.farmDetail.repro.biosecurityTitle")}
      </Text>
      {barns.length === 0 ? (
        <VetEmptyState
          icon="home-outline"
          message={t("vet.farmDetail.repro.biosecurityEmpty")}
        />
      ) : (
        barns.map((barn) => {
          const tok = vetStatus[barn.status as VetStatusLevel];
          return (
            <View key={barn.name} style={styles.listCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.listTitle}>{barn.name}</Text>
                <View style={[styles.statusPill, { backgroundColor: tok.bg }]}>
                  <Ionicons name={tok.icon} size={12} color={tok.fg} />
                  <Text style={[styles.statusTx, { color: tok.fg }]}>
                    {t(`vet.farmDetail.repro.barnStatus.${barn.status}`)}
                  </Text>
                </View>
              </View>
              <Text style={styles.listMeta}>
                {barn.densitySqmPerPig != null
                  ? t("vet.farmDetail.repro.densityValue", {
                      v: barn.densitySqmPerPig
                    })
                  : t("vet.farmDetail.repro.densityUnknown")}
                {barn.thresholdSqm != null
                  ? ` · ${t("vet.farmDetail.repro.threshold", {
                      v: barn.thresholdSqm
                    })}`
                  : ""}
              </Text>
            </View>
          );
        })
      )}

      <Text style={styles.sectionTitle}>
        {t("vet.farmDetail.repro.quarantineTitle")}
      </Text>
      {quarantine == null ? (
        <VetEmptyState
          icon="shield-outline"
          message={t("vet.farmDetail.repro.quarantineEmpty")}
        />
      ) : (
        <View style={styles.listCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.listTitle}>{quarantine.penName}</Text>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor:
                    quarantine.status === "compliant"
                      ? vetStatus.ok.bg
                      : quarantine.status === "pending"
                        ? vetStatus.watch.bg
                        : vetStatus.alert.bg
                }
              ]}
            >
              <Ionicons
                name={
                  quarantine.status === "compliant"
                    ? vetStatus.ok.icon
                    : quarantine.status === "pending"
                      ? vetStatus.watch.icon
                      : vetStatus.alert.icon
                }
                size={12}
                color={
                  quarantine.status === "compliant"
                    ? vetStatus.ok.fg
                    : quarantine.status === "pending"
                      ? vetStatus.watch.fg
                      : vetStatus.alert.fg
                }
              />
              <Text
                style={[
                  styles.statusTx,
                  {
                    color:
                      quarantine.status === "compliant"
                        ? vetStatus.ok.fg
                        : quarantine.status === "pending"
                          ? vetStatus.watch.fg
                          : vetStatus.alert.fg
                  }
                ]}
              >
                {t(
                  `vet.farmDetail.repro.quarantineStatus.${quarantine.status}`
                )}
              </Text>
            </View>
          </View>
          <Text style={styles.listMeta}>
            {t("vet.farmDetail.repro.quarantineMeta", {
              pen: quarantine.penName,
              days: quarantine.daysElapsed,
              min: quarantine.minDaysRequired
            })}
            {" · "}
            {formatDate(quarantine.lastEntryAt)}
          </Text>
        </View>
      )}

      <VetReadingCard
        reading={summary?.readings?.repro}
        farmId={farmId}
        farmName={farmName}
        batchName={
          summary?.batches?.find(
            (b) => b.id === summary?.readings?.repro?.batchId
          )?.name
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
  sectionTitle: { ...vetType.title, marginTop: 4 },
  listCard: {
    backgroundColor: vetColors.cardBg,
    borderRadius: vetRadius.card,
    padding: mobileSpacing.md,
    gap: 4,
    ...vetShadow.soft
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8
  },
  listTitle: { ...vetType.title, flex: 1 },
  listMeta: { ...vetType.label },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: vetRadius.pill
  },
  statusTx: { fontSize: mobileFontSize.xs, fontWeight: "700" },
  imminentPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: vetRadius.pill,
    backgroundColor: vetStatus.alert.bg
  },
  imminentTx: {
    fontSize: mobileFontSize.xs,
    fontWeight: "700",
    color: vetStatus.alert.fg
  },
  daysTx: { ...vetType.label, fontWeight: "700", color: vetColors.primary }
});
