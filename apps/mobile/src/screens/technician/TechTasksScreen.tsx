import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
import { mobileColors, mobileSpacing } from "../../theme/mobileTheme";
import { techColors, techRadius } from "../../theme/technicianTheme";
import type { RootStackParamList } from "../../types/navigation";

/** Hub stable vers les tâches de la ferme (pas de redirection auto). */
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

  const openFarmTasks = () => {
    if (!farm) return;
    navigation.navigate("FarmTasks", {
      farmId: farm.farmId,
      farmName: farm.farmName
    });
  };

  return (
    <TechMobileShell hideTopBar>
      <View
        style={[
          profileScreenScrollContent,
          styles.wrap,
          { paddingBottom: bottomChromePad }
        ]}
      >
        {dashQ.isLoading ? (
          <ScreenSection title={t("tech.dashboard.tasksToday")}>
            <ListSkeleton count={3} />
          </ScreenSection>
        ) : farm ? (
          <ScreenSection title={farm.farmName}>
            <Pressable style={styles.btn} onPress={openFarmTasks}>
              <Text style={styles.btnText}>{t("tech.tasks.viewFarmTasks")}</Text>
            </Pressable>
          </ScreenSection>
        ) : (
          <ScreenSection title={t("tech.dashboard.tasksToday")}>
            <ProfileSectionEmpty>{t("tech.tasks.noFarm")}</ProfileSectionEmpty>
          </ScreenSection>
        )}
      </View>
    </TechMobileShell>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center" },
  btn: {
    backgroundColor: techColors.primary,
    padding: mobileSpacing.md,
    borderRadius: techRadius.button,
    alignItems: "center"
  },
  btnText: {
    color: mobileColors.background,
    fontWeight: "700",
    textAlign: "center"
  }
});
