import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { ListSkeleton } from "../../components/common/SkeletonBlocks";
import { VetMobileShell } from "../../components/layout";
import { useSession } from "../../context/SessionContext";
import { fetchFarms } from "../../lib/api";
import { vetColors } from "../../theme/vetTheme";
import { mobileSpacing } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

export function VetTasksScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken, activeProfileId } = useSession();

  const farmsQ = useQuery({
    queryKey: ["farms", activeProfileId, "vetTasks"],
    queryFn: () => fetchFarms(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const farm = farmsQ.data?.[0];

  useEffect(() => {
    if (farm) {
      navigation.navigate("FarmTasks", { farmId: farm.id, farmName: farm.name });
    }
  }, [farm, navigation]);

  if (farmsQ.isLoading) {
    return (
      <VetMobileShell hideTopBar>
        <View style={{ padding: mobileSpacing.xl }}>
          <ListSkeleton count={3} />
        </View>
      </VetMobileShell>
    );
  }

  if (!farm) {
    return (
      <VetMobileShell hideTopBar>
        <View style={styles.center}>
          <Text style={styles.empty}>{t("vet.tasks.noFarm")}</Text>
        </View>
      </VetMobileShell>
    );
  }

  return (
    <VetMobileShell hideTopBar>
      <View style={styles.center}>
        <Text style={styles.empty}>{t("vet.tasks.redirect")}</Text>
      </View>
    </VetMobileShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, padding: mobileSpacing.xl, alignItems: "center" },
  empty: { color: vetColors.textSecondary, textAlign: "center" }
});
