import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

const SHEET_TOP_RADIUS = 24;

export type BaseModalSecondaryAction = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
};

export type BaseModalProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  statusBadge?: { label: string; tone?: "warning" | "neutral" };
  headerAmount?: string;
  children: React.ReactNode;
  footerPrimary?: React.ReactNode;
  secondaryActions?: BaseModalSecondaryAction[];
  destructiveAction?: { label: string; onPress: () => void };
  dismissible?: boolean;
  sheetMaxHeight?: number | `${number}%`;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export function BaseModal({
  visible,
  onClose,
  title,
  statusBadge,
  headerAmount,
  children,
  footerPrimary,
  secondaryActions,
  destructiveAction,
  dismissible = true,
  sheetMaxHeight = "88%",
  contentContainerStyle
}: BaseModalProps) {
  const insets = useSafeAreaInsets();
  const screenH = Dimensions.get("window").height;
  const translateY = useRef(new Animated.Value(screenH)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  const runClose = useMemo(
    () => () => {
      if (!dismissible) {
        return;
      }
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: screenH,
          duration: 240,
          useNativeDriver: true
        }),
        Animated.timing(backdrop, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true
        })
      ]).start(() => onClose());
    },
    [backdrop, dismissible, onClose, screenH, translateY]
  );

  useEffect(() => {
    if (visible) {
      translateY.setValue(screenH);
      backdrop.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 260,
          mass: 0.9
        }),
        Animated.timing(backdrop, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true
        })
      ]).start();
    } else {
      translateY.setValue(screenH);
      backdrop.setValue(0);
    }
  }, [visible, backdrop, screenH, translateY]);

  const handlePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        dismissible && Math.abs(g.dy) > 6 && g.dy > 0,
      onPanResponderRelease: (_, g) => {
        if (!dismissible) {
          return;
        }
        if (g.dy > 90 || g.vy > 0.9) {
          runClose();
        }
      }
    })
  ).current;

  const scrollBottomPad =
    Math.max(insets.bottom, mobileSpacing.md) +
    mobileSpacing.xl +
    (footerPrimary ? mobileSpacing.xxl + 56 : 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismissible ? runClose : () => undefined}
    >
      <View style={styles.root}>
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: "rgba(0,0,0,0.52)",
              opacity: backdrop
            }
          ]}
        />
        {dismissible ? (
          <Pressable style={StyleSheet.absoluteFill} onPress={runClose} />
        ) : (
          <View style={StyleSheet.absoluteFill} />
        )}
        <KeyboardAvoidingView
          style={styles.keyboardWrap}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 6 : 0}
        >
          <Animated.View
            style={[
              styles.sheet,
              {
                maxHeight: sheetMaxHeight,
                transform: [{ translateY }]
              }
            ]}
          >
            <View style={styles.handleZone} {...handlePan.panHandlers}>
              <View style={styles.handleBar} />
            </View>

            {(title || statusBadge) && (
              <View style={styles.headerRow}>
                {title ? (
                  <Text style={styles.title} numberOfLines={2}>
                    {title}
                  </Text>
                ) : (
                  <View />
                )}
                {statusBadge ? (
                  <View
                    style={[
                      styles.badge,
                      statusBadge.tone === "warning" && styles.badgeWarn
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeTx,
                        statusBadge.tone === "warning" && styles.badgeTxWarn
                      ]}
                    >
                      {statusBadge.label}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            {headerAmount ? (
              <Text style={styles.headerAmount}>{headerAmount}</Text>
            ) : null}

            <ScrollView
              style={styles.scroll}
              automaticallyAdjustKeyboardInsets
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces
              contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: scrollBottomPad },
                contentContainerStyle
              ]}
            >
              {children}

              {footerPrimary ? (
                <View style={styles.footerPrimary}>{footerPrimary}</View>
              ) : null}

              {(secondaryActions?.length || destructiveAction) ? (
                <View style={styles.sep} />
              ) : null}

              {secondaryActions && secondaryActions.length > 0 ? (
                <View style={styles.iconRow}>
                  {secondaryActions.map((a) => (
                    <Pressable
                      key={a.key}
                      style={styles.iconCell}
                      onPress={a.onPress}
                      accessibilityRole="button"
                      accessibilityLabel={a.label}
                    >
                      <View style={styles.iconCircle}>
                        <Ionicons
                          name={a.icon}
                          size={22}
                          color={mobileColors.textPrimary}
                        />
                      </View>
                      <Text style={styles.iconLabel} numberOfLines={1}>
                        {a.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {destructiveAction ? (
                <Pressable
                  style={styles.destructiveBtn}
                  onPress={destructiveAction.onPress}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={mobileColors.error}
                  />
                  <Text style={styles.destructiveTx}>
                    {destructiveAction.label}
                  </Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end"
  },
  keyboardWrap: {
    justifyContent: "flex-end",
    width: "100%"
  },
  sheet: {
    backgroundColor: mobileColors.canvas,
    borderTopLeftRadius: SHEET_TOP_RADIUS,
    borderTopRightRadius: SHEET_TOP_RADIUS,
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.xs,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 16
  },
  handleZone: {
    alignItems: "center",
    paddingVertical: mobileSpacing.sm
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.18)"
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing.md,
    marginBottom: mobileSpacing.sm
  },
  title: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    flex: 1
  },
  badge: {
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 4,
    borderRadius: mobileRadius.sm,
    backgroundColor: mobileColors.surfaceMuted
  },
  badgeWarn: {
    backgroundColor: "rgba(227, 160, 8, 0.18)"
  },
  badgeTx: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: mobileColors.textSecondary
  },
  badgeTxWarn: {
    color: mobileColors.warning
  },
  headerAmount: {
    ...mobileTypography.title,
    fontSize: 26,
    color: mobileColors.textPrimary,
    marginBottom: mobileSpacing.sm
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1
  },
  scrollContent: {
    paddingTop: mobileSpacing.xs,
    gap: mobileSpacing.md
  },
  footerPrimary: {
    marginTop: mobileSpacing.md
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: mobileColors.border,
    marginVertical: mobileSpacing.md
  },
  iconRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: mobileSpacing.sm
  },
  iconCell: {
    alignItems: "center",
    maxWidth: "25%"
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: mobileColors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center"
  },
  iconLabel: {
    ...mobileTypography.meta,
    marginTop: 4,
    color: mobileColors.textSecondary,
    fontWeight: "600"
  },
  destructiveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: mobileSpacing.sm,
    paddingVertical: mobileSpacing.md,
    borderRadius: mobileRadius.pill,
    backgroundColor: "rgba(214, 69, 69, 0.1)",
    marginBottom: mobileSpacing.xs
  },
  destructiveTx: {
    color: mobileColors.error,
    fontWeight: "700",
    fontSize: 16
  }
});
