import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { KpiCard } from "../components/farm";
import { MobileAppShell } from "../components/layout";
import { DashboardTaskWidget } from "../components/tasks";
import { IconButton, PrimaryButton } from "../components/ui";
import { useSession } from "../context/SessionContext";
import { fetchFarms } from "../lib/api";
import { mobileColors, mobileSpacing, mobileTypography } from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

/**
 * Tableau de bord technicien : coordination terrain (parcours distinct du producteur).
 */
export function TechnicianDashboardScreen() {
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
      title="Espace technicien"
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

        {primaryFarm && clientFeatures.tasks && accessToken ? (
          <DashboardTaskWidget
            farmId={primaryFarm.id}
            farmName={primaryFarm.name}
            accessToken={accessToken}
            activeProfileId={activeProfileId}
          />
        ) : null}

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
