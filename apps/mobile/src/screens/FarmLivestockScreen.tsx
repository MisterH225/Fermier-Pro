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
import { fetchFarm, fetchFarmCheptelOverview } from "../lib/api";
import { invalidateCheptelCaches } from "../lib/cheptelQueries";
import { mobileColors, mobileSpacing, mobileTypography } from "../theme/mobileTheme";
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

  const refreshing = farmQuery.isFetching || cheptelQuery.isFetching;

  const onRefresh = useCallback(() => {
    void farmQuery.refetch();
    void cheptelQuery.refetch();
    invalidateCheptelCaches(qc, farmId, [
      "cheptelHistory",
      "cheptelPens",
      "cheptelGmq",
      "cheptelWeightSeries"
    ]);
  }, [farmQuery, cheptelQuery, qc, farmId]);

  const loading =
    (farmQuery.isPending && !farmQuery.data) ||
    (cheptelQuery.isPending && !cheptelQuery.data);

  const errMsg =
    !farmQuery.data && (farmQuery.error as Error | undefined)?.message
      ? (farmQuery.error as Error).message
      : !cheptelQuery.data &&
          (cheptelQuery.error as Error | undefined)?.message
        ? (cheptelQuery.error as Error).message
        : undefined;

  const livestockMode =
    (farmQuery.data?.livestockMode as "individual" | "batch" | "hybrid") ||
    (cheptelQuery.data?.farm?.livestockMode as "individual" | "batch" | "hybrid") ||
    "individual";

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
                farmName={farmName}
                accessToken={accessToken}
                activeProfileId={activeProfileId}
                readOnly={readOnly}
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
  centered: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: mobileColors.canvas,
    minHeight: 400
  },
  modeHint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.md,
    lineHeight: 18
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
