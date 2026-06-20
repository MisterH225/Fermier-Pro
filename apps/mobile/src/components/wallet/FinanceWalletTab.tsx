import { StyleSheet, View } from "react-native";
import { mobileColors, mobileSpacing } from "../../theme/mobileTheme";
import { WalletDashboardCard } from "./WalletDashboardCard";
import { WalletHistoryList } from "./WalletHistoryList";

/**
 * Onglet Finance → Portefeuille : carte dashboard (dock Transférer / + / Retirer)
 * et historique. Les formulaires d'opération sont sur WalletOperationScreen.
 */
export function FinanceWalletTab() {
  return (
    <View style={styles.wrap}>
      <WalletDashboardCard variant="producer" hideDetailsLink />
      <View style={styles.history}>
        <WalletHistoryList accentColor={mobileColors.accent} />
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
