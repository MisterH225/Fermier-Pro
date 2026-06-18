import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BuyerBalanceCard } from "../buyer/BuyerBalanceCard";
import { WalletOperationsCard } from "../buyer/WalletOperationsCard";
import { useSession } from "../../context/SessionContext";
import { fetchUserWallet } from "../../lib/api";
import { buyerColors, buyerRadius } from "../../theme/buyerTheme";
import { mobileColors, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type Props = {
  showHistoryLink?: boolean;
  variant?: "buyer" | "producer";
};

export function WalletPanel({
  showHistoryLink = true,
  variant = "producer"
}: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken } = useSession();
  const accent = variant === "buyer" ? buyerColors.primary : mobileColors.accent;

  const walletQ = useQuery({
    queryKey: ["userWallet"],
    queryFn: () => fetchUserWallet(accessToken!),
    enabled: Boolean(accessToken)
  });

  if (walletQ.isLoading) {
    return <ActivityIndicator color={accent} style={styles.loader} />;
  }

  const wallet = walletQ.data;
  if (!wallet) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <BuyerBalanceCard
        balance={wallet.balance}
        currency={wallet.currency}
        monthCredits={wallet.monthCredits}
      />
      <WalletOperationsCard balance={wallet.balance} currency={wallet.currency} />
      {showHistoryLink ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate("UserWallet")}
          style={({ pressed }) => [styles.historyBtn, pressed && { opacity: 0.9 }]}
        >
          <Text style={[styles.historyBtnText, { color: accent }]}>
            {t("wallet.panel.fullHistory")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.lg },
  loader: { marginVertical: mobileSpacing.lg },
  historyBtn: {
    alignSelf: "center",
    paddingVertical: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.md
  },
  historyBtnText: {
    ...mobileTypography.cardTitle,
    fontSize: 15,
    fontWeight: "600"
  }
});
