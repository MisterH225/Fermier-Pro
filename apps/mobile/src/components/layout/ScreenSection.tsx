import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { mobileColors, mobileRadius, mobileShadows, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";

type Props = {
  /** Titre de section (style profil : petites capitales). */
  title?: string;
  /** Contenu sans carte blanche (ex. cartes KPI déjà stylées). */
  plain?: boolean;
  /** Carte sans padding interne. */
  flush?: boolean;
  headerRight?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  cardStyle?: StyleProp<ViewStyle>;
};

/**
 * Bloc de section comme sur le Dashboard / Profil : fond canvas entre les cartes,
 * contenu dans une carte blanche distincte.
 */
export function ScreenSection({
  title,
  plain = false,
  flush = false,
  headerRight,
  children,
  style,
  cardStyle
}: Props) {
  return (
    <View style={[styles.wrap, style]}>
      {title ? (
        <View style={styles.titleRow}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {headerRight}
        </View>
      ) : null}
      {plain ? (
        <View style={cardStyle}>{children}</View>
      ) : (
        <View style={[styles.card, flush && styles.cardFlush, cardStyle]}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: mobileSpacing.sm
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing.sm
  },
  title: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.sm,
    fontWeight: "600",
    color: mobileColors.textSecondary,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    flex: 1,
    marginLeft: 4
  },
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    ...mobileShadows.card
  },
  cardFlush: {
    padding: 0,
    overflow: "hidden"
  }
});
