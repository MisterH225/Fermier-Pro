import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  useColorScheme,
  View
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";import { mobileSpacing } from "../../theme/mobileTheme";
import { ExtendedMenuItem } from "./ExtendedMenuItem";
import type { ExtendedNavMenuId } from "./types";

const GRID_GAP = mobileSpacing.md;
const H_PAD = mobileSpacing.lg;

type ExtendedMenuGridProps = {
  visible: boolean;
  onClose: () => void;
  items: Array<{
    id: ExtendedNavMenuId;
    emoji: string;
    label: string;
    a11y: string;
  }>;
  onSelect: (id: ExtendedNavMenuId) => void;
};

export function ExtendedMenuGrid({
  visible,
  onClose,
  items,
  onSelect
}: ExtendedMenuGridProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    if (!visible) {
      return;
    }
    opacity.setValue(0);
    scale.setValue(0.94);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 9,
        tension: 80,
        useNativeDriver: true
      })
    ]).start();
  }, [visible, opacity, scale]);

  const runClose = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true
      }),
      Animated.timing(scale, {
        toValue: 0.96,
        duration: 160,
        useNativeDriver: true
      })
    ]).start(({ finished }) => {
      if (finished) {
        onClose();
      }
    });
  };

  const backdropTint = dark ? "rgba(0,0,0,0.72)" : "rgba(0,0,0,0.55)";
  const w = Dimensions.get("window").width - H_PAD * 2;
  const colW = (w - GRID_GAP * 2) / 3;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={runClose}
    >
      <View style={styles.modalRoot} pointerEvents="box-none">
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: backdropTint }]}
          onPress={runClose}
          accessibilityLabel={t("navigation.extended.closeBackdropA11y")}
        />
        <Animated.View
          style={[
            styles.centerBlock,
            {
              paddingTop: insets.top + mobileSpacing.lg,
              paddingBottom: insets.bottom + 72,
              opacity,
              transform: [{ scale }]
            }
          ]}
          pointerEvents="box-none"
        >
          <View style={[styles.grid, { width: w, gap: GRID_GAP }]}>
            {items.map((item) => (
              <View key={item.id} style={{ width: colW, flexBasis: colW }}>
                <ExtendedMenuItem
                  emoji={item.emoji}
                  label={item.label}
                  accessibilityLabel={item.a11y}
                  onPress={() => onSelect(item.id)}
                />
              </View>
            ))}
          </View>
        </Animated.View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("navigation.extended.closeA11y")}
          onPress={runClose}
          style={[
            styles.closeFab,
            {
              bottom: Math.max(insets.bottom, mobileSpacing.md) + mobileSpacing.sm,
              right: Math.max(insets.right, mobileSpacing.md) + mobileSpacing.sm
            }
          ]}
        >
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  centerBlock: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center"
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center"
  },
  closeFab: {
    position: "absolute",
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(60,60,60,0.95)",
    alignItems: "center",
    justifyContent: "center"
  }
});
