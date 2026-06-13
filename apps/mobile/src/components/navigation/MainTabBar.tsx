import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { NavItem } from "./NavItem";
import { PRODUCER_NAV_BAR_HEIGHT } from "./producerNavMetrics";
import type { ProducerMainTab } from "./types";

type MainTabBarProps = {
  tabs: ProducerMainTab[];
  activeTab: ProducerMainTab | null;
  onTabPress: (tab: ProducerMainTab) => void;
  onOpenExtended: () => void;
  financeEnabled: boolean;
  feedBadgeCount?: number;
};

const TAB_ORDER: ProducerMainTab[] = [
  "home",
  "cheptel",
  "health",
  "feed",
  "finance"
];

const TAB_META: Record<
  ProducerMainTab,
  { emoji: string; labelKey: string }
> = {
  home: { emoji: "🏠", labelKey: "navigation.main.home" },
  cheptel: { emoji: "🐷", labelKey: "navigation.main.cheptel" },
  health: { emoji: "🏥", labelKey: "navigation.main.health" },
  feed: { emoji: "🌱", labelKey: "navigation.main.feed" },
  finance: { emoji: "💰", labelKey: "navigation.main.finance" }
};

const H = PRODUCER_NAV_BAR_HEIGHT;

const glassShadow = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 4
} as const;

export function MainTabBar({
  tabs,
  activeTab,
  onTabPress,
  onOpenExtended,
  financeEnabled,
  feedBadgeCount = 0
}: MainTabBarProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const dark = scheme === "dark";

  const pillBorder = dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.06)";
  const pillOverlay = dark ? "rgba(34,34,36,0.28)" : "rgba(255,255,255,0.22)";
  const plusOverlay = dark ? "rgba(45,45,48,0.32)" : "rgba(255,255,255,0.28)";
  const plusIcon = dark ? mobileColors.onAccent : mobileColors.accent;
  const blurTint = dark ? "dark" : "light";

  const ordered = TAB_ORDER.filter((tab) => tabs.includes(tab));

  return (
    <View style={styles.row} pointerEvents="box-none">
      <BlurView
        intensity={dark ? 28 : 40}
        tint={blurTint}
        style={[
          styles.pill,
          {
            height: H,
            minHeight: H,
            borderColor: pillBorder,
            ...glassShadow
          }
        ]}
      >
        <View style={[styles.pillOverlay, { backgroundColor: pillOverlay }]}>
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
                label={t(meta.labelKey)}
                active={activeTab === tab}
                onPress={() => onTabPress(tab)}
                accessibilityLabel={t(meta.labelKey)}
                badgeCount={tab === "feed" ? feedBadgeCount : undefined}
              />
            );
          })}
        </View>
      </BlurView>
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
            borderColor: pillBorder,
            opacity: pressed ? 0.92 : 1,
            ...glassShadow
          }
        ]}
      >
        <BlurView
          intensity={dark ? 28 : 40}
          tint={blurTint}
          style={[StyleSheet.absoluteFill, { borderRadius: H / 2, overflow: "hidden" }]}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: H / 2, backgroundColor: plusOverlay }
          ]}
        />
        <Ionicons name="add" size={Math.round(H * 0.38)} color={plusIcon} />
        <Text
          style={[
            styles.plusLabel,
            { color: dark ? "rgba(255,255,255,0.72)" : mobileColors.textSecondary }
          ]}
          numberOfLines={1}
        >
          {t("navigation.extended.menuShort")}
        </Text>
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
    minWidth: 0,
    borderRadius: mobileRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden"
  },
  pillOverlay: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingHorizontal: mobileSpacing.xs
  },
  plusOuter: {
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden"
  },
  plusLabel: {
    ...mobileTypography.meta,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "600"
  }
});
