import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BaseModal } from "../modals/BaseModal";
import { EventList, type EventItem } from "../lists";
import { useSession } from "../../context/SessionContext";
import {
  fetchFarmReportById,
  fetchFarmReportPreview,
  fetchFarmReportsList,
  type FarmReportListItemDto,
  type FarmReportPeriodType,
  type FarmReportPreviewDto
} from "../../lib/api";
import { CheptelSummary } from "./CheptelSummary";
import { ExportPDFButton } from "./ExportPDFButton";
import { FarmScoreGauge } from "./FarmScoreGauge";
import { FeedSummary } from "./FeedSummary";
import { FinanceSummary } from "./FinanceSummary";
import { GestationSummary } from "./GestationSummary";
import { HealthSummary } from "./HealthSummary";
import { PeriodSelector, type ReportAnchorState } from "./PeriodSelector";
import { ProjectionSummary } from "./ProjectionSummary";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

function utcAnchor(): ReportAnchorState {
  const d = new Date();
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    quarter: Math.floor(d.getUTCMonth() / 3) + 1
  };
}

function ReportHistoryBody({
  reportId,
  accessToken,
  activeProfileId
}: {
  reportId: string;
  accessToken: string;
  activeProfileId: string | null | undefined;
}) {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["farmReportDetail", reportId, activeProfileId],
    queryFn: () => fetchFarmReportById(accessToken, reportId, activeProfileId)
  });
  if (q.isLoading) {
    return (
      <Text style={styles.modalMuted}>{t("reportsScreen.loadingDetail")}</Text>
    );
  }
  if (q.isError || !q.data) {
    return (
      <Text style={styles.modalMuted}>{t("reportsScreen.detailError")}</Text>
    );
  }
  const snap = q.data.dataSnapshot as {
    score?: { global: number; band: string };
  };
  return (
    <View style={{ gap: mobileSpacing.sm }}>
      <Text style={styles.modalLine}>
        {t("reportsScreen.detailScore")}: {snap.score?.global ?? q.data.scoreGlobal} —{" "}
        {snap.score?.band ?? "—"}
      </Text>
      <Text style={styles.modalMuted}>{t("reportsScreen.detailHash")}</Text>
      <Text style={styles.modalMono}>{q.data.contentHash ?? "—"}</Text>
    </View>
  );
}

export function ReportScreen({
  farmId,
  farmName
}: {
  farmId: string;
  farmName: string;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { accessToken, activeProfileId } = useSession();
  const [periodType, setPeriodType] = useState<FarmReportPeriodType>("monthly");
  const [anchor, setAnchor] = useState<ReportAnchorState>(() => utcAnchor());
  const [scoreModal, setScoreModal] = useState(false);

  const previewParams = useMemo(() => {
    const p: {
      periodType: FarmReportPeriodType;
      year: number;
      month?: number;
      quarter?: number;
    } = { periodType, year: anchor.year };
    if (periodType === "monthly") {
      p.month = anchor.month;
    }
    if (periodType === "quarterly") {
      p.quarter = anchor.quarter;
    }
    return p;
  }, [periodType, anchor]);

  const previewQ = useQuery({
    queryKey: ["farmReportPreview", farmId, activeProfileId, previewParams],
    queryFn: () =>
      fetchFarmReportPreview(accessToken!, farmId, activeProfileId, previewParams),
    enabled: Boolean(accessToken && farmId)
  });

  const listQ = useQuery({
    queryKey: ["farmReportsList", farmId, activeProfileId],
    queryFn: () => fetchFarmReportsList(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken && farmId)
  });

  const onRefresh = useCallback(async () => {
    await Promise.all([previewQ.refetch(), listQ.refetch()]);
  }, [previewQ, listQ]);

  const historyItems: EventItem[] = useMemo(() => {
    const rows = listQ.data ?? [];
    return rows.map((r: FarmReportListItemDto) => ({
      id: r.id,
      title: `${r.periodType}`,
      subtitle: `${r.periodStart.slice(0, 10)} → ${r.periodEnd.slice(0, 10)}`,
      value: String(r.scoreGlobal),
      valueType: "neutral" as const,
      date: r.generatedAt,
      iconType: "check" as const,
      meta: r
    }));
  }, [listQ.data]);

  const preview = previewQ.data as FarmReportPreviewDto | undefined;
  const sections = (preview?.sections ?? {}) as Record<string, unknown>;

  const prepend = (
    <View style={{ paddingBottom: 100, gap: mobileSpacing.md }}>
      <Text style={styles.farmName}>{farmName}</Text>
      <PeriodSelector
        periodType={periodType}
        onPeriodTypeChange={setPeriodType}
        anchor={anchor}
        onAnchorChange={setAnchor}
      />
      {previewQ.isLoading ? (
        <Text style={styles.muted}>{t("reportsScreen.loadingPreview")}</Text>
      ) : previewQ.isError ? (
        <Text style={styles.err}>{t("reportsScreen.previewError")}</Text>
      ) : preview ? (
        <>
          <FarmScoreGauge
            score={preview.score.global}
            band={preview.score.band}
            onPressDetails={() => setScoreModal(true)}
          />
          <FinanceSummary finance={sections.finance as never} />
          <CheptelSummary cheptel={sections.cheptel as never} />
          <HealthSummary health={sections.health as never} />
          <FeedSummary feed={sections.feed as never} />
          <GestationSummary gestation={sections.gestation as never} />
          <ProjectionSummary
            projection={sections.projection as never}
            alerts={sections.smartAlertsTop as never}
          />
        </>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <EventList
        layout="flatlist"
        data={historyItems}
        isLoading={listQ.isLoading}
        refreshing={previewQ.isFetching || listQ.isFetching}
        onRefresh={onRefresh}
        prependContent={prepend}
        sectionTitle={t("reportsScreen.history")}
        emptyMessage={t("reportsScreen.historyEmpty")}
        renderDetail={(item) => (
          <ReportHistoryBody
            reportId={item.id}
            accessToken={accessToken!}
            activeProfileId={activeProfileId}
          />
        )}
      />
      {accessToken ? (
        <ExportPDFButton
          farmId={farmId}
          accessToken={accessToken}
          activeProfileId={activeProfileId}
          periodType={periodType}
          anchor={anchor}
          onGenerated={() => void listQ.refetch()}
        />
      ) : null}
      <BaseModal
        visible={scoreModal}
        onClose={() => setScoreModal(false)}
        title={t("reportsScreen.scoreDetailTitle")}
        sheetMaxHeight="88%"
      >
        {preview ? (
          <View style={{ gap: mobileSpacing.md }}>
            {Object.entries(preview.score.breakdown).map(([k, v]) => (
              <View key={k} style={{ gap: 4 }}>
                <Text style={styles.modalTitle}>
                  {t(`reportsScreen.breakdown.${k}`, { defaultValue: k })}
                </Text>
                <Text style={styles.modalLine}>
                  {t("reportsScreen.breakdownScore", { score: v.score })}
                </Text>
                <Text style={styles.modalMuted}>{v.detail}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </BaseModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mobileColors.surface },
  farmName: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    marginTop: mobileSpacing.sm
  },
  muted: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  err: { ...mobileTypography.body, color: mobileColors.error },
  modalTitle: { ...mobileTypography.body, fontWeight: "800", color: mobileColors.textPrimary },
  modalLine: { ...mobileTypography.body, color: mobileColors.textPrimary },
  modalMuted: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  modalMono: { ...mobileTypography.meta, fontFamily: "monospace", color: mobileColors.textPrimary }
});
