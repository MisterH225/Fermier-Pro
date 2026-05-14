import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, useColorScheme, View } from "react-native";
import { useTranslation } from "react-i18next";
import { mobileColors, mobileRadius, mobileSpacing } from "../../theme/mobileTheme";
import { NavItem } from "./NavItem";
import { PRODUCER_NAV_BAR_HEIGHT } from "./producerNavMetrics";
import type { ProducerMainTab } from "./types";

type MainTabBarProps = {
  tabs: ProducerMainTab[];
  activeTab: ProducerMainTab | null;
  onTabPress: (tab: ProducerMainTab) => void;
  onOpenExtended: () => void;
  financeEnabled: boolean;
};

const TAB_ORDER: ProducerMainTab[] = ["home", "cheptel", "health", "finance"];

const TAB_META: Record<
  ProducerMainTab,
  { emoji: string; labelKey: string }
> = {
  home: { emoji: "🏠", labelKey: "navigation.main.home" },
  cheptel: { emoji: "🐷", labelKey: "navigation.main.cheptel" },
  health: { emoji: "🏥", labelKey: "navigation.main.health" },
  finance: { emoji: "💰", labelKey: "navigation.main.finance" }
};

const H = PRODUCER_NAV_BAR_HEIGHT;

const glassShadow = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 10,
  elevation: 6
} as const;

export function MainTabBar({
  tabs,
  activeTab,
  onTabPress,
  onOpenExtended,
  financeEnabled
}: MainTabBarProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const dark = scheme === "dark";

  const pillBg = dark ? "rgba(34,34,36,0.72)" : "rgba(255,255,255,0.78)";
  const pillBorder = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";
  const plusBg = dark ? "rgba(45,45,48,0.78)" : "rgba(255,255,255,0.88)";
  const plusIcon = dark ? "#FFFFFF" : mobileColors.accent;

  const ordered = TAB_ORDER.filter((tab) => tabs.includes(tab));

  return (
    <View style={styles.row} pointerEvents="box-none">
      <View
        style={[
          styles.pill,
          {
            height: H,
            minHeight: H,
            backgroundColor: pillBg,
            borderColor: pillBorder,
            ...glassShadow
          }
        ]}
      >
        {ordered.map((tab) => {
          const meta = TAB_META[tab];
          const disabled = tab === "finance" && !financeEnabled;
          if (disabled) {
            return null;
          }
          return (
            <NavItem
              key={tab}
              dense
              emoji={meta.emoji}
              active={activeTab === tab}
              onPress={() => onTabPress(tab)}
              accessibilityLabel={t(meta.labelKey)}
            />
          );
        })}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("navigation.extended.openA11y")}
        onPress={onOpenExtended}
        style={({ pressed }) => [
          styles.plusOuter,
          {
            width: H,
            height: H,
            borderRadius: H / 2,
            backgroundColor: plusBg,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: pillBorder,
            ...glassShadow,
            opacity: pressed ? 0.92 : 1
          }
        ]}
      >
        <Ionicons name="add" size={Math.round(H * 0.46)} color={plusIcon} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    pointerEvents: "box-none"
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    minWidth: 0,
    paddingHorizontal: mobileSpacing.xs,
    borderRadius: mobileRadius.pill,
    borderWidth: StyleSheet.hairlineWidth
  },
  plusOuter: {
    alignItems: "center",
    justifyContent: "center"
  }
});
