import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { mobileSpacing, mobileTypography, mobileFontSize } from "../../../theme/mobileTheme";
import { techColors, techShadow, techRadius } from "../../../theme/technicianTheme";
import { TECH_NAV_BAR_HEIGHT } from "./techNavMetrics";
import type { TechMainTab } from "./types";

type Props = {
  activeTab: TechMainTab | null;
  onTabPress: (tab: TechMainTab) => void;
  onOpenExtended: () => void;
};

const TAB_ORDER: TechMainTab[] = [
  "home",
  "tasks",
  "vaccinations",
  "weighings",
  "feedStock"
];

const TAB_META: Record<
  TechMainTab,
  {
    icon: keyof typeof Ionicons.glyphMap;
    iconOutline: keyof typeof Ionicons.glyphMap;
    labelKey: string;
  }
> = {
  home: { icon: "home", iconOutline: "home-outline", labelKey: "tech.nav.home" },
  tasks: {
    icon: "checkbox",
    iconOutline: "checkbox-outline",
    labelKey: "tech.nav.tasks"
  },
  vaccinations: {
    icon: "medkit",
    iconOutline: "medkit-outline",
    labelKey: "tech.nav.vaccinations"
  },
  weighings: {
    icon: "scale",
    iconOutline: "scale-outline",
    labelKey: "tech.nav.weighings"
  },
  feedStock: {
    icon: "nutrition",
    iconOutline: "nutrition-outline",
    labelKey: "tech.nav.feedStock"
  }
};

const H = TECH_NAV_BAR_HEIGHT;

function NavItem({
  icon,
  iconOutline,
  label,
  active,
  onPress,
  a11y
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconOutline: keyof typeof Ionicons.glyphMap;
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
          <Ionicons name={icon} size={17} color={techColors.onPrimary} />
          <Text style={styles.labelActive} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ) : (
        <>
          <Ionicons name={iconOutline} size={22} color={techColors.textMuted} />
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function TechTabBar({ activeTab, onTabPress, onOpenExtended }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.row} pointerEvents="box-none">
      <View style={[styles.pill, techShadow.floating, { height: H }]}>
        {TAB_ORDER.map((tab) => {
          const meta = TAB_META[tab];
          return (
            <NavItem
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
          techShadow.floating,
          {
            width: H,
            height: H,
            borderRadius: H / 2,
            opacity: pressed ? 0.92 : 1
          }
        ]}
      >
        <Ionicons
          name="add"
          size={Math.round(H * 0.36)}
          color={techColors.primary}
        />
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
    borderRadius: techRadius.pill,
    backgroundColor: techColors.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: techColors.border,
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
    gap: 3,
    backgroundColor: techColors.primary,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: techRadius.pill,
    maxWidth: "100%"
  },
  label: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.xs,
    lineHeight: 10,
    fontWeight: "600",
    color: techColors.textMuted
  },
  labelActive: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.xs,
    lineHeight: 11,
    fontWeight: "700",
    color: techColors.onPrimary
  },
  plusOuter: {
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    paddingVertical: 4,
    backgroundColor: techColors.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: techColors.border
  },
  plusLabel: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.xs,
    lineHeight: 11,
    fontWeight: "600",
    color: techColors.textSecondary
  }
});
