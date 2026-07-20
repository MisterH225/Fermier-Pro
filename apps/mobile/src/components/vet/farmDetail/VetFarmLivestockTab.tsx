import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { InfoRow, SectionHeader, vetPalette } from "../../common";
import { useSession } from "../../../context/SessionContext";
import {
  fetchFarmBatches,
  fetchFarmCheptelOverview,
  type VetFarmSummaryDto
} from "../../../lib/api";
import { vetColors, vetRadius } from "../../../theme/vetTheme";
import { mobileSpacing, mobileTypography } from "../../../theme/mobileTheme";

type Props = {
  farmId: string;
  summary: VetFarmSummaryDto | undefined;
};

export function VetFarmLivestockTab({ farmId, summary }: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();

  const cheptelQ = useQuery({
    queryKey: ["vetFarmCheptel", farmId, activeProfileId],
    queryFn: () =>
      fetchFarmCheptelOverview(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const batchesQ = useQuery({
    queryKey: ["vetFarmBatchesList", farmId, activeProfileId],
    queryFn: () => fetchFarmBatches(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const avgGmq = summary?.livestock.avgGmqGPerDay ?? null;

  const headcount =
    summary?.livestock.activeHeadcount ??
    cheptelQ.data?.kpis.totalHeadcount ??
    null;
  const batchesCount =
    summary?.livestock.activeBatchesCount ??
    cheptelQ.data?.kpis.activeBatchesCount ??
    null;

  const batches = (batchesQ.data ?? []).filter(
    (b) => b.status === "active" || !b.closedAt
  );

  if (cheptelQ.isLoading && batchesQ.isLoading) {
    return <ActivityIndicator color={vetColors.primary} />;
  }

  return (
    <View style={styles.block}>
      <View style={styles.card}>
        <InfoRow
          label={t("vet.farmDetail.headcount")}
          value={headcount != null ? String(headcount) : "—"}
          palette={vetPalette}
        />
        <InfoRow
          label={t("vet.farmDetail.batches")}
          value={batchesCount != null ? String(batchesCount) : "—"}
          palette={vetPalette}
        />
        <InfoRow
          label={t("vet.farmDetail.avgGmq")}
          value={
            avgGmq != null
              ? t("vet.farmDetail.avgGmqValue", { g: avgGmq })
              : t("vet.farmDetail.avgGmqNone")
          }
          palette={vetPalette}
        />
        <Text style={styles.readonlyHint}>
          {t("vet.farmDetail.livestockReadonly")}
        </Text>
      </View>

      <SectionHeader
        label={t("vet.farmDetail.batchesList")}
        palette={vetPalette}
      />
      {batchesQ.isLoading ? (
        <ActivityIndicator color={vetColors.primary} />
      ) : batches.length === 0 ? (
        <Text style={styles.empty}>{t("vet.farmDetail.noBatches")}</Text>
      ) : (
        batches.slice(0, 12).map((b) => (
          <View key={b.id} style={styles.listCard}>
            <Text style={styles.listTitle}>{b.name}</Text>
            <Text style={styles.listMeta}>
              {t("vet.farmDetail.batchMeta", {
                head: b.activeMemberCount ?? b.headcount,
                breed: b.breed?.name ?? b.species.name
              })}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: mobileSpacing.sm },
  card: {
    backgroundColor: vetColors.cardBg,
    borderRadius: vetRadius.card,
    padding: mobileSpacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: vetColors.border,
    gap: mobileSpacing.md
  },
  listCard: {
    backgroundColor: vetColors.cardBg,
    borderRadius: vetRadius.button,
    padding: mobileSpacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: vetColors.border,
    gap: 2
  },
  listTitle: { fontWeight: "600", color: vetColors.textPrimary },
  listMeta: { ...mobileTypography.meta, color: vetColors.textSecondary },
  empty: { color: vetColors.textSecondary },
  readonlyHint: {
    ...mobileTypography.meta,
    color: vetColors.textMuted
  }
});
