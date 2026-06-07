import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { ListSkeleton } from "../../components/common/SkeletonBlocks";
import {
  ProfileSectionEmpty,
  profileScreenScrollContent,
  ScreenSection
} from "../../components/layout";
import { TechMobileShell } from "../../components/layout/TechMobileShell";
import { useBottomChromePad } from "../../hooks/useBottomInset";
import { useSession } from "../../context/SessionContext";
import { fetchTechnicianDashboard } from "../../lib/api";
import { techColors } from "../../theme/technicianTheme";
import type { RootStackParamList } from "../../types/navigation";

/** Redirige vers l’écran tâches ferme (même composant que le producteur). */
export function TechTasksScreen() {
  const { t } = useTranslation();
  const bottomChromePad = useBottomChromePad();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken, activeProfileId } = useSession();

  const dashQ = useQuery({
    queryKey: ["techDashboard", activeProfileId, "tasks"],
    queryFn: () => fetchTechnicianDashboard(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const farm = dashQ.data?.farms[0];

  useFocusEffect(
    useCallback(() => {
      if (farm) {
        navigation.navigate("FarmTasks", {
          farmId: farm.farmId,
          farmName: farm.farmName
        });
      }
    }, [farm, navigation])
  );

  return (
    <TechMobileShell hideTopBar>
      <View style={[profileScreenScrollContent, styles.wrap, { paddingBottom: bottomChromePad }]}>
        <ScreenSection title={t("tech.dashboard.tasksToday")}>
          {dashQ.isLoading ? (
            <ListSkeleton count={3} />
          ) : farm ? (
            <ListSkeleton count={2} />
          ) : (
            <ProfileSectionEmpty>{t("tech.tasks.noFarm")}</ProfileSectionEmpty>
          )}
        </ScreenSection>
      </View>
    </TechMobileShell>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center" }
});
