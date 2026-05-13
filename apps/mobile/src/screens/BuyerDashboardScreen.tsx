import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { EventCard, KpiCard } from "../components/farm";
import { MobileAppShell } from "../components/layout";
import { IconButton, PrimaryButton } from "../components/ui";
import { mobileColors, mobileSpacing, mobileTypography } from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

/**
 * Tableau de bord acheteur : accès marché et messagerie (distinct du flux producteur).
 */
export function BuyerDashboardScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const tiles = [
    {
      title: "Marché",
      desc: "Parcourir les annonces et répondre aux offres.",
      onPress: () => navigation.navigate("MarketplaceList")
    },
    {
      title: "Mes offres",
      desc: "Suivi de tes propositions d’achat.",
      onPress: () => navigation.navigate("MarketplaceMyOffers")
    },
    {
      title: "Mes annonces",
      desc: "Annonces publiées depuis tes fermes liées.",
      onPress: () => navigation.navigate("MarketplaceMyListings")
    },
    {
      title: "Messages",
      desc: "Conversations avec acheteurs et vendeurs.",
      onPress: () => navigation.navigate("ChatRooms")
    }
  ];

  return (
    <MobileAppShell
      title="Espace acheteur"
      activeTab="home"
      onTabChange={(tab) => {
        if (tab === "home") {
          return;
        }
        if (tab === "cheptel") {
          navigation.navigate("MarketplaceMyListings");
        }
        if (tab === "health") {
          navigation.navigate("FarmEventsFeed");
        }
        if (tab === "profile") {
          navigation.navigate("Account");
        }
      }}
      topRight={<IconButton icon="search" onPress={() => navigation.navigate("MarketplaceList")} />}
    >
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={styles.kpiRow}>
          <View style={styles.kpiItem}>
            <KpiCard label="Dépenses mois" value="1 245 300 FCFA" />
          </View>
          <View style={styles.kpiItem}>
            <KpiCard label="Offres actives" value="4" tone="warning" />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Activité récente</Text>
        <View style={styles.list}>
          <EventCard
            title="Offre envoyée"
            subtitle="Supermart Groceries"
            timestamp="09:14"
          />
          <EventCard
            title="Réponse vendeur"
            subtitle="Lot porcelets - Ferme Koudougou"
            timestamp="08:02"
          />
        </View>

        <Text style={styles.sectionTitle}>Raccourcis</Text>
        <View style={styles.list}>
          {tiles.map((t) => (
            <PrimaryButton key={t.title} label={t.title} onPress={t.onPress} />
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
  kpiRow: {
    flexDirection: "row",
    gap: mobileSpacing.md
  },
  kpiItem: {
    flex: 1
  },
  sectionTitle: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary
  },
  list: {
    gap: mobileSpacing.md
  },
});
