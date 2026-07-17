import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MerchantMobileShell } from "../../components/layout/MerchantMobileShell";
import { useBottomInset } from "../../hooks/useBottomInset";
import { useSession } from "../../context/SessionContext";
import { fetchMerchantSellerOrders, type MerchantOrderDto } from "../../lib/api";
import { formatMarketMoney } from "../../lib/formatMoney";
import {
  orderStatusBadgeTone,
  shortOrderTrackingId,
  type OrderStatusBadgeTone
} from "../../lib/merchantOrderTracking";
import { merchantColors, merchantRadius, merchantShadow } from "../../theme/merchantTheme";
import { mobileSpacing } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type OrderFilter =
  | "all"
  | "payment_pending"
  | "paid"
  | "confirmed"
  | "shipping"
  | "delivered"
  | "disputed"
  | "completed";

const FILTERS: OrderFilter[] = [
  "all",
  "paid",
  "confirmed",
  "shipping",
  "delivered",
  "disputed",
  "completed"
];

const BADGE_STYLES: Record<OrderStatusBadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: "#F3F4F6", fg: "#374151" },
  info: { bg: merchantColors.primaryLight, fg: merchantColors.primaryDark },
  progress: { bg: "#E0F2FE", fg: "#0369A1" },
  success: { bg: "#DCFCE7", fg: "#166534" },
  warning: { bg: "#FEF3C7", fg: "#92400E" },
  danger: { bg: "#FCE7F3", fg: merchantColors.danger }
};

export function MerchantOrdersScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "MerchantOrders">>();
  const bottomInset = useBottomInset();
  const { accessToken, activeProfileId } = useSession();
  const [filter, setFilter] = useState<OrderFilter>(
    (route.params?.filter as OrderFilter | undefined) ?? "all"
  );
  const [refreshing, setRefreshing] = useState(false);

  const ordersQ = useQuery({
    queryKey: ["merchant-orders-seller", activeProfileId],
    queryFn: () => fetchMerchantSellerOrders(accessToken!, activeProfileId!),
    enabled: Boolean(accessToken && activeProfileId)
  });

  const filtered = useMemo(() => {
    const items = ordersQ.data ?? [];
    if (filter === "all") return items;
    return items.filter((o) => o.status === filter);
  }, [ordersQ.data, filter]);

  useFocusEffect(
    useCallback(() => {
      void ordersQ.refetch();
    }, [ordersQ])
  );

  const header = (
    <View style={styles.topBar}>
      <Text style={styles.title}>{t("merchant.orders.title")}</Text>
    </View>
  );

  return (
    <MerchantMobileShell customHeader={header} omitBottomTabBar>
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            style={[styles.chip, filter === f && styles.chipOn]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.chipTx, filter === f && styles.chipTxOn]}>
              {t(`merchant.orders.filter.${f}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {ordersQ.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={merchantColors.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: mobileSpacing.md,
            paddingBottom: bottomInset,
            gap: mobileSpacing.sm
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void ordersQ.refetch().finally(() => setRefreshing(false));
              }}
              tintColor={merchantColors.primary}
            />
          }
          ListEmptyComponent={<Text style={styles.empty}>{t("merchant.orders.empty")}</Text>}
          renderItem={({ item }) => (
            <OrderRow
              order={item}
              onPress={() =>
                navigation.navigate("MerchantOrderDetail", { orderId: item.id })
              }
              statusLabel={t(`merchant.orders.status.${item.status}`, {
                defaultValue: item.status
              })}
            />
          )}
        />
      )}
    </MerchantMobileShell>
  );
}

function OrderRow({
  order,
  onPress,
  statusLabel
}: {
  order: MerchantOrderDto;
  onPress: () => void;
  statusLabel: string;
}) {
  const photo = order.productPhotoUrls?.find((u) => u.trim().length > 0);
  const tone = orderStatusBadgeTone(order.status);
  const badge = BADGE_STYLES[tone];
  const trackingId = shortOrderTrackingId(order.id);

  return (
    <Pressable style={[styles.card, merchantShadow.card]} onPress={onPress}>
      <View style={styles.cardTop}>
        <View style={styles.thumbWrap}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.thumb} resizeMode="cover" />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <Ionicons name="cube-outline" size={22} color={merchantColors.textMuted} />
            </View>
          )}
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardHead}>
            <Text style={styles.cardName} numberOfLines={2}>
              {order.productName ?? trackingId}
            </Text>
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.badgeTx, { color: badge.fg }]} numberOfLines={1}>
                {statusLabel}
              </Text>
            </View>
          </View>
          <Text style={styles.tracking}>{trackingId}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {order.buyerName ?? "—"} ·{" "}
            {formatMarketMoney(order.totalAmount, order.productCurrency || "XOF")}
          </Text>
          <Text style={styles.net}>
            +{formatMarketMoney(order.sellerNet, order.productCurrency || "XOF")} net
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.md,
    backgroundColor: merchantColors.canvas
  },
  title: { fontSize: 22, fontWeight: "800", color: merchantColors.textPrimary },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    backgroundColor: merchantColors.canvas
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: merchantRadius.pill,
    borderWidth: 1,
    borderColor: merchantColors.border,
    backgroundColor: merchantColors.cardBg
  },
  chipOn: {
    backgroundColor: merchantColors.primaryLight,
    borderColor: merchantColors.primary
  },
  chipTx: { fontSize: 12, fontWeight: "600", color: merchantColors.textSecondary },
  chipTxOn: { color: merchantColors.primary },
  card: {
    backgroundColor: merchantColors.cardBg,
    borderRadius: merchantRadius.card,
    padding: mobileSpacing.md,
    borderWidth: 1,
    borderColor: merchantColors.border
  },
  cardTop: { flexDirection: "row", gap: 12 },
  thumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: merchantColors.primaryLight
  },
  thumb: { width: "100%", height: "100%" },
  thumbPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  cardBody: { flex: 1, gap: 3 },
  cardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8
  },
  cardName: {
    fontWeight: "800",
    flex: 1,
    fontSize: 15,
    color: merchantColors.textPrimary
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: merchantRadius.pill,
    maxWidth: "46%"
  },
  badgeTx: { fontSize: 10, fontWeight: "800" },
  tracking: {
    fontSize: 12,
    fontWeight: "700",
    color: merchantColors.primary
  },
  meta: { color: merchantColors.textSecondary, fontSize: 13 },
  net: { color: merchantColors.success, fontWeight: "700", fontSize: 13 },
  empty: {
    textAlign: "center",
    marginTop: 40,
    color: merchantColors.textSecondary
  }
});
