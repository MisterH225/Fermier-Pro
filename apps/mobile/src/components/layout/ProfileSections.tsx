import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { mobileColors, mobileRadius, mobileShadows, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";

/** Padding + gap standard pour les écrans profil / dashboard (canvas entre cartes). */
export const profileScreenScrollContent = {
  padding: mobileSpacing.lg,
  gap: mobileSpacing.lg
} as const;

/** Carte blanche hero (accueil dashboard, en-tête d’écran). */
export function ProfileHeroCard({
  children,
  style
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.heroCard, style]}>{children}</View>;
}

/** Titre de section hors carte (petites capitales, comme profil producteur). */
export function ProfileSectionHeader({ label }: { label: string }) {
  return (
    <Text style={styles.sectionHeader} accessibilityRole="header">
      {label}
    </Text>
  );
}

/** Coque iOS Settings pour grouper des lignes ou champs. */
export function ProfileGroupShell({
  children,
  style
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.groupShell, style]}>{children}</View>;
}

/** Ligne dans un groupe avec séparateur optionnel. */
export function ProfileGroupRow({
  children,
  showDivider = false
}: {
  children: ReactNode;
  showDivider?: boolean;
}) {
  return (
    <View style={[styles.groupRow, showDivider && styles.groupRowDivider]}>
      {children}
    </View>
  );
}

/** Lien d’action sous une section (« Voir tout → »). */
export function ProfileSectionLink({
  label,
  onPress,
  color
}: {
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text style={[styles.sectionLink, color ? { color } : null]}>{label}</Text>
    </Pressable>
  );
}

/** Texte vide dans une carte de section. */
export function ProfileSectionEmpty({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionEmpty}>{children}</Text>;
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    gap: mobileSpacing.sm,
    ...mobileShadows.card
  },
  sectionHeader: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.sm,
    fontWeight: "600",
    color: mobileColors.textSecondary,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: mobileSpacing.lg,
    marginBottom: mobileSpacing.sm,
    marginLeft: 4
  },
  groupShell: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    ...mobileShadows.card
  },
  groupRow: {
    minHeight: 52,
    paddingHorizontal: mobileSpacing.md,
    justifyContent: "center"
  },
  groupRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border
  },
  sectionLink: {
    ...mobileTypography.body,
    color: mobileColors.accent,
    fontWeight: "600",
    marginLeft: 4
  },
  sectionEmpty: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary
  }
});
