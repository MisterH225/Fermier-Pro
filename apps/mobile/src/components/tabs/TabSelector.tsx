import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  ScrollView,
  StyleSheet,
  View
} from "react-native";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing
} from "../../theme/mobileTheme";
import { TabItem } from "./TabItem";

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
  /** Préfixe testID pour les onglets (ex. `finance-tab`). */
  testIDPrefix?: string;
};

/** Alias sémantique : barre de sous-onglets module (Cheptel, Santé, Finance, Com). */
export const SubMenuTabs = TabSelector;

export function TabSelector({
  tabs,
  defaultTab,
  activeTab: controlledTab,
  onTabChange,
  header,
  testIDPrefix = "submenu-tab"
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
    <View style={styles.root} testID={`${testIDPrefix}-bar`}>
      {header ? <View style={styles.headerSlot}>{header}</View> : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabStrip}
        contentContainerStyle={styles.tabStripContent}
      >
        {tabs.map((tab, index) => (
          <TabItem
            key={tab.key}
            label={tab.label}
            active={tab.key === activeKey}
            index={index}
            onPress={() => switchTab(tab.key)}
            badge={tab.badge}
            testID={`${testIDPrefix}-${tab.key}`}
          />
        ))}
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
  contentShell: {
    flex: 1,
    minHeight: 0,
    marginHorizontal: mobileSpacing.lg,
    marginTop: -1,
    backgroundColor: mobileColors.surfaceMuted,
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
