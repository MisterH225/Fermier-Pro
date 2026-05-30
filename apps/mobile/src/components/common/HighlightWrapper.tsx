import { useEffect, useRef } from "react";
import { Animated, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { mobileColors } from "../../theme/mobileTheme";

const HIGHLIGHT_MS = 2000;

type Props = {
  active: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Surbrillance temporaire (pulse) pour cibler un élément ouvert depuis une alerte.
 */
export function HighlightWrapper({ active, children, style }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      pulse.setValue(0);
      return;
    }
    pulse.setValue(1);
    const anim = Animated.sequence([
      Animated.timing(pulse, {
        toValue: 0.35,
        duration: 400,
        useNativeDriver: false
      }),
      Animated.timing(pulse, {
        toValue: 0.12,
        duration: 400,
        useNativeDriver: false
      }),
      Animated.timing(pulse, {
        toValue: 0,
        duration: HIGHLIGHT_MS - 800,
        useNativeDriver: false
      })
    ]);
    anim.start();
    return () => anim.stop();
  }, [active, pulse]);

  if (!active) {
    return <>{children}</>;
  }

  const backgroundColor = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: ["transparent", mobileColors.accentSoft]
  });

  const borderColor = pulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["transparent", mobileColors.accent, "transparent"]
  });

  return (
    <Animated.View
      style={[
        styles.wrap,
        style,
        { backgroundColor, borderColor }
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 12,
    borderWidth: 2
  }
});
