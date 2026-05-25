import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { VetMobileShell } from "../../components/layout";
import { useVetBottomChromePad } from "../../context/VetBottomChromeContext";
import { vetColors } from "../../theme/vetTheme";
import { mobileSpacing } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

const TABS = ["health", "livestock", "history", "tasks"] as const;

export function VetFarmDetailScreen() {
  const { t } = useTranslation();
  const route = useRoute<RouteProp<RootStackParamList, "VetFarmDetail">>();
  const { farmId, farmName } = route.params;
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomPad = useVetBottomChromePad();
  const [tab, setTab] = useState<(typeof TABS)[number]>("health");

  return (
    <VetMobileShell hideTopBar>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingBottom: bottomPad }]}>
        <View style={styles.tabs}>
          {TABS.map((id) => (
            <Pressable
              key={id}
              style={[styles.tab, tab === id && styles.tabOn]}
              onPress={() => setTab(id)}
            >
              <Text style={[styles.tabTx, tab === id && styles.tabTxOn]}>
                {t(`vet.farmDetail.tabs.${id}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === "health" ? (
          <View style={styles.block}>
            <Text style={styles.hint}>{t("vet.farmDetail.healthHint")}</Text>
            <Pressable
              style={styles.btn}
              onPress={() =>
                navigation.navigate("FarmHealth", { farmId, farmName, initialTab: "overview" })
              }
            >
              <Text style={styles.btnTx}>{t("vet.farmDetail.openHealth")}</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnOutline]}
              onPress={() =>
                navigation.navigate("FarmHealth", { farmId, farmName, initialTab: "disease" })
              }
            >
              <Text style={[styles.btnTx, styles.btnTxOutline]}>
                {t("vet.farmDetail.declareCase")}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {tab === "livestock" ? (
          <Pressable
            style={styles.btn}
            onPress={() => navigation.navigate("FarmLivestock", { farmId, farmName })}
          >
            <Text style={styles.btnTx}>{t("vet.farmDetail.openLivestock")}</Text>
          </Pressable>
        ) : null}

        {tab === "history" ? (
          <Pressable
            style={styles.btn}
            onPress={() =>
              navigation.navigate("FarmVetConsultations", { farmId, farmName })
            }
          >
            <Text style={styles.btnTx}>{t("vet.farmDetail.openHistory")}</Text>
          </Pressable>
        ) : null}

        {tab === "tasks" ? (
          <Pressable
            style={styles.btn}
            onPress={() => navigation.navigate("FarmTasks", { farmId, farmName })}
          >
            <Text style={styles.btnTx}>{t("vet.farmDetail.openTasks")}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </VetMobileShell>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: mobileSpacing.lg, gap: mobileSpacing.md },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: mobileSpacing.md },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: vetColors.cardBg,
    borderWidth: 1,
    borderColor: vetColors.border
  },
  tabOn: { backgroundColor: vetColors.primary, borderColor: vetColors.primary },
  tabTx: { fontWeight: "600", color: vetColors.textSecondary, fontSize: 13 },
  tabTxOn: { color: "#fff" },
  block: { gap: mobileSpacing.sm },
  hint: { color: vetColors.textSecondary, marginBottom: mobileSpacing.sm },
  btn: {
    backgroundColor: vetColors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center"
  },
  btnOutline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: vetColors.primary
  },
  btnTx: { color: "#fff", fontWeight: "700" },
  btnTxOutline: { color: vetColors.primary }
});
