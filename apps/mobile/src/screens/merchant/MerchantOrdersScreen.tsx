import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";
import { MerchantMobileShell } from "../../components/layout/MerchantMobileShell";
import { useBottomInset } from "../../hooks/useBottomInset";
import { useSession } from "../../context/SessionContext";
import { fetchMerchantSellerOrders, type MerchantOrderDto } from "../../lib/api";
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
          contentContainerStyle={{ padding: mobileSpacing.md, paddingBottom: bottomInset, gap: mobileSpacing.sm }}
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
              statusLabel={t(`merchant.orders.status.${item.status}`, { defaultValue: item.status })}
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
  return (
    <Pressable style={[styles.card, merchantShadow.card]} onPress={onPress}>
      <View style={styles.cardHead}>
        <Text style={styles.cardName}>{order.productName ?? order.id}</Text>
        <Text style={styles.status}>{statusLabel}</Text>
      </View>
      <Text style={styles.meta}>
        {order.buyerName ?? ""} · {order.totalAmount.toLocaleString("fr-FR")} XOF
      </Text>
      <Text style={styles.net}>
        +{order.sellerNet.toLocaleString("fr-FR")} XOF net
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.md,
    backgroundColor: merchantColors.canvas
  },
  title: { fontSize: 22, fontWeight: "800" },
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
  chipOn: { backgroundColor: merchantColors.primaryLight, borderColor: merchantColors.primary },
  chipTx: { fontSize: 12, fontWeight: "600", color: merchantColors.textSecondary },
  chipTxOn: { color: merchantColors.primary },
  card: {
    backgroundColor: merchantColors.cardBg,
    borderRadius: merchantRadius.card,
    padding: mobileSpacing.md,
    borderWidth: 1,
    borderColor: merchantColors.border
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  cardName: { fontWeight: "700", flex: 1 },
  status: { fontSize: 12, fontWeight: "700", color: merchantColors.primary },
  meta: { color: merchantColors.textSecondary, marginTop: 4, fontSize: 13 },
  net: { color: merchantColors.success, fontWeight: "700", marginTop: 4 },
  empty: { textAlign: "center", marginTop: 40, color: merchantColors.textSecondary }
});
