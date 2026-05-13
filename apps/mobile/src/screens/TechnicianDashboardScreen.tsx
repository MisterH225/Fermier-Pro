import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { EventCard, KpiCard } from "../components/farm";
import { MobileAppShell } from "../components/layout";
import { IconButton, PrimaryButton } from "../components/ui";
import { mobileColors, mobileSpacing, mobileTypography } from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

/**
 * Tableau de bord technicien : coordination terrain (parcours distinct du producteur).
 */
export function TechnicianDashboardScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <MobileAppShell
      title="Espace technicien"
      activeTab="home"
      onTabChange={(tab) => {
        if (tab === "home") {
          return;
        }
        if (tab === "cheptel") {
          navigation.navigate("FarmList");
        }
        if (tab === "health") {
          navigation.navigate("FarmEventsFeed");
        }
        if (tab === "profile") {
          navigation.navigate("Account");
        }
      }}
      topRight={<IconButton icon="add" onPress={() => navigation.navigate("FarmList")} />}
    >
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={styles.kpiRow}>
          <View style={styles.kpiItem}>
            <KpiCard label="Interventions jour" value="5" />
          </View>
          <View style={styles.kpiItem}>
            <KpiCard label="Alertes terrain" value="1" tone="warning" />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Activité terrain</Text>
        <View style={styles.list}>
          <EventCard
            title="Tâche en retard"
            subtitle="Lot #4 - Contrôle alimentation"
            timestamp="09:05"
          />
          <EventCard
            title="Visite terminée"
            subtitle="Bâtiment C - Nettoyage"
            timestamp="07:22"
          />
        </View>

        <Text style={styles.sectionTitle}>Actions rapides</Text>
        <View style={styles.list}>
          <PrimaryButton label="Mes fermes" onPress={() => navigation.navigate("FarmList")} />
          <PrimaryButton label="Messages" onPress={() => navigation.navigate("ChatRooms")} />
          <PrimaryButton
            label="Planning interventions"
            onPress={() =>
              navigation.navigate("ModuleRoadmap", {
                title: "Planning interventions",
                body:
                  "Vue planning multi-fermes : en cours de conception. Utilise les tâches terrain depuis le détail d’une ferme."
              })
            }
          />
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
  }
});
