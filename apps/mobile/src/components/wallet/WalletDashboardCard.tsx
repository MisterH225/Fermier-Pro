import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSession } from "../../context/SessionContext";
import { fetchUserWallet } from "../../lib/api";
import { formatMarketMoney } from "../marketplace/MarketplaceListingCard";
import { buyerColors } from "../../theme/buyerTheme";
import { techColors } from "../../theme/technicianTheme";
import { vetColors } from "../../theme/vetTheme";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

const BALANCE_HIDDEN_KEY = "@fermier/wallet_balance_hidden";

type WalletAction = "topup" | "withdraw" | "transfer";

type ProfileVariant = "buyer" | "producer" | "vet" | "tech";

type Props = {
  variant?: ProfileVariant;
  /** Masque le lien « Voir le portefeuille » (ex. écran historique déjà ouvert). */
  hideDetailsLink?: boolean;
};

function accentForVariant(variant: ProfileVariant): string {
  switch (variant) {
    case "buyer":
      return buyerColors.primary;
    case "vet":
      return vetColors.primary;
    case "tech":
      return techColors.primary;
    default:
      return mobileColors.accent;
  }
}

function splitBalanceDisplay(
  balance: number,
  hidden: boolean
): { main: string; decimal: string | null } {
  if (hidden) {
    return { main: "••••••", decimal: null };
  }
  const whole = Math.floor(balance);
  const cents = Math.round((balance - whole) * 100);
  return {
    main: whole.toLocaleString("fr-FR"),
    decimal: `,${String(cents).padStart(2, "0")}`
  };
}

