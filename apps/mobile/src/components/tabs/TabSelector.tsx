import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

const TAB_TOP_RADIUS = 22;
const TAB_CURVE = 14;

export type TabSelectorItem = {
  key: string;
  label: string;
  /** Pastille optionnelle (ex. compteur, mois). */
  badge?: string | number;
  content: ReactNode;
};

export type TabSelectorProps = {
  tabs: TabSelectorItem[];
  defaultTab?: string;
  activeTab?: string;
  onTabChange?: (key: string) => void;
  header?: ReactNode;
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

export function TabSelector({
  tabs,
  defaultTab,
  activeTab: controlledTab,
  onTabChange,
  header
}: TabSelectorProps) {
  const initialKey = defaultTab ?? tabs[0]?.key ?? "";
  const [internalKey, setInternalKey] = useState(initialKey);
  const activeKey = controlledTab ?? internalKey;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const switchTab = useCallback(
    (key: string) => {
      if (key === activeKey || !tabs.some((t) => t.key === key)) {
        return;
      }
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true
      }).start(({ finished }) => {
        if (!finished) {
          return;
        }
        if (controlledTab === undefined) {
          setInternalKey(key);
        }
        onTabChange?.(key);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        }).start();
      });
    },
    [activeKey, controlledTab, fadeAnim, onTabChange, tabs]
  );

  const activeTab = tabs.find((t) => t.key === activeKey) ?? tabs[0];

  return (
    <View style={styles.root}>
      {header ? <View style={styles.headerSlot}>{header}</View> : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabStrip}
        contentContainerStyle={styles.tabStripContent}
      >
        {tabs.map((tab) => {
          const active = tab.key === activeKey;
          if (active) {
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: true }}
                onPress={() => switchTab(tab.key)}
                style={styles.activeTabPressable}
              >
                <View style={styles.activeTabRow}>
                  <TabCurve side="left" />
                  <View style={styles.activeTabHead}>
                    <Text style={styles.activeTabLabel} numberOfLines={1}>
                      {tab.label}
                    </Text>
                    {tab.badge != null && tab.badge !== "" ? (
                      <TabBadge value={tab.badge} active />
                    ) : null}
                  </View>
                  <TabCurve side="right" />
                </View>
              </Pressable>
            );
          }
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: false }}
              onPress={() => switchTab(tab.key)}
              style={styles.inactiveTabPressable}
            >
              <Text style={styles.inactiveTabLabel} numberOfLines={1}>
                {tab.label}
              </Text>
              {tab.badge != null && tab.badge !== "" ? (
                <TabBadge value={tab.badge} />
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.contentShell}>
        <Animated.View style={[styles.contentInner, { opacity: fadeAnim }]}>
          {activeTab?.content}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    backgroundColor: mobileColors.canvas
  },
  headerSlot: {
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.sm,
    gap: mobileSpacing.sm
  },
  tabStrip: {
    flexGrow: 0,
    flexShrink: 0
  },
  tabStripContent: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.sm,
    gap: mobileSpacing.md,
    minHeight: 52
  },
  inactiveTabPressable: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    paddingBottom: mobileSpacing.md,
    paddingHorizontal: mobileSpacing.xs
  },
  inactiveTabLabel: {
    ...mobileTypography.cardTitle,
    fontSize: 16,
    color: mobileColors.textSecondary,
    fontWeight: "600"
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
    minHeight: 48
  },
  activeTabLabel: {
    ...mobileTypography.title,
    fontSize: 20,
    lineHeight: 26,
    color: mobileColors.textPrimary
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
    borderColor: mobileColors.accentSoft,
    backgroundColor: mobileColors.accentSoft
  },
  badgeText: {
    ...mobileTypography.meta,
    fontSize: 11,
    fontWeight: "700",
    color: mobileColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  badgeTextActive: {
    color: mobileColors.accent
  },
  contentShell: {
    flex: 1,
    minHeight: 0,
    marginHorizontal: mobileSpacing.lg,
    marginTop: -1,
    backgroundColor: mobileColors.background,
    borderBottomLeftRadius: mobileRadius.lg,
    borderBottomRightRadius: mobileRadius.lg,
    overflow: "hidden",
    ...{
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2
    }
  },
  contentInner: {
    flex: 1,
    minHeight: 0
  }
});
