import type { RouteProp } from "@react-navigation/native";
import { useRoute } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View
} from "react-native";
import { WalletOperationsCard } from "../../components/buyer/WalletOperationsCard";
import { profileScreenScrollContent } from "../../components/layout";
import { WalletScreenShell } from "../../components/wallet/WalletScreenShell";
import { useSession } from "../../context/SessionContext";
import { useBottomInset } from "../../hooks/useBottomInset";
import { fetchUserWallet } from "../../lib/api";
import { mobileColors, mobileSpacing } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type Route = RouteProp<RootStackParamList, "WalletOperation">;

export function WalletOperationScreen() {
  const route = useRoute<Route>();
  const bottomInset = useBottomInset();
  const { accessToken } = useSession();
  const operation = route.params.operation;

  const walletQ = useQuery({
    queryKey: ["userWallet"],
    queryFn: () => fetchUserWallet(accessToken!),
    enabled: Boolean(accessToken)
  });

  const wallet = walletQ.data;

  return (
    <WalletScreenShell>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            profileScreenScrollContent,
            styles.content,
            { paddingBottom: bottomInset + mobileSpacing.lg }
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {walletQ.isLoading ? (
            <ActivityIndicator color={mobileColors.accent} />
          ) : wallet ? (
            <WalletOperationsCard
              balance={wallet.balance}
              currency={wallet.currency}
              visibleSection={operation}
            />
          ) : (
            <View />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </WalletScreenShell>
  );
}

export function walletOperationScreenTitle(
  operation: RootStackParamList["WalletOperation"]["operation"],
  t: (key: string) => string
): string {
  switch (operation) {
    case "topup":
      return t("navigation.screenTitles.walletTopUp");
    case "withdraw":
      return t("navigation.screenTitles.walletWithdraw");
    case "transfer":
      return t("navigation.screenTitles.walletTransfer");
    default:
      return t("navigation.screenTitles.userWallet");
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    gap: mobileSpacing.lg
  }
});
