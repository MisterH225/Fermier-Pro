import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { mobileColors, mobileSpacing } from "../../theme/mobileTheme";

export type AppTab = "home" | "cheptel" | "finance" | "health" | "collaboration" | "profile";

/** minHeight 64 + paddingBottom 8 — utilisé pour le FAB et la barre producteur fixe. */
export const BOTTOM_TAB_BAR_CONTENT_HEIGHT = 72;

type BottomTabBarProps = {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
  /** Sous-ensemble d’onglets (ordre conservé). Défaut : les 4. */
  tabs?: AppTab[];
};

const TAB_DEFS: Array<{
  key: AppTab;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: "home", labelKey: "shell.tabs.home", icon: "home-outline" },
  { key: "cheptel", labelKey: "shell.tabs.cheptel", icon: "albums-outline" },
  { key: "finance", labelKey: "shell.tabs.finance", icon: "trending-up-outline" },
  { key: "health", labelKey: "shell.tabs.health", icon: "medkit-outline" },
  { key: "collaboration", labelKey: "shell.tabs.collaboration", icon: "people-outline" },
  { key: "profile", labelKey: "shell.tabs.profile", icon: "person-outline" }
];

export function BottomTabBar({ activeTab, onChange, tabs }: BottomTabBarProps) {
  const { t } = useTranslation();
  const keys = tabs?.length
    ? tabs
    : (["home", "cheptel", "health", "profile"] as AppTab[]);
  const items = TAB_DEFS.filter((d) => keys.includes(d.key));
  return (
    <View style={styles.wrap}>
      {items.map((item) => {
        const active = item.key === activeTab;
        return (
          <TouchableOpacity
            key={item.key}
            style={styles.tab}
            onPress={() => onChange(item.key)}
            activeOpacity={0.9}
          >
            <Ionicons
              name={item.icon}
              size={22}
              color={active ? mobileColors.accent : mobileColors.textSecondary}
            />
            <Text style={[styles.label, active && styles.labelActive]}>
              {t(item.labelKey)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 64,
    paddingBottom: 8,
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mobileColors.border,
    backgroundColor: mobileColors.background
  },
  tab: {
    flex: 1,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingTop: mobileSpacing.xs
  },
  label: {
    fontSize: 11,
    color: mobileColors.textSecondary
  },
  labelActive: {
    color: mobileColors.accent,
    fontWeight: "600"
  },
});
