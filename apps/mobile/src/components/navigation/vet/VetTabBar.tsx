import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { useTranslation } from "react-i18next";
import { mobileSpacing, mobileTypography } from "../../../theme/mobileTheme";
import { vetColors } from "../../../theme/vetTheme";
import { VET_NAV_BAR_HEIGHT } from "./vetNavMetrics";
import type { VetMainTab } from "./types";

type VetTabBarProps = {
  activeTab: VetMainTab | null;
  onTabPress: (tab: VetMainTab) => void;
  onOpenExtended: () => void;
};

const TAB_ORDER: VetMainTab[] = ["home", "agenda", "farms", "messages"];

const TAB_META: Record<VetMainTab, { emoji: string; labelKey: string }> = {
  home: { emoji: "🏠", labelKey: "vet.nav.home" },
  agenda: { emoji: "🗓️", labelKey: "vet.nav.agenda" },
  farms: { emoji: "🏥", labelKey: "vet.nav.farms" },
  messages: { emoji: "💬", labelKey: "vet.nav.messages" }
};

const H = VET_NAV_BAR_HEIGHT;

function VetNavItem({
  emoji,
  label,
  active,
  onPress,
  a11y
}: {
  emoji: string;
  label: string;
  active: boolean;
  onPress: () => void;
  a11y: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({ pressed }) => [styles.hit, pressed && { opacity: 0.88 }]}
    >
      <View
        style={[
          styles.iconWrap,
          active && { backgroundColor: vetColors.primary }
        ]}
      >
        <Text style={[styles.emoji, { opacity: active ? 1 : 0.45 }]}>{emoji}</Text>
      </View>
      <Text
        style={[
          styles.label,
          { color: active ? vetColors.primary : vetColors.textSecondary }
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function VetTabBar({ activeTab, onTabPress, onOpenExtended }: VetTabBarProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const pillBorder = dark ? "rgba(255,255,255,0.14)" : vetColors.border;
  const pillOverlay = dark ? "rgba(34,34,36,0.28)" : "rgba(255,255,255,0.85)";
  const plusOverlay = dark ? "rgba(45,45,48,0.32)" : vetColors.primaryLight;
  const blurTint = dark ? "dark" : "light";

  return (
    <View style={styles.row} pointerEvents="box-none">
      <BlurView
        intensity={dark ? 28 : 40}
        tint={blurTint}
        style={[styles.pill, { height: H, borderColor: pillBorder }]}
      >
        <View style={[styles.pillOverlay, { backgroundColor: pillOverlay }]}>
          {TAB_ORDER.map((tab) => {
            const meta = TAB_META[tab];
            return (
              <VetNavItem
                key={tab}
                emoji={meta.emoji}
                label={t(meta.labelKey)}
                active={activeTab === tab}
                onPress={() => onTabPress(tab)}
                a11y={t(meta.labelKey)}
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
          { width: H, height: H, borderRadius: H / 2, borderColor: pillBorder, opacity: pressed ? 0.92 : 1 }
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
        <Ionicons name="add" size={Math.round(H * 0.38)} color={vetColors.primary} />
        <Text style={[styles.plusLabel, { color: vetColors.textSecondary }]} numberOfLines={1}>
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
    borderRadius: 999,
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
  hit: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    gap: 1
  },
  iconWrap: {
    minWidth: 36,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8
  },
  emoji: { fontSize: 18 },
  label: {
    ...mobileTypography.meta,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "600"
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
