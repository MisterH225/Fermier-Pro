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
 * Tableau de bord vétérinaire : hub consultations et communication (parcours distinct).
 */
export function VeterinarianDashboardScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.banner}>Espace vétérinaire</Text>
      <Text style={styles.intro}>
        Accède aux dossiers sanitaires depuis le détail d’une ferme dont tu es membre, ou
        ouvre la messagerie pour coordonner avec les éleveurs.
      </Text>

      <TouchableOpacity
        style={styles.tile}
        onPress={() =>
          navigation.navigate("ModuleRoadmap", {
            title: "Cartographie des fermes",
            body:
              "Vue agrégée des fermes suivies : prévu dans une prochaine version. " +
              "En attendant, sélectionne une ferme depuis « Mes fermes » si tu y es invité."
          })
        }
        activeOpacity={0.88}
      >
        <Text style={styles.tileTitle}>Suivi des exploitations</Text>
        <Text style={styles.tileDesc}>
          Vision métier vétérinaire (roadmap produit).
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tile}
        onPress={() => navigation.navigate("ChatRooms")}
        activeOpacity={0.88}
      >
        <Text style={styles.tileTitle}>Messages</Text>
        <Text style={styles.tileDesc}>
          Échanges avec les producteurs et l’équipe terrain.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tile}
        onPress={() =>
          navigation.navigate("ModuleRoadmap", {
            title: "Rappels et ordonnances",
            body:
              "Centralisation des prescriptions et relances : module à venir."
          })
        }
        activeOpacity={0.88}
      >
        <Text style={styles.tileTitle}>Outils cliniques</Text>
        <Text style={styles.tileDesc}>Prescriptions, historiques, pièces jointes.</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tile}
        onPress={() => navigation.navigate("FarmList")}
        activeOpacity={0.88}
      >
        <Text style={styles.tileTitle}>Mes fermes</Text>
        <Text style={styles.tileDesc}>
          Liste des exploitations auxquelles tu as accès (invitation ou rattachement).
        </Text>
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
    backgroundColor: "#f0f7ff"
  },
  banner: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0c4a6e",
    marginBottom: 8
  },
  intro: {
    fontSize: 15,
    lineHeight: 22,
    color: "#334155",
    marginBottom: 20
  },
  tile: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#BFDBFE"
  },
  tileTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0c4a6e",
    marginBottom: 6
  },
  tileDesc: {
    fontSize: 14,
    lineHeight: 20,
    color: "#475569"
  },
  footerPad: {
    height: 24
  }
});
