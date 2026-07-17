import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSession } from "../../context/SessionContext";
import {
  fetchMerchantBuyerOrders,
  fetchMerchantSellerOrders,
  type MerchantOrderDto
} from "../../lib/api";
import type { RootStackParamList } from "../../types/navigation";
import {
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  accentColor?: string;
  backgroundColor?: string;
};

/** Statuts encore en cours (suivi utile). Disparaît après completed / refund / cancel. */
const ACTIVE_ORDER_STATUSES = new Set([
  "payment_pending",
  "paid",
  "confirmed",
  "shipping",
  "delivered",
  "disputed"
]);

function hasActiveOrders(orders: MerchantOrderDto[] | undefined): boolean {
  return (orders ?? []).some((o) => ACTIVE_ORDER_STATUSES.has(o.status));
}

/**
 * Carte dashboard → suivi commandes boutique.
 * Masquée quand plus aucune commande active (réception confirmée / escrow libéré).
 */
export function ShopOrdersTrackingCard({
  accentColor = "#1D4ED8",
  backgroundColor = "#EFF6FF"
}: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken, authMe, activeProfileId } = useSession();

  const activeType =
    authMe?.profiles?.find((p) => p.id === activeProfileId)?.type ??
    authMe?.activeProfile?.type ??
    null;
  const isMerchant = activeType === "merchant";

  const ordersQ = useQuery({
    queryKey: isMerchant
      ? ["merchant-orders-seller", activeProfileId, "tracking-card"]
      : ["merchant-orders-buyer", "tracking-card"],
    queryFn: () =>
      isMerchant
        ? fetchMerchantSellerOrders(accessToken!, activeProfileId!)
        : fetchMerchantBuyerOrders(accessToken!),
    enabled: Boolean(
      accessToken && (isMerchant ? activeProfileId : true)
    ),
    refetchOnWindowFocus: true,
    staleTime: 30_000
  });

  if (!hasActiveOrders(ordersQ.data)) {
    return null;
  }

  const onPress = () => {
    if (isMerchant) {
      navigation.navigate("MerchantOrders");
      return;
    }
    navigation.navigate("BuyerHistory", { initialSegment: "active" });
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor, borderColor: accentColor },
        pressed && { opacity: 0.9 }
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: "#fff" }]}>
        <Ionicons name="receipt-outline" size={22} color={accentColor} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: accentColor }]}>
          {isMerchant
            ? t("ordersTracking.merchantTitle")
            : t("ordersTracking.buyerTitle")}
        </Text>
        <Text style={styles.sub}>
          {isMerchant
            ? t("ordersTracking.merchantSub")
            : t("ordersTracking.buyerSub")}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={accentColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.md,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    marginBottom: mobileSpacing.md
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  body: { flex: 1, gap: 2 },
  title: { ...mobileTypography.body, fontWeight: "800" },
  sub: { ...mobileTypography.meta, color: "#475569" }
});
