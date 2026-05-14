import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { EventCard, KpiCard } from "../components/farm";
import { MobileAppShell } from "../components/layout";
import { IconButton, PrimaryButton } from "../components/ui";
import { mobileColors, mobileSpacing, mobileTypography } from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

/**
 * Tableau de bord vétérinaire : hub consultations et communication (parcours distinct).
 */
export function VeterinarianDashboardScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <MobileAppShell
      title="Espace vétérinaire"
      topRight={<IconButton icon="search" onPress={() => navigation.navigate("FarmList")} />}
    >
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={styles.kpiRow}>
          <View style={styles.kpiItem}>
            <KpiCard label="Alertes santé" value="2" tone="danger" />
          </View>
          <View style={styles.kpiItem}>
            <KpiCard label="Consultations" value="6" tone="warning" />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Activité clinique</Text>
        <View style={styles.list}>
          <EventCard
            title="Vaccination validée"
            subtitle="Lot #8 - Croissance"
            timestamp="09:18"
          />
          <EventCard
            title="Alerte respiratoire"
            subtitle="Lot #12 - Post-sevrage"
            timestamp="07:41"
          />
        </View>

        <Text style={styles.sectionTitle}>Actions rapides</Text>
        <View style={styles.list}>
          <PrimaryButton label="Mes fermes" onPress={() => navigation.navigate("FarmList")} />
          <PrimaryButton label="Messages" onPress={() => navigation.navigate("ChatRooms")} />
          <PrimaryButton
            label="Rappels & ordonnances"
            onPress={() =>
              navigation.navigate("ModuleRoadmap", {
                title: "Rappels et ordonnances",
                body: "Centralisation des prescriptions et relances : module à venir."
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
