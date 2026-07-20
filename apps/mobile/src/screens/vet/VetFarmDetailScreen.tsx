import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { FarmSelector } from "../../components/vet/FarmSelector";
import { VetFarmHealthTab } from "../../components/vet/farmDetail/VetFarmHealthTab";
import { VetFarmLivestockTab } from "../../components/vet/farmDetail/VetFarmLivestockTab";
import { VetFarmPrescriptionsTab } from "../../components/vet/farmDetail/VetFarmPrescriptionsTab";
import { VetFarmVisitsTab } from "../../components/vet/farmDetail/VetFarmVisitsTab";
import { VetMobileShell } from "../../components/layout";
import { useSession } from "../../context/SessionContext";
import { useBottomInset } from "../../hooks/useBottomInset";
import { useVetFarms } from "../../hooks/useVetFarms";
import { fetchVetFarmSummary } from "../../lib/api";
import { vetColors } from "../../theme/vetTheme";
import { mobileSpacing } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

const TABS = ["health", "livestock", "visits", "prescriptions"] as const;
type TabId = (typeof TABS)[number];

export function VetFarmDetailScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";
  const route = useRoute<RouteProp<RootStackParamList, "VetFarmDetail">>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomInset = useBottomInset();
  const { accessToken, activeProfileId } = useSession();

  const {
    farms,
    selectedFarmId,
    selectedFarm,
    setSelectedFarmId
  } = useVetFarms(activeProfileId);

  const routeFarmId = route.params.farmId;
  const routeFarmName = route.params.farmName;
  const initialTab = route.params.initialTab;

  /** Sync route → sélection persistée à l'ouverture. */
  useEffect(() => {
    if (routeFarmId && routeFarmId !== selectedFarmId) {
      setSelectedFarmId(routeFarmId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync initial route only
  }, [routeFarmId]);

  const farmId = selectedFarmId ?? routeFarmId;
  const farmName = selectedFarm?.name ?? routeFarmName;

  const [tab, setTab] = useState<TabId>(
    initialTab && TABS.includes(initialTab) ? initialTab : "health"
  );

  const summaryQ = useQuery({
    queryKey: ["vetFarmSummary", farmId, activeProfileId],
    queryFn: () =>
      fetchVetFarmSummary(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken && farmId)
  });

  const onSelectFarm = (nextId: string) => {
    const next = farms.find((f) => f.id === nextId);
    setSelectedFarmId(nextId);
    navigation.setParams({
      farmId: nextId,
      farmName: next?.name ?? farmName
    });
  };

  return (
    <VetMobileShell hideTopBar>
      <ScrollView
        contentContainerStyle={[styles.wrap, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        <FarmSelector
          farms={farms}
          selectedFarmId={farmId}
          onSelect={onSelectFarm}
          fallbackLabel={farmName}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {TABS.map((id) => (
            <Pressable
              key={id}
              style={[styles.tab, tab === id && styles.tabOn]}
              onPress={() => setTab(id)}
            >
              <Text style={[styles.tabTx, tab === id && styles.tabTxOn]}>
                {t(`vet.farmDetail.tabs.${id}`)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {tab === "health" ? (
          <VetFarmHealthTab
            farmId={farmId}
            summary={summaryQ.data}
            summaryLoading={summaryQ.isLoading}
            locale={locale}
          />
        ) : null}

        {tab === "livestock" ? (
          <VetFarmLivestockTab farmId={farmId} summary={summaryQ.data} />
        ) : null}

        {tab === "visits" ? (
          <VetFarmVisitsTab
            farmId={farmId}
            farmName={farmName}
            locale={locale}
          />
        ) : null}

        {tab === "prescriptions" ? (
          <VetFarmPrescriptionsTab
            farmId={farmId}
            farmName={farmName}
            locale={locale}
          />
        ) : null}
      </ScrollView>
    </VetMobileShell>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: mobileSpacing.lg, gap: mobileSpacing.md },
  tabs: { flexDirection: "row", gap: 6, paddingRight: mobileSpacing.md },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: vetColors.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: vetColors.border
  },
  tabOn: {
    backgroundColor: vetColors.primary,
    borderColor: vetColors.primary
  },
  tabTx: { fontWeight: "600", color: vetColors.textSecondary, fontSize: 12 },
  tabTxOn: { color: vetColors.onPrimary, fontWeight: "700" }
});
