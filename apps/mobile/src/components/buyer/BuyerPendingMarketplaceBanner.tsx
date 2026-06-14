import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSession } from "../../context/SessionContext";
import {
  buildBuyerPendingMarketplaceItems,
  openBuyerPendingItem
} from "../../lib/buyerMarketplacePending";
import {
  fetchMarketplaceTransactions,
  fetchMyMarketplaceOffers
} from "../../lib/api";
import { offerStatusLabel } from "../../lib/marketplaceLabels";
import { buyerColors, buyerRadius } from "../../theme/buyerTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

export function BuyerPendingMarketplaceBanner() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken, activeProfileId, authMe } = useSession();
  const buyerUserId = authMe?.user.id;

  const offersQ = useQuery({
    queryKey: ["marketplaceMyOffers", activeProfileId, "pending-banner"],
    queryFn: () => fetchMyMarketplaceOffers(accessToken!, activeProfileId),
    enabled: Boolean(accessToken && buyerUserId),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true
  });

  const txQ = useQuery({
    queryKey: ["marketplaceTransactions", activeProfileId, "pending-banner"],
    queryFn: () => fetchMarketplaceTransactions(accessToken!, activeProfileId),
    enabled: Boolean(accessToken && buyerUserId),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true
  });

  if (!buyerUserId) return null;

  const items = buildBuyerPendingMarketplaceItems(
    offersQ.data ?? [],
    txQ.data ?? [],
    buyerUserId
  );
  if (items.length === 0) return null;

  const first = items[0];
  const subtitle =
    first.kind === "offer"
      ? `${offerStatusLabel(first.offer.status)} · ${first.title}`
      : t(`buyer.pendingMarketplace.tx.${first.transaction.status}`, {
          defaultValue: first.transaction.status
        });

  return (
    <Pressable
      onPress={() => openBuyerPendingItem(navigation, first)}
      style={({ pressed }) => [styles.banner, pressed && { opacity: 0.92 }]}
      accessibilityRole="button"
      accessibilityLabel={t("buyer.pendingMarketplace.bannerA11y", {
        count: items.length
      })}
    >
      <View style={styles.iconBox}>
        <Ionicons name="cart" size={20} color="#fff" />
      </View>
      <View style={styles.txCol}>
        <Text style={styles.title} numberOfLines={1}>
          {items.length > 1
            ? t("buyer.pendingMarketplace.bannerCount", { count: items.length })
            : t("buyer.pendingMarketplace.bannerOne")}
        </Text>
        <Text style={styles.body} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.md,
    backgroundColor: buyerColors.primary,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: buyerRadius.card,
    marginBottom: mobileSpacing.sm
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center"
  },
  txCol: { flex: 1, minWidth: 0 },
  title: {
    ...mobileTypography.body,
    color: "#fff",
    fontWeight: "700"
  },
  body: {
    ...mobileTypography.meta,
    color: "rgba(255,255,255,0.92)"
  }
});
