import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { CardContentSkeleton } from "../../components/common/SkeletonBlocks";
import {
  ProfileSectionEmpty,
  profileScreenScrollContent,
  ScreenSection
} from "../../components/layout";
import { TechMobileShell } from "../../components/layout/TechMobileShell";
import { useTechBottomChromePad } from "../../context/TechBottomChromeContext";
import { useSession } from "../../context/SessionContext";
import { fetchTechnicianDashboard } from "../../lib/api";
import {
  canTechViewFarmModule,
  canTechWriteFarmModule,
  type TechFarmModuleKey
} from "../../lib/technicianPermissions";
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
  const moduleKey = tab as TechFarmModuleKey;
  const canView = farm ? canTechViewFarmModule(farm.scopes, moduleKey) : false;
  const canWrite = farm ? canTechWriteFarmModule(farm.scopes, moduleKey) : false;

  const open = () => {
    if (!farm) {
      return;
    }
    if (!canView) {
      Alert.alert("", t("tech.permissionDenied"));
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
      <ScrollView
        contentContainerStyle={[
          profileScreenScrollContent,
          { paddingBottom: bottomPad + mobileSpacing.xl }
        ]}
      >
        {dashQ.isLoading ? (
          <CardContentSkeleton lines={5} />
        ) : null}
        {!farm && !dashQ.isLoading ? (
          <ProfileSectionEmpty>{t("tech.tasks.noFarm")}</ProfileSectionEmpty>
        ) : null}

        {farm ? (
          <>
            <ScreenSection title={farm.farmName}>
              <Text style={styles.farmMeta}>{farm.role}</Text>
            </ScreenSection>

            <ScreenSection title={t("tech.farm.sectionModules")}>
              <View style={styles.pills}>
                {TABS.map((k) => {
                  const active = tab === k;
                  const viewOk = canTechViewFarmModule(farm.scopes, k);
                  const writeOk = canTechWriteFarmModule(farm.scopes, k);
                  return (
                    <Pressable
                      key={k}
                      style={[
                        styles.pill,
                        active && styles.pillActive,
                        !viewOk && styles.pillDisabled
                      ]}
                      onPress={() => setTab(k)}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          active && styles.pillTextActive,
                          !viewOk && styles.pillTextDisabled
                        ]}
                      >
                        {t(`tech.farm.tabs.${k}`)}
                      </Text>
                      {viewOk && !writeOk ? (
                        <Text
                          style={[
                            styles.pillBadge,
                            active && styles.pillBadgeActive
                          ]}
                        >
                          {t("tech.farmReadOnlyBadge")}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </ScreenSection>

            <ScreenSection title={t("tech.farm.sectionAction")}>
              <Pressable
                style={[styles.btn, !canView && styles.btnDisabled]}
                onPress={open}
                disabled={!canView}
              >
                <Text style={[styles.btnText, !canView && styles.btnTextDisabled]}>
                  {t("tech.farm.openModule")}
                </Text>
                {canView && !canWrite ? (
                  <Text style={styles.btnHint}>{t("tech.farmReadOnlyBadge")}</Text>
                ) : null}
              </Pressable>
            </ScreenSection>
          </>
        ) : null}
      </ScrollView>
    </TechMobileShell>
  );
}

const styles = StyleSheet.create({
  loader: { marginVertical: mobileSpacing.lg },
  farmMeta: { ...mobileTypography.body, color: techColors.textSecondary },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.sm },
  pill: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 8,
    borderRadius: techRadius.pill,
    backgroundColor: techColors.primaryLight,
    borderWidth: 1,
    borderColor: techColors.border,
    alignItems: "center",
    gap: 2
  },
  pillActive: { backgroundColor: techColors.primary, borderColor: techColors.primary },
  pillDisabled: { opacity: 0.45 },
  pillText: { ...mobileTypography.meta, fontWeight: "600", color: techColors.textSecondary },
  pillTextActive: { color: "#fff" },
  pillTextDisabled: { color: techColors.textSecondary },
  pillBadge: {
    fontSize: 10,
    fontWeight: "600",
    color: techColors.textSecondary
  },
  pillBadgeActive: { color: "rgba(255,255,255,0.85)" },
  btn: {
    backgroundColor: techColors.primary,
    padding: mobileSpacing.md,
    borderRadius: techRadius.button,
    alignItems: "center",
    gap: 4
  },
  btnDisabled: {
    backgroundColor: techColors.primaryLight,
    borderWidth: 1,
    borderColor: techColors.border
  },
  btnText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  btnTextDisabled: { color: techColors.textSecondary },
  btnHint: { fontSize: 11, color: "rgba(255,255,255,0.9)", fontWeight: "600" }
});