export function WalletDashboardCard({
  variant = "producer",
  hideDetailsLink = false
}: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken, clientFeatures } = useSession();
  const [balanceHidden, setBalanceHidden] = useState(false);
  const walletEnabled = clientFeatures.wallet;

  const accent = accentForVariant(variant);

  const walletQ = useQuery({
    queryKey: ["userWallet"],
    queryFn: () => fetchUserWallet(accessToken!),
    enabled: Boolean(accessToken) && walletEnabled
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

  const openOperation = useCallback(
    (operation: WalletAction) => {
      navigation.navigate("WalletOperation", { operation });
    },
    [navigation]
  );

  const wallet = walletQ.data;
  const currency = wallet?.currency ?? "XOF";
  const balanceParts = useMemo(
    () => splitBalanceDisplay(wallet?.balance ?? 0, balanceHidden),
    [wallet?.balance, balanceHidden]
  );

  const monthCreditsLabel = useMemo(() => {
    if (!wallet?.monthCredits || balanceHidden) {
      return null;
    }
    return t("buyer.wallet.monthCredits", {
      amount: formatMarketMoney(Math.round(wallet.monthCredits), currency)
    });
  }, [wallet?.monthCredits, balanceHidden, currency, t]);

  if (!walletEnabled) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.balanceCard}>
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
            size={20}
            color={mobileColors.textSecondary}
          />
        </Pressable>

        <View style={styles.currencyPill}>
          <Ionicons name="cash-outline" size={14} color="#FFFFFF" />
          <Text style={styles.currencyPillText}>{currency}</Text>
        </View>

        <View style={styles.balanceCenter}>
          {walletQ.isLoading ? (
            <ActivityIndicator color={mobileColors.textPrimary} />
          ) : (
            <View style={styles.balanceAmountRow}>
              <Text style={styles.balanceMain}>{balanceParts.main}</Text>
              {balanceParts.decimal ? (
                <Text style={styles.balanceDecimal}>{balanceParts.decimal}</Text>
              ) : null}
            </View>
          )}
        </View>

        {monthCreditsLabel ? (
          <View style={[styles.growthBadge, { backgroundColor: accent }]}>
            <Ionicons name="trending-up" size={14} color="#FFFFFF" />
            <Text style={styles.growthBadgeText}>{monthCreditsLabel}</Text>
          </View>
        ) : null}

        {hideDetailsLink ? null : (
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate("UserWallet")}
            style={styles.detailsLink}
          >
            <Text style={styles.detailsLinkText}>{t("wallet.dashboard.openWallet")}</Text>
            <Ionicons name="chevron-forward" size={14} color={mobileColors.textSecondary} />
          </Pressable>
        )}
      </View>

      <View
        style={[
          styles.actionsDock,
          monthCreditsLabel ? { marginTop: mobileSpacing.sm } : null
        ]}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => openOperation("transfer")}
          style={({ pressed }) => [
            styles.dockBtnWide,
            pressed && styles.dockBtnPressed
          ]}
        >
          <Text style={styles.dockBtnLabel}>{t("wallet.dashboard.transfer")}</Text>
          <View style={styles.dockIconCircle}>
            <Ionicons name="arrow-up-outline" size={18} color="#FFFFFF" />
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("wallet.dashboard.topUp")}
          onPress={() => openOperation("topup")}
          style={({ pressed }) => [
            styles.dockBtnSquare,
            pressed && styles.dockBtnPressed
          ]}
        >
          <Ionicons name="add" size={22} color={mobileColors.textPrimary} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => openOperation("withdraw")}
          style={({ pressed }) => [
            styles.dockBtnWide,
            styles.dockBtnWithdraw,
            pressed && styles.dockBtnPressed
          ]}
        >
          <View style={styles.dockIconCircle}>
            <Ionicons name="arrow-down-outline" size={18} color="#FFFFFF" />
          </View>
          <Text style={[styles.dockBtnLabel, styles.dockBtnLabelRight]}>
            {t("wallet.dashboard.withdraw")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const CARD_BG = "#EBEBF0";
const DOCK_BG = "#161616";
const DOCK_BTN = "#2A2A2A";
const DOCK_SQUARE = "#E8E8ED";

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    gap: mobileSpacing.xs
  },
  balanceCard: {
    backgroundColor: CARD_BG,
    borderRadius: 22,
    paddingTop: mobileSpacing.md,
    paddingHorizontal: mobileSpacing.md,
    paddingBottom: mobileSpacing.lg,
    alignItems: "center",
    position: "relative",
    ...mobileShadows.card
  },
  eyeBtn: {
    position: "absolute",
    top: mobileSpacing.md,
    right: mobileSpacing.md,
    padding: mobileSpacing.xs,
    zIndex: 2
  },
  currencyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1A1A1A",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: mobileRadius.pill,
    marginBottom: mobileSpacing.sm
  },
  currencyPillText: {
    ...mobileTypography.meta,
    color: "#FFFFFF",
    fontWeight: "700",
    letterSpacing: 0.4
  },
  balanceCenter: {
    minHeight: 40,
    justifyContent: "center",
    alignItems: "center"
  },
  balanceAmountRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center"
  },
  balanceMain: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    letterSpacing: -1
  },
  balanceDecimal: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "500",
    color: mobileColors.textSecondary,
    marginBottom: 2,
    marginLeft: 2
  },
  growthBadge: {
    position: "absolute",
    bottom: -10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: mobileRadius.pill
  },
  growthBadgeText: {
    ...mobileTypography.meta,
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF"
  },
  detailsLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: mobileSpacing.md
  },
  detailsLinkText: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontWeight: "600"
  },
  actionsDock: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.xs,
    backgroundColor: DOCK_BG,
    borderRadius: 18,
    padding: mobileSpacing.xs
  },
  dockBtnWide: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: DOCK_BTN,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: mobileSpacing.sm,
    minHeight: 48
  },
  dockBtnWithdraw: {
    justifyContent: "flex-start",
    gap: mobileSpacing.sm
  },
  dockBtnSquare: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: DOCK_SQUARE,
    alignItems: "center",
    justifyContent: "center"
  },
  dockBtnPressed: {
    opacity: 0.88
  },
  dockBtnLabel: {
    ...mobileTypography.cardTitle,
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF"
  },
  dockBtnLabelRight: {
    flex: 1,
    textAlign: "right"
  },
  dockIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center"
  }
});
