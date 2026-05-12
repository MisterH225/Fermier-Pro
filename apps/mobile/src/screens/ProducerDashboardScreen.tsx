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
 * Tableau de bord producteur : hub fermes et exploitation (distinct des autres métiers).
 */
export function ProducerDashboardScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.banner}>Espace producteur</Text>
      <Text style={styles.intro}>
        Pilote tes fermes, le cheptel, la nutrition et les ventes. Les raccourcis ci-dessous
        mènent aux mêmes écrans qu’avant, depuis un point d’entrée dédié.
      </Text>

      <TouchableOpacity
        style={styles.tilePrimary}
        onPress={() => navigation.navigate("FarmList")}
        activeOpacity={0.88}
      >
        <Text style={styles.tilePrimaryTitle}>Mes fermes</Text>
        <Text style={styles.tilePrimaryDesc}>
          Liste des exploitations, accès détail et gestion quotidienne.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tile}
        onPress={() => navigation.navigate("CreateFarm")}
        activeOpacity={0.88}
      >
        <Text style={styles.tileTitle}>Nouvelle ferme</Text>
        <Text style={styles.tileDesc}>Créer une exploitation (profil producteur requis).</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tile}
        onPress={() => navigation.navigate("MarketplaceList")}
        activeOpacity={0.88}
      >
        <Text style={styles.tileTitle}>Marché</Text>
        <Text style={styles.tileDesc}>Acheter ou vendre via la marketplace.</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tile}
        onPress={() => navigation.navigate("ChatRooms")}
        activeOpacity={0.88}
      >
        <Text style={styles.tileTitle}>Messages</Text>
        <Text style={styles.tileDesc}>Échanges avec acheteurs, techniciens et vétérinaires.</Text>
      </TouchableOpacity>

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
  tilePrimary: {
    backgroundColor: "#5d7a1f",
    borderRadius: 16,
    padding: 20,
    marginBottom: 14
  },
  tilePrimaryTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8
  },
  tilePrimaryDesc: {
    fontSize: 15,
    lineHeight: 22,
    color: "#e8f5d9"
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
