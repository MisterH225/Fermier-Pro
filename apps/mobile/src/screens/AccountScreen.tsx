import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet } from "react-native";
import { AccountSettingsPanel } from "../components/account/AccountSettingsPanel";
import { MobileAppShell } from "../components/layout";
import { ProducerEventsFab } from "../components/producer/ProducerEventsFab";
import { useSession } from "../context/SessionContext";
import { dashboardRouteForActiveProfileType } from "../lib/dashboardHomeRoute";
import { producerShellTabs } from "../lib/producerShellTabs";
import { mobileSpacing } from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

/**
 * Compte et paramètres (acheteur, vétérinaire, technicien) : barre d’onglets avec entrée Profil.
 * Le producteur utilise le menu profil depuis l’accueil (modal).
 */
export function AccountScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { authMe, activeProfileId, clientFeatures } = useSession();
  const profileType = authMe?.profiles.find((p) => p.id === activeProfileId)?.type;
  const isProducer = profileType === "producer";

  const shellTabs = producerShellTabs(
    Boolean(isProducer && clientFeatures.finance)
  );

  const goHome = useCallback(() => {
    const route = dashboardRouteForActiveProfileType(profileType);
    switch (route) {
      case "ProducerDashboard":
        navigation.navigate("ProducerDashboard");
        break;
      case "BuyerDashboard":
        navigation.navigate("BuyerDashboard");
        break;
      case "VeterinarianDashboard":
        navigation.navigate("VeterinarianDashboard");
        break;
      case "TechnicianDashboard":
        navigation.navigate("TechnicianDashboard");
        break;
      default:
        navigation.navigate("ProducerDashboard");
    }
  }, [navigation, profileType]);


  return (
    <MobileAppShell
      title={t("account.title")}
      omitBottomTabBar={isProducer}
      activeTab={isProducer ? undefined : "profile"}
      tabBarTabs={isProducer ? undefined : shellTabs}
      floatingAction={
        isProducer ? (
          <ProducerEventsFab onPress={() => navigation.navigate("FarmEventsFeed")} />
        ) : undefined
      }
      onTabChange={
        isProducer
          ? undefined
          : (tab) => {
              if (tab === "home") {
                goHome();
              }
              if (tab === "cheptel") {
                if (profileType === "buyer") {
                  navigation.navigate("MarketplaceMyListings");
                  return;
                }
                navigation.navigate("FarmList");
              }
              if (tab === "health") {
                navigation.navigate("FarmEventsFeed");
              }
            }
      }
    >
      <ScrollView contentContainerStyle={styles.wrap}>
        <AccountSettingsPanel />
      </ScrollView>
    </MobileAppShell>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: mobileSpacing.lg,
    paddingBottom: mobileSpacing.xxl,
    gap: mobileSpacing.lg
  }
});
