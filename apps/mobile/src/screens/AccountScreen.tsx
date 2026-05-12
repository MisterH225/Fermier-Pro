import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet } from "react-native";
import { AccountSettingsPanel } from "../components/account/AccountSettingsPanel";
import { MobileAppShell } from "../components/layout";
import { useSession } from "../context/SessionContext";
import { dashboardRouteForActiveProfileType } from "../lib/dashboardHomeRoute";
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
  const { authMe, activeProfileId } = useSession();
  const profileType = authMe?.profiles.find((p) => p.id === activeProfileId)?.type;

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
      activeTab="profile"
      onTabChange={(tab) => {
        if (tab === "home") {
          goHome();
        }
        if (tab === "lots") {
          navigation.navigate(
            profileType === "buyer" ? "MarketplaceMyListings" : "FarmList"
          );
        }
        if (tab === "events") {
          navigation.navigate("FarmEventsFeed");
        }
      }}
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
