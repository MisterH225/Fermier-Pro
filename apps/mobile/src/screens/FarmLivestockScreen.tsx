import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { TabScreenHeader } from "../components/layout";
import { useScreenTitle } from "../hooks/useScreenTitle";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import {
  CheptelHistory,
  CheptelOverview,
  CheptelWeightTab
} from "../components/cheptel";
import { CheptelTab } from "../components/cheptel/tabs/CheptelTab";
import { TabContent, TabSelector } from "../components/tabs";
import { useSession } from "../context/SessionContext";
import {
  fetchFarm,
  fetchFarmAnimals,
  fetchFarmBatches,
  fetchFarmCheptelOverview
} from "../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";
import { useTechFarmPermissions } from "../hooks/useTechFarmPermissions";
import { TechReadOnlyBanner } from "../components/technician/TechReadOnlyBanner";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "FarmLivestock">;

export function FarmLivestockScreen({ route, navigation }: Props) {
  const {
    farmId,
    farmName,
    initialTab,
    openPenId,
    highlightPen,
    showRequalificationBanner
  } = route.params;
  const [livestockTab, setLivestockTab] = useState(
    initialTab ?? (openPenId ? "cheptel" : "overview")
  );

  useEffect(() => {
    if (initialTab) {
      setLivestockTab(initialTab);
    } else if (openPenId) {
      setLivestockTab("cheptel");
    }
  }, [initialTab, openPenId]);
  const { t } = useTranslation();
  const techPerms = useTechFarmPermissions(farmId, "cheptel");
  const readOnly = techPerms.readOnly;
  useScreenTitle(navigation, t("navigation.main.cheptel"));
  const { accessToken, activeProfileId } = useSession();
  const qc = useQueryClient();
  const farmQuery = useQuery({
    queryKey: ["farm", farmId, activeProfileId],
    queryFn: () => fetchFarm(accessToken!, farmId, activeProfileId)
  });

  const cheptelQuery = useQuery({
    queryKey: ["farmCheptel", farmId, activeProfileId],
    queryFn: () => fetchFarmCheptelOverview(accessToken!, farmId, activeProfileId)
  });

  const animalsQuery = useQuery({
    queryKey: ["farmAnimals", farmId, activeProfileId],
    queryFn: () => fetchFarmAnimals(accessToken!, farmId, activeProfileId)
  });

  const batchesQuery = useQuery({
    queryKey: ["farmBatches", farmId, activeProfileId],
    queryFn: () => fetchFarmBatches(accessToken!, farmId, activeProfileId)
  });

  const refreshing =
    farmQuery.isFetching ||
    cheptelQuery.isFetching ||
    animalsQuery.isFetching ||
    batchesQuery.isFetching;

  const onRefresh = useCallback(() => {
    void farmQuery.refetch();
    void cheptelQuery.refetch();
    void animalsQuery.refetch();
    void batchesQuery.refetch();
    void qc.invalidateQueries({ queryKey: ["cheptelHistory", farmId] });
    void qc.invalidateQueries({ queryKey: ["cheptelPens", farmId] });
    void qc.invalidateQueries({ queryKey: ["cheptelGmq", farmId] });
  }, [farmQuery, cheptelQuery, animalsQuery, batchesQuery, qc, farmId]);

  const loading =
    (farmQuery.isPending && !farmQuery.data) ||
    (cheptelQuery.isPending && !cheptelQuery.data) ||
    (animalsQuery.isPending && !animalsQuery.data) ||
    (batchesQuery.isPending && !batchesQuery.data);

  const errMsg =
    !farmQuery.data && (farmQuery.error as Error | undefined)?.message
      ? (farmQuery.error as Error).message
      : !cheptelQuery.data &&
          !animalsQuery.data &&
          !batchesQuery.data &&
          ((cheptelQuery.error as Error | undefined)?.message ||
            (animalsQuery.error as Error | undefined)?.message ||
            (batchesQuery.error as Error | undefined)?.message)
        ? (cheptelQuery.error as Error | undefined)?.message ||
          (animalsQuery.error as Error | undefined)?.message ||
          (batchesQuery.error as Error | undefined)?.message
        : undefined;

  const livestockMode =
    (farmQuery.data?.livestockMode as "individual" | "batch" | "hybrid") ||
    (cheptelQuery.data?.farm?.livestockMode as "individual" | "batch" | "hybrid") ||
    "individual";

  const showAnimals = livestockMode === "individual" || livestockMode === "hybrid";
  const showBatches = livestockMode === "batch" || livestockMode === "hybrid";

  const kpis = cheptelQuery.data?.kpis;

  const animals = animalsQuery.data ?? [];
  const batches = batchesQuery.data ?? [];
  const invalidateAnimals = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["farmAnimals", farmId] });
    void qc.invalidateQueries({ queryKey: ["farmCheptel", farmId] });
    void qc.invalidateQueries({ queryKey: ["farmCheptelLogs", farmId] });
    void qc.invalidateQueries({ queryKey: ["farmBarns", farmId] });
    void qc.invalidateQueries({ queryKey: ["farmBarnDetails", farmId] });
  }, [qc, farmId]);

  if (techPerms.isTech && techPerms.loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={mobileColors.accent} />
      </View>
    );
  }

  if (techPerms.isTech && !techPerms.canView) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{t("tech.permissionDenied")}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={mobileColors.accent} />
      </View>
    );
  }

  if (errMsg) {
    return (
      <ScrollView
        contentContainerStyle={styles.centered}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.error}>{errMsg}</Text>
        <Text style={styles.hint}>
          Accès refusé ? Vérifie ton rôle sur la ferme (scopes livestock) ou
          change de profil actif.
        </Text>
      </ScrollView>
    );
  }

  const tabScroll = (children: ReactNode) => (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.tabScroll}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      <TabContent>{children}</TabContent>
    </ScrollView>
  );

  const modeHintBlock = (
    <>
      {livestockMode === "hybrid" ? (
        <Text style={styles.modeHint}>{t("cheptel.hybridHint")}</Text>
      ) : null}
      {livestockMode === "batch" ? (
        <Text style={styles.modeHint}>{t("cheptel.batchOnlyHint")}</Text>
      ) : null}
      {livestockMode === "individual" ? (
        <Text style={styles.modeHint}>{t("cheptel.individualHint")}</Text>
      ) : null}
    </>
  );

  return (
    <View style={styles.root}>
      {readOnly ? (
        <View style={{ paddingHorizontal: mobileSpacing.md, paddingTop: mobileSpacing.sm }}>
          <TechReadOnlyBanner />
        </View>
      ) : null}
      <TabSelector
        testIDPrefix="cheptel-tab"
        activeTab={livestockTab}
        onTabChange={(k) => setLivestockTab(k as typeof livestockTab)}
        defaultTab="overview"
        header={<TabScreenHeader>{modeHintBlock}</TabScreenHeader>}
        tabs={[
          {
            key: "overview",
            label: t("cheptel.navOverview"),
            content: tabScroll(
              <CheptelOverview
                overview={cheptelQuery.data}
                isLoading={cheptelQuery.isPending}
                farmId={farmId}
                accessToken={accessToken}
                activeProfileId={activeProfileId}
              />
            )
          },
          {
            key: "cheptel",
            label: t("cheptel.navCheptel"),
            badge: cheptelQuery.data?.kpis?.totalHeadcount || undefined,
            content: tabScroll(
              accessToken ? (
                <CheptelTab
                  farmId={farmId}
                  farmName={farmName}
                  navigation={navigation}
                  onInvalidateOverview={onRefresh}
                  readOnly={readOnly}
                  openPenId={openPenId}
                  highlightPenId={highlightPen ? openPenId : undefined}
                  showRequalificationBanner={showRequalificationBanner}
                />
              ) : null
            )
          },
          {
            key: "weight",
            label: t("cheptel.navWeight"),
            content: tabScroll(
              accessToken ? (
                <CheptelWeightTab
                  farmId={farmId}
                  accessToken={accessToken}
                  activeProfileId={activeProfileId}
                  readOnly={readOnly}
                />
              ) : null
            )
          },
          {
            key: "history",
            label: t("cheptel.navHistory"),
            content: tabScroll(
              accessToken ? (
                <CheptelHistory
                  farmId={farmId}
                  accessToken={accessToken}
                  activeProfileId={activeProfileId}
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                />
              ) : null
            )
          }
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: mobileColors.canvas
  },
  scroll: {
    flex: 1,
    backgroundColor: mobileColors.background
  },
  tabScroll: {
    flexGrow: 1
  },
  linkBtn: {
    alignSelf: "flex-start",
    paddingVertical: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.accentSoft,
    marginTop: mobileSpacing.sm
  },
  linkBtnText: {
    ...mobileTypography.body,
    color: mobileColors.accent,
    fontWeight: "600"
  },
  centered: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: mobileColors.canvas,
    minHeight: 400
  },
  sub: {
    marginTop: 12,
    color: mobileColors.textSecondary
  },
  farmTitle: {
    ...mobileTypography.title,
    fontSize: 20,
    marginBottom: mobileSpacing.md
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: mobileColors.accent
  },
  sectionSpacer: {
    marginTop: mobileSpacing.xl
  },
  subSection: {
    ...mobileTypography.body,
    fontWeight: "600",
    marginTop: mobileSpacing.md,
    color: mobileColors.textPrimary
  },
  metaLine: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.sm
  },
  modeHint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.md,
    lineHeight: 18
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  kpiCard: {
    width: "47%",
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    ...mobileShadows.card
  },
  kpiVal: {
    fontSize: 22,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  kpiLab: {
    ...mobileTypography.meta,
    marginTop: 4,
    color: mobileColors.textSecondary
  },
  empty: {
    color: mobileColors.textSecondary,
    fontSize: 14,
    fontStyle: "italic",
    marginBottom: 8
  },
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    ...mobileShadows.card
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: mobileColors.textPrimary
  },
  cardSub: {
    marginTop: 4,
    fontSize: 13,
    color: mobileColors.textSecondary
  },
  cardMeta: {
    marginTop: 6,
    fontSize: 12,
    color: mobileColors.textSecondary
  },
  cardHint: {
    marginTop: 8,
    fontSize: 12,
    color: mobileColors.accent,
    fontWeight: "600"
  },
  statusBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  statusBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: mobileColors.accent
  },
  csvBtn: {
    alignSelf: "flex-start",
    marginBottom: mobileSpacing.md
  },
  csvBtnText: {
    color: mobileColors.accent,
    fontWeight: "600"
  },
  error: {
    color: mobileColors.error,
    textAlign: "center",
    marginBottom: 12
  },
  hint: {
    fontSize: 13,
    color: mobileColors.textSecondary,
    textAlign: "center",
    lineHeight: 18
  }
});
