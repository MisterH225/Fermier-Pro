import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { mobileSpacing, mobileTypography } from "../../../theme/mobileTheme";
import { vetColors, vetRadius, vetShadow } from "../../../theme/vetTheme";
import { VET_NAV_BAR_HEIGHT } from "./vetNavMetrics";
import type { VetMainTab } from "./types";

type VetTabBarProps = {
  activeTab: VetMainTab | null;
  onTabPress: (tab: VetMainTab) => void;
  onOpenExtended: () => void;
};

const TAB_ORDER: VetMainTab[] = ["home", "agenda", "farms", "messages"];

type TabIcon = keyof typeof Ionicons.glyphMap;

const TAB_META: Record<
  VetMainTab,
  { icon: TabIcon; iconOutline: TabIcon; labelKey: string }
> = {
  home: { icon: "home", iconOutline: "home-outline", labelKey: "vet.nav.home" },
  agenda: {
    icon: "calendar",
    iconOutline: "calendar-outline",
    labelKey: "vet.nav.agenda"
  },
  farms: {
    icon: "business",
    iconOutline: "business-outline",
    labelKey: "vet.nav.farms"
  },
  messages: {
    icon: "chatbubbles",
    iconOutline: "chatbubbles-outline",
    labelKey: "vet.nav.messages"
  }
};

const H = VET_NAV_BAR_HEIGHT;

function VetNavItem({
  icon,
  iconOutline,
  label,
  active,
  onPress,
  a11y
}: {
  icon: TabIcon;
  iconOutline: TabIcon;
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
      style={({ pressed }) => [styles.hit, pressed && { opacity: 0.9 }]}
    >
      {active ? (
        <View style={styles.activePill}>
          <Ionicons name={icon} size={17} color={vetColors.onPrimary} />
          <Text style={styles.labelActive} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ) : (
        <>
          <Ionicons name={iconOutline} size={22} color={vetColors.textMuted} />
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function VetTabBar({ activeTab, onTabPress, onOpenExtended }: VetTabBarProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.row} pointerEvents="box-none">
      <View style={[styles.pill, vetShadow.floating, { height: H }]}>
        {TAB_ORDER.map((tab) => {
          const meta = TAB_META[tab];
          return (
            <VetNavItem
              key={tab}
              icon={meta.icon}
              iconOutline={meta.iconOutline}
              label={t(meta.labelKey)}
              active={activeTab === tab}
              onPress={() => onTabPress(tab)}
              a11y={t(meta.labelKey)}
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
          vetShadow.floating,
          { width: H, height: H, borderRadius: H / 2, opacity: pressed ? 0.92 : 1 }
        ]}
      >
        <Ionicons name="add" size={Math.round(H * 0.36)} color={vetColors.primary} />
        <Text style={styles.plusLabel} numberOfLines={1}>
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
    borderRadius: vetRadius.pill,
    backgroundColor: vetColors.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: vetColors.border,
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
    paddingVertical: 4,
    gap: 2
  },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: vetColors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: vetRadius.pill,
    maxWidth: "100%"
  },
  label: {
    ...mobileTypography.meta,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "600",
    color: vetColors.textMuted
  },
  labelActive: {
    ...mobileTypography.meta,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "700",
    color: vetColors.onPrimary
  },
  plusOuter: {
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    paddingVertical: 4,
    backgroundColor: vetColors.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: vetColors.border
  },
  plusLabel: {
    ...mobileTypography.meta,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "600",
    color: vetColors.textSecondary
  }
});
