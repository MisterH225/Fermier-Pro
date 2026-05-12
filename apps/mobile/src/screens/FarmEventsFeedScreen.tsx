import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { EventCard } from "../components/farm";
import { MobileAppShell } from "../components/layout";
import { IconButton } from "../components/ui";
import { useSession } from "../context/SessionContext";
import { dashboardRouteForActiveProfileType } from "../lib/dashboardHomeRoute";
import { mobileColors, mobileSpacing, mobileTypography } from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

const MOCK_EVENTS = [
  {
    title: "Mortalité déclarée",
    subtitle: "Lot #12 · Post-sevrage",
    timestamp: "10:02"
  },
  {
    title: "Pesée enregistrée",
    subtitle: "Lot #8 · Moy. 28,4 kg",
    timestamp: "09:18"
  },
  {
    title: "Vaccination PCV2",
    subtitle: "Lot #8 · Croissance",
    timestamp: "Hier"
  },
  {
    title: "Entrée aliment",
    subtitle: "Coulée 2 · +2,5 t",
    timestamp: "Hier"
  }
];

/**
 * Fil d’événements terrain (UI). Brancher sur l’API quand le modèle « événement unifié » existera.
 */
export function FarmEventsFeedScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { activeProfileId, authMe } = useSession();
  const profileType = authMe?.profiles.find((p) => p.id === activeProfileId)?.type;

  const goHome = () => {
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
  };

  return (
    <MobileAppShell
      title="Événements"
      activeTab="events"
      onTabChange={(tab) => {
        if (tab === "home") {
          goHome();
        }
        if (tab === "lots") {
          navigation.navigate(
            profileType === "buyer" ? "MarketplaceMyListings" : "FarmList"
          );
        }
        if (tab === "profile") {
          navigation.navigate("Account");
        }
      }}
      topRight={<IconButton icon="add" onPress={() => navigation.navigate("FarmList")} />}
    >
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={styles.intro}>
          Dernières actions sur tes lots et ta ferme. Saisie rapide : choisis une ferme puis
          enregistre une tâche ou un événement santé depuis le détail du lot.
        </Text>
        <View style={styles.list}>
          {MOCK_EVENTS.map((ev, i) => (
            <EventCard
              key={`${ev.title}-${i}`}
              title={ev.title}
              subtitle={ev.subtitle}
              timestamp={ev.timestamp}
            />
          ))}
        </View>
      </ScrollView>
    </MobileAppShell>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: mobileSpacing.lg,
    paddingBottom: mobileSpacing.xxl,
    gap: mobileSpacing.lg
  },
  intro: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary
  },
  list: {
    gap: mobileSpacing.md
  }
});
