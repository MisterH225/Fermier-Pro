import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WalletOperationsCard } from "../buyer/WalletOperationsCard";
import { useSession } from "../../context/SessionContext";
import { fetchUserWallet } from "../../lib/api";
import { formatMarketMoney } from "../marketplace/MarketplaceListingCard";
import { buyerColors, buyerRadius } from "../../theme/buyerTheme";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

const BALANCE_HIDDEN_KEY = "@fermier/wallet_balance_hidden";

type WalletAction = "topup" | "withdraw" | "transfer";

type Props = {
  variant?: "buyer" | "producer";
};

export function WalletDashboardCard({ variant = "producer" }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken } = useSession();
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [activeAction, setActiveAction] = useState<WalletAction | null>(null);

  const accent = variant === "buyer" ? buyerColors.primary : mobileColors.accent;
  const cardBg = variant === "buyer" ? "#2D2E35" : mobileColors.accent;

  const walletQ = useQuery({
    queryKey: ["userWallet"],
    queryFn: () => fetchUserWallet(accessToken!),
    enabled: Boolean(accessToken)
  });

  useEffect(() => {
    void AsyncStorage.getItem(BALANCE_HIDDEN_KEY).then((v) => {
      setBalanceHidden(v === "1");
    });
  }, []);

  const toggleBalanceHidden = useCallback(() => {
    setBalanceHidden((prev) => {
      const next = !prev;
      void AsyncStorage.setItem(BALANCE_HIDDEN_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const wallet = walletQ.data;
  const balanceLabel =
    wallet && !balanceHidden
      ? formatMarketMoney(Math.round(wallet.balance), wallet.currency)
      : "••••••";

  const actions: {
    id: WalletAction;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    { id: "topup", label: t("wallet.dashboard.topUp"), icon: "add-circle-outline" },
    {
      id: "transfer",
      label: t("wallet.dashboard.transfer"),
      icon: "swap-horizontal-outline"
    },
    {
      id: "withdraw",
      label: t("wallet.dashboard.withdraw"),
      icon: "arrow-up-circle-outline"
    }
  ];

  return (
    <>
      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <View style={styles.balanceRow}>
          <View style={styles.balanceCol}>
            <Text style={styles.balanceLabel}>
              {t("buyer.wallet.availableBalance")}
            </Text>
            {walletQ.isLoading ? (
              <ActivityIndicator color="#fff" style={styles.balanceLoader} />
            ) : (
              <Text style={styles.balanceAmount}>{balanceLabel}</Text>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              balanceHidden
                ? t("wallet.dashboard.showBalance")
                : t("wallet.dashboard.hideBalance")
            }
            onPress={toggleBalanceHidden}
            hitSlop={10}
            style={styles.eyeBtn}
          >
            <Ionicons
              name={balanceHidden ? "eye-off-outline" : "eye-outline"}
              size={22}
              color="rgba(255,255,255,0.9)"
            />
          </Pressable>
        </View>
        <View style={styles.actionsRow}>
          {actions.map((action) => (
            <Pressable
              key={action.id}
              accessibilityRole="button"
              onPress={() => setActiveAction(action.id)}
              style={({ pressed }) => [
                styles.actionChip,
                pressed && { opacity: 0.88 }
              ]}
            >
              <Ionicons name={action.icon} size={16} color="#fff" />
              <Text style={styles.actionLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate("UserWallet")}
          style={styles.detailsLink}
        >
          <Text style={styles.detailsLinkText}>{t("wallet.dashboard.openWallet")}</Text>
          <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.75)" />
        </Pressable>
      </View>

      <Modal
        visible={activeAction !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveAction(null)}
      >
        <View style={[styles.modalRoot, { paddingTop: insets.top + mobileSpacing.sm }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: accent }]}>
              {activeAction === "topup"
                ? t("buyer.wallet.ops.topUp")
                : activeAction === "withdraw"
                  ? t("buyer.wallet.ops.withdraw")
                  : t("buyer.wallet.ops.transfer")}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setActiveAction(null)}
              hitSlop={12}
            >
              <Ionicons name="close" size={26} color={mobileColors.textPrimary} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={[
              styles.modalBody,
              { paddingBottom: insets.bottom + mobileSpacing.lg }
            ]}
            keyboardShouldPersistTaps="handled"
          >
            {wallet ? (
              <WalletOperationsCard
                balance={wallet.balance}
                currency={wallet.currency}
                visibleSection={activeAction ?? "all"}
              />
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    gap: mobileSpacing.sm,
    width: "100%"
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: mobileSpacing.sm
  },
  balanceCol: { flex: 1, gap: 2 },
  balanceLabel: {
    ...mobileTypography.meta,
    color: "rgba(255,255,255,0.72)",
    fontWeight: "500"
  },
  balanceAmount: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.5
  },
  balanceLoader: { alignSelf: "flex-start", marginTop: 4 },
  eyeBtn: {
    padding: mobileSpacing.xs,
    borderRadius: buyerRadius.pill
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.xs,
    marginTop: mobileSpacing.xs
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: buyerRadius.pill,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)"
  },
  actionLabel: {
    ...mobileTypography.meta,
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF"
  },
  detailsLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
    marginTop: 2
  },
  detailsLinkText: {
    ...mobileTypography.meta,
    color: "rgba(255,255,255,0.75)",
    fontWeight: "600"
  },
  modalRoot: {
    flex: 1,
    backgroundColor: mobileColors.canvas
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: mobileSpacing.lg,
    paddingBottom: mobileSpacing.sm
  },
  modalTitle: {
    ...mobileTypography.sectionTitle,
    fontSize: 18
  },
  modalBody: {
    paddingHorizontal: mobileSpacing.lg,
    gap: mobileSpacing.md
  }
});
