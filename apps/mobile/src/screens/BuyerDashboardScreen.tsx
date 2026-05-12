import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
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
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.banner}>Espace acheteur</Text>
      <Text style={styles.intro}>
        Hub marché et échanges. Tu peux aussi passer sur un autre profil depuis l’en-tête
        lorsque tu en auras plusieurs.
      </Text>
      {tiles.map((t) => (
        <TouchableOpacity
          key={t.title}
          style={styles.tile}
          onPress={t.onPress}
          activeOpacity={0.88}
        >
          <Text style={styles.tileTitle}>{t.title}</Text>
          <Text style={styles.tileDesc}>{t.desc}</Text>
        </TouchableOpacity>
      ))}
      <View style={styles.footerPad} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 28,
    backgroundColor: "#f9f8ea"
  },
  banner: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1B3B2E",
    marginBottom: 8
  },
  intro: {
    fontSize: 15,
    lineHeight: 22,
    color: "#4B5563",
    marginBottom: 20
  },
  tile: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB"
  },
  tileTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1B3B2E",
    marginBottom: 6
  },
  tileDesc: {
    fontSize: 14,
    lineHeight: 20,
    color: "#6B7280"
  },
  footerPad: {
    height: 24
  }
});
