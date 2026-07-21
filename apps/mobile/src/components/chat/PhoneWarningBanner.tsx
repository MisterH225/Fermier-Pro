import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { mobileRadius, mobileFontSize } from "../../theme/mobileTheme";
import { uiNamedColors } from "../../theme/uiNamedColors";

export type PhoneWarningVariant =
  | "realtime_warning"
  | "text_masked"
  | "image_blocked";

type Props = {
  variant: PhoneWarningVariant;
  visible: boolean;
  message: string;
  onHide?: () => void;
};

export function PhoneWarningBanner({
  variant,
  visible,
  message,
  onHide
}: Props) {
  const slide = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true
    }).start(({ finished }) => {
      if (finished && !visible) {
        onHide?.();
      }
    });
  }, [visible, slide, onHide]);

  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0]
  });

  return (
    <Animated.View
      style={[
        styles.wrap,
        variant === "realtime_warning" && styles.wrapRealtime,
        { opacity: slide, transform: [{ translateY }] }
      ]}
      accessibilityRole="text"
    >
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: uiNamedColors.cFFF8E7,
    borderWidth: 1,
    borderColor: uiNamedColors.cBA7517,
    borderRadius: mobileRadius.sm
  },
  wrapRealtime: {
    minHeight: 32,
    marginBottom: 4
  },
  icon: {
    fontSize: mobileFontSize.lg,
    lineHeight: 18
  },
  text: {
    flex: 1,
    fontSize: mobileFontSize.sm,
    lineHeight: 16,
    color: uiNamedColors.cBA7517
  }
});
