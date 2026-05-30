import { useRef, useState } from "react";
import {
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
  type ReactNode
} from "react-native";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type ExpandableBadge = {
  label: string;
  color: string;
  textColor?: string;
};

type Props = {
  title: string;
  badge?: ExpandableBadge | null;
  defaultExpanded?: boolean;
  children: ReactNode;
};

export function ExpandableSection({
  title,
  badge,
  defaultExpanded = false,
  children
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const rotateAnim = useRef(
    new Animated.Value(defaultExpanded ? 1 : 0)
  ).current;

  const toggle = () => {
    LayoutAnimation.configureNext({
      duration: 300,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity
      },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity
      }
    });
    Animated.timing(rotateAnim, {
      toValue: expanded ? 0 : 1,
      duration: 300,
      useNativeDriver: true
    }).start();
    setExpanded((v) => !v);
  };

  const chevronRotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"]
  });

  return (
    <View style={styles.wrap}>
      <Pressable
        style={({ pressed }) => [styles.header, pressed && { opacity: 0.9 }]}
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerRight}>
          {badge ? (
            <View style={[styles.badge, { backgroundColor: badge.color }]}>
              <Text
                style={[
                  styles.badgeTx,
                  badge.textColor ? { color: badge.textColor } : null
                ]}
                numberOfLines={1}
              >
                {badge.label}
              </Text>
            </View>
          ) : null}
          <Animated.Text
            style={[styles.chevron, { transform: [{ rotate: chevronRotation }] }]}
          >
            ▼
          </Animated.Text>
        </View>
      </Pressable>
      {expanded ? (
        <View style={styles.body}>
          <View style={styles.divider} />
          <View style={styles.content}>{children}</View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.surfaceMuted,
    overflow: "hidden"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    gap: mobileSpacing.sm
  },
  title: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    flex: 1
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    flexShrink: 0
  },
  badge: {
    borderRadius: mobileRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: 160
  },
  badgeTx: {
    fontSize: 11,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  chevron: {
    fontSize: 12,
    color: mobileColors.textSecondary,
    width: 18,
    textAlign: "center"
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: mobileColors.border,
    marginHorizontal: 12
  },
  body: {},
  content: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4
  }
});
