import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { mobileSpacing } from "../../theme/mobileTheme";

type Props = {
  /** Contenu sous les onglets (bannières, filtres, KPI) — jamais le titre de page. */
  children?: ReactNode;
};

/**
 * Zone d'en-tête optionnelle sous `TabSelector`, sans répéter le titre
 * déjà affiché dans la barre de navigation (`useScreenTitle`).
 */
export function TabScreenHeader({ children }: Props) {
  if (!children) {
    return null;
  }
  return <View style={styles.wrap}>{children}</View>;
}

const styles = StyleSheet.create({
  wrap: {
    gap: mobileSpacing.sm,
    marginBottom: mobileSpacing.xs
  }
});
