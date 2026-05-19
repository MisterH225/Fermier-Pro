import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet } from "react-native";
import { AccountSettingsPanel } from "../components/account/AccountSettingsPanel";
import { MobileAppShell } from "../components/layout";
import { useProducerBottomChromePad } from "../context/ProducerBottomChromeContext";
import { useSession } from "../context/SessionContext";
import { mobileSpacing } from "../theme/mobileTheme";

/**
 * Compte et paramètres : le producteur garde l’accès compte via l’en-tête d’accueil ;
 * pas de barre basse (navigation flottante producteur à l’extérieur du shell).
 */
export function AccountScreen() {
  const { t } = useTranslation();
  const { authMe, activeProfileId } = useSession();
  const profileType = authMe?.profiles.find((p) => p.id === activeProfileId)?.type;
  const isProducer = profileType === "producer";
  const bottomChromePad = useProducerBottomChromePad();

  return (
    <MobileAppShell
      title={t("account.title")}
      omitBottomTabBar={isProducer}
    >
      <ScrollView
        contentContainerStyle={[
          styles.wrap,
          { paddingBottom: mobileSpacing.xxl + bottomChromePad }
        ]}
      >
        <AccountSettingsPanel />
      </ScrollView>
    </MobileAppShell>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: mobileSpacing.lg,
    gap: mobileSpacing.lg
  }
});
