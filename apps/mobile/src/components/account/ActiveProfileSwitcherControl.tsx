import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSession } from "../../context/SessionContext";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { ActiveProfileSwitcherModal } from "./ActiveProfileSwitcherModal";

type ActiveProfileSwitcherControlProps = {
  /**
   * `hero` : sous l’avatar (point + libellé + chevron).
   * `default` : bloc compte (sans point, comme avant).
   */
  variant?: "default" | "hero";
};

export function ActiveProfileSwitcherControl({
  variant = "default"
}: ActiveProfileSwitcherControlProps) {
  const { t } = useTranslation();
  const { authMe, activeProfileId } = useSession();
  const [open, setOpen] = useState(false);

  const activeProfile = authMe?.profiles.find((p) => p.id === activeProfileId);
  const activeTypeLabel = activeProfile
    ? t(`account.profileTypes.${activeProfile.type}`, {
        defaultValue: activeProfile.type
      })
    : t("account.noProfile");

  return (
    <>
      <ActiveProfileSwitcherModal
        visible={open}
        onClose={() => setOpen(false)}
      />
      <Pressable
        style={({ pressed }) => [
          styles.row,
          variant === "hero" && styles.rowHero,
          pressed && styles.rowPressed
        ]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t("account.switchProfileModalTitle")}
      >
        {variant === "hero" ? (
          <>
            <View style={styles.heroLead}>
              <View style={styles.activeDot} />
              <View style={styles.textBlock}>
                <Text style={styles.primary}>{activeTypeLabel}</Text>
                <Text style={styles.hint}>{t("account.tapToChangeProfile")}</Text>
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </>
        ) : (
          <>
            <View style={styles.textBlock}>
              <Text style={styles.primary}>{activeTypeLabel}</Text>
              <Text style={styles.hint}>{t("account.tapToChangeProfile")}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </>
        )}
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: mobileSpacing.lg,
    paddingHorizontal: mobileSpacing.md,
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  rowHero: {
    marginTop: mobileSpacing.lg,
    alignSelf: "stretch"
  },
  rowPressed: {
    opacity: 0.88
  },
  heroLead: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: mobileSpacing.md
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: mobileColors.success,
    marginRight: 10
  },
  textBlock: {
    flex: 1,
    minWidth: 0
  },
  primary: {
    ...mobileTypography.cardTitle,
    fontSize: 17,
    color: mobileColors.textPrimary
  },
  hint: {
    ...mobileTypography.meta,
    marginTop: 4,
    color: mobileColors.textSecondary,
    lineHeight: 17
  },
  chevron: {
    fontSize: 24,
    color: mobileColors.textSecondary
  }
});
