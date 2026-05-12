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
 * Tableau de bord technicien : coordination terrain (parcours distinct du producteur).
 */
export function TechnicianDashboardScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.banner}>Espace technicien</Text>
      <Text style={styles.intro}>
        Priorité aux interventions, tâches terrain et nutrition selon les fermes où tu es
        habilité.
      </Text>

      <TouchableOpacity
        style={styles.tile}
        onPress={() =>
          navigation.navigate("ModuleRoadmap", {
            title: "Planning interventions",
            body:
              "Vue planning multi-fermes : en cours de conception. Utilise les tâches terrain depuis le détail d’une ferme."
          })
        }
        activeOpacity={0.88}
      >
        <Text style={styles.tileTitle}>Interventions</Text>
        <Text style={styles.tileDesc}>Planning et missions terrain.</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tile}
        onPress={() => navigation.navigate("FarmList")}
        activeOpacity={0.88}
      >
        <Text style={styles.tileTitle}>Mes fermes</Text>
        <Text style={styles.tileDesc}>
          Sélectionne une exploitation pour voir les tâches, loges et troupeaux.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tile}
        onPress={() => navigation.navigate("ChatRooms")}
        activeOpacity={0.88}
      >
        <Text style={styles.tileTitle}>Messages</Text>
        <Text style={styles.tileDesc}>Coordination avec les équipes et les éleveurs.</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tile}
        onPress={() =>
          navigation.navigate("ModuleRoadmap", {
            title: "Rapports terrain",
            body:
              "Synthèses visites et indicateurs : évolution prévue du produit."
          })
        }
        activeOpacity={0.88}
      >
        <Text style={styles.tileTitle}>Rapports</Text>
        <Text style={styles.tileDesc}>Comptes rendus et indicateurs.</Text>
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
    backgroundColor: "#fefce8"
  },
  banner: {
    fontSize: 22,
    fontWeight: "800",
    color: "#713f12",
    marginBottom: 8
  },
  intro: {
    fontSize: 15,
    lineHeight: 22,
    color: "#57534e",
    marginBottom: 20
  },
  tile: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#FDE047"
  },
  tileTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#713f12",
    marginBottom: 6
  },
  tileDesc: {
    fontSize: 14,
    lineHeight: 20,
    color: "#78716c"
  },
  footerPad: {
    height: 24
  }
});
