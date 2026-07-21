import { Pressable, StyleSheet, Text, View } from "react-native";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import {
  getInactiveAccentColor,
  getTabLabelColor,
  tabColors
} from "../../theme/tabColors";

const TAB_TOP_RADIUS = 22;
const TAB_CURVE = 14;

export type TabItemProps = {
  label: string;
  active: boolean;
  /** Position dans la barre d'onglets (rotation des accents inactifs). */
  index: number;
  onPress: () => void;
  badge?: string | number;
  testID?: string;
};

function TabCurve({ side }: { side: "left" | "right" }) {
  return (
    <View
      style={[
        styles.tabCurve,
        side === "left" ? styles.tabCurveLeft : styles.tabCurveRight
      ]}
    />
  );
}

function TabBadge({
  value,
  active
}: {
  value: string | number;
  active?: boolean;
}) {
  const text = String(value);
  return (
    <View style={[styles.badge, active && styles.badgeActive]}>
      <Text style={[styles.badgeText, active && styles.badgeTextActive]}>
        {text}
      </Text>
    </View>
  );
}

/**
 * Onglet réutilisable pour SubMenuTabs / TabSelector.
 * Consomme `tabColors` : actif terracotta + soulignement, inactif gris + accent positionnel.
 */
export function TabItem({
  label,
  active,
  index,
  onPress,
  badge,
  testID
}: TabItemProps) {
  const labelColor = getTabLabelColor(active, index);
  const inactiveAccent = getInactiveAccentColor(index);

  if (active) {
    return (
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: true }}
        onPress={onPress}
        style={styles.activeTabPressable}
        testID={testID}
      >
        <View style={styles.activeTabRow}>
          <TabCurve side="left" />
          <View style={styles.activeTabHead}>
            <Text
              style={[styles.activeTabLabel, { color: labelColor }]}
              numberOfLines={1}
            >
              {label}
            </Text>
            {badge != null && badge !== "" ? (
              <TabBadge value={badge} active />
            ) : null}
            <View
              style={[styles.activeUnderline, { backgroundColor: tabColors.ACTIVE }]}
            />
          </View>
          <TabCurve side="right" />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: false }}
      onPress={onPress}
      style={styles.inactiveTabPressable}
      testID={testID}
    >
      <Text
        style={[styles.inactiveTabLabel, { color: labelColor }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {badge != null && badge !== "" ? <TabBadge value={badge} /> : null}
      <View
        style={[styles.inactiveAccent, { backgroundColor: inactiveAccent }]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inactiveTabPressable: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    paddingBottom: mobileSpacing.md,
    paddingHorizontal: mobileSpacing.xs,
    position: "relative"
  },
  inactiveTabLabel: {
    ...mobileTypography.cardTitle,
    fontSize: mobileFontSize.lg,
    fontWeight: "500"
  },
  inactiveAccent: {
    position: "absolute",
    bottom: mobileSpacing.sm,
    left: mobileSpacing.xs,
    right: mobileSpacing.xs,
    height: 2,
    borderRadius: mobileRadius.sm,
    opacity: 0.45
  },
  activeTabPressable: {
    alignSelf: "flex-end"
  },
  activeTabRow: {
    flexDirection: "row",
    alignItems: "flex-end"
  },
  activeTabHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    backgroundColor: mobileColors.background,
    paddingTop: mobileSpacing.md,
    paddingBottom: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.lg,
    borderTopLeftRadius: TAB_TOP_RADIUS,
    borderTopRightRadius: TAB_TOP_RADIUS,
    minHeight: 48,
    position: "relative"
  },
  activeTabLabel: {
    ...mobileTypography.title,
    fontSize: mobileFontSize.xl,
    lineHeight: 26,
    fontWeight: "700"
  },
  activeUnderline: {
    position: "absolute",
    bottom: 6,
    left: mobileSpacing.lg,
    right: mobileSpacing.lg,
    height: 2,
    borderRadius: mobileRadius.sm
  },
  tabCurve: {
    width: TAB_CURVE,
    height: TAB_CURVE,
    backgroundColor: mobileColors.canvas
  },
  tabCurveLeft: {
    borderBottomRightRadius: TAB_CURVE
  },
  tabCurveRight: {
    borderBottomLeftRadius: TAB_CURVE
  },
  badge: {
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 3,
    borderRadius: mobileRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.surfaceMuted
  },
  badgeActive: {
    borderColor: tabColors.ACTIVE,
    backgroundColor: `${tabColors.ACTIVE}18`
  },
  badgeText: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.xs,
    fontWeight: "700",
    color: tabColors.INACTIVE_TEXT,
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  badgeTextActive: {
    color: tabColors.ACTIVE
  }
});
