import { StyleSheet, View } from "react-native";
import { useRolePalette } from "../../hooks/useRolePalette";
import { mobileSpacing } from "../../theme/mobileTheme";
import { WalletDashboardCard } from "./WalletDashboardCard";
import { WalletHistoryList } from "./WalletHistoryList";

/**
 * Onglet Finance → Portefeuille : carte dashboard (dock Transférer / + / Retirer)
 * et historique. Les formulaires d'opération sont sur WalletOperationScreen.
 */
export function FinanceWalletTab() {
  const palette = useRolePalette();
  return (
    <View style={styles.wrap}>
      <WalletDashboardCard hideDetailsLink />
      <View style={styles.history}>
        <WalletHistoryList accentColor={palette.primary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: mobileSpacing.md
  },
  history: {
    marginTop: mobileSpacing.xl
  }
});
