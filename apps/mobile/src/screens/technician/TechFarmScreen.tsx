import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { TechMobileShell } from "../../components/layout/TechMobileShell";
import { useTechBottomChromePad } from "../../context/TechBottomChromeContext";
import { useSession } from "../../context/SessionContext";
import { fetchTechnicianDashboard } from "../../lib/api";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { techColors, techRadius } from "../../theme/technicianTheme";
import type { RootStackParamList } from "../../types/navigation";

const TABS = ["loges", "cheptel", "sante", "gestation"] as const;

export function TechFarmScreen() {
  const { t } = useTranslation();
  const bottomPad = useTechBottomChromePad();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken, activeProfileId } = useSession();
  const [tab, setTab] = useState<(typeof TABS)[number]>("loges");

  const dashQ = useQuery({
    queryKey: ["techDashboard", activeProfileId, "farm"],
    queryFn: () => fetchTechnicianDashboard(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const farm = dashQ.data?.farms[0];

  const open = () => {
    if (!farm) {
      return;
    }
    const params = { farmId: farm.farmId, farmName: farm.farmName };
    if (tab === "loges") {
      navigation.navigate("FarmBarns", params);
      return;
    }
    if (tab === "cheptel") {
      navigation.navigate("FarmLivestock", params);
      return;
    }
    if (tab === "sante") {
      navigation.navigate("FarmHealth", params);
      return;
    }
    navigation.navigate("FarmGestation", params);
  };

  return (
    <TechMobileShell hideTopBar>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingBottom: bottomPad }]}>
        <Text style={styles.title}>{t("tech.farm.title")}</Text>
        {dashQ.isLoading ? <ActivityIndicator color={techColors.primary} /> : null}
        {!farm && !dashQ.isLoading ? (
          <Text style={styles.hint}>{t("tech.tasks.noFarm")}</Text>
        ) : null}
        {farm ? (
          <>
            <Text style={styles.farmName}>{farm.farmName}</Text>
            <View style={styles.pills}>
              {TABS.map((k) => {
                const active = tab === k;
                return (
                  <Pressable
                    key={k}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() => setTab(k)}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>
                      {t(`tech.farm.tabs.${k}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable style={styles.btn} onPress={open}>
              <Text style={styles.btnText}>{t("tech.farm.openModule")}</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </TechMobileShell>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: mobileSpacing.lg, gap: mobileSpacing.md },
  title: { ...mobileTypography.cardTitle, fontSize: 20, color: techColors.textPrimary },
  farmName: { ...mobileTypography.body, color: techColors.textSecondary },
  hint: { ...mobileTypography.body, color: techColors.textSecondary },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.sm },
  pill: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 8,
    borderRadius: techRadius.pill,
    backgroundColor: techColors.cardBg,
    borderWidth: 1,
    borderColor: techColors.border
  },
  pillActive: { backgroundColor: techColors.primary, borderColor: techColors.primary },
  pillText: { ...mobileTypography.meta, fontWeight: "600", color: techColors.textSecondary },
  pillTextActive: { color: "#fff" },
  btn: {
    marginTop: mobileSpacing.md,
    backgroundColor: techColors.primary,
    padding: mobileSpacing.md,
    borderRadius: 14
  },
  btnText: { color: "#fff", fontWeight: "700", textAlign: "center" }
});
