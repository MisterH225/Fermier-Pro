import { StyleSheet, Text, View } from "react-native";
import { mobileColors, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function SettingsSection({ title, subtitle, children }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.group}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: mobileSpacing.lg
  },
  title: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: mobileColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: mobileSpacing.xs,
    marginLeft: mobileSpacing.md
  },
  subtitle: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.sm,
    marginLeft: mobileSpacing.md
  },
  group: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: mobileColors.background
  }
});
