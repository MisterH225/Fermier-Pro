import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useActiveProject } from "../../context/ActiveProjectContext";
import { producerColors } from "../../theme/producerTheme";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography,
  mobileFontSize
} from "../../theme/mobileTheme";

type ProjectIndicatorProps = {
  onPress: () => void;
};

/**
 * Sélecteur de projet actif sur le Dashboard.
 * Visible dès 2 fermes actives — ouvre le switcher (pas le profil).
 */
export function ProjectIndicator({ onPress }: ProjectIndicatorProps) {
  const { t } = useTranslation();
  const { activeFarm, farms } = useActiveProject();
  const activeFarms = farms.filter((f) => f.status === "active");
  const totalFarms = activeFarms.length;

  if (totalFarms < 2 || !activeFarm) {
    return null;
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("producer.projects.switchA11y", {
        name: activeFarm.name
      })}
      testID="dashboard-project-indicator"
    >
      <View style={styles.iconWrap}>
        <Ionicons name="leaf" size={14} color={producerColors.primaryDark} />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.label}>{t("producer.projects.currentLabel")}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {activeFarm.name}
        </Text>
      </View>
      <View style={styles.meta}>
        <Text style={styles.count}>{totalFarms}</Text>
        <Ionicons
          name="chevron-down"
          size={16}
          color={producerColors.primaryDark}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    alignSelf: "stretch",
    backgroundColor: producerColors.oliveWash,
    borderWidth: 1,
    borderColor: producerColors.oliveBorder,
    borderRadius: mobileRadius.md,
    paddingVertical: 6,
    paddingHorizontal: 10
  },
  pressed: {
    opacity: 0.9,
    backgroundColor: producerColors.oliveWashSoft
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: mobileRadius.sm,
    backgroundColor: producerColors.primaryMuted,
    alignItems: "center",
    justifyContent: "center"
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 0
  },
  label: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.xs,
    fontWeight: "600",
    color: producerColors.oliveMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    lineHeight: 14
  },
  name: {
    ...mobileTypography.body,
    fontSize: mobileFontSize.sm,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    lineHeight: 18
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  count: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: producerColors.primaryDark,
    minWidth: 16,
    textAlign: "center"
  }
});
