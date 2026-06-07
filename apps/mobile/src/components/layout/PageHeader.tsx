import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  /**
   * @deprecated Le titre principal doit passer par `useScreenTitle` (header natif).
   * Si fourni, affiché uniquement quand `showTitleInContent` est true (écrans sans header stack).
   */
  title?: string;
  /** Sous-titre ou contexte (ex. nom de bande, période). */
  subtitle?: string;
  showTitleInContent?: boolean;
  children?: ReactNode;
};

/**
 * En-tête de page pour écrans sans barre native (`headerShown: false`).
 * Sur les écrans stack classiques, préférer `useScreenTitle` + `TabScreenHeader`.
 */
export function PageHeader({
  title,
  subtitle,
  showTitleInContent = false,
  children
}: Props) {
  const showTitle = showTitleInContent && Boolean(title?.trim());

  if (!showTitle && !subtitle && !children) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      {showTitle ? (
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
      ) : null}
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: mobileSpacing.xs,
    marginBottom: mobileSpacing.sm
  },
  title: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary
  },
  subtitle: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  }
});
