import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { EventCard, KpiCard } from "../components/farm";
import { MobileAppShell } from "../components/layout";
import { DashboardTaskWidget } from "../components/tasks";
import { IconButton, PrimaryButton } from "../components/ui";
import { useSession } from "../context/SessionContext";
import { fetchFarms } from "../lib/api";
import { mobileColors, mobileSpacing, mobileTypography } from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

/**
 * Tableau de bord vétérinaire : hub consultations et communication (parcours distinct).
 */
export function VeterinarianDashboardScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken, activeProfileId, clientFeatures } = useSession();

  const farmsQ = useQuery({
    queryKey: ["farms", activeProfileId],
    queryFn: () => fetchFarms(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });
  const primaryFarm = farmsQ.data?.[0];

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

        {primaryFarm && clientFeatures.tasks && accessToken ? (
          <DashboardTaskWidget
            farmId={primaryFarm.id}
            farmName={primaryFarm.name}
            accessToken={accessToken}
            activeProfileId={activeProfileId}
          />
        ) : null}

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
