import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../../context/SessionContext";
import {
  completeMerchantOrder,
  ensureDirectChatRoom,
  fetchMerchantOrder
} from "../../lib/api";
import { formatApiError } from "../../lib/apiErrors";
import { merchantColors, merchantRadius } from "../../theme/merchantTheme";
import { mobileSpacing } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "MerchantOrderDetail">;

export function MerchantOrderDetailScreen({ route }: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const { accessToken, activeProfileId, authMe } = useSession();
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["merchant-order", route.params.orderId],
    queryFn: () => fetchMerchantOrder(accessToken!, activeProfileId!, route.params.orderId),
    enabled: Boolean(accessToken && activeProfileId)
  });

  const completeM = useMutation({
    mutationFn: () =>
      completeMerchantOrder(accessToken!, activeProfileId!, route.params.orderId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["merchant-order", route.params.orderId] });
      await queryClient.invalidateQueries({ queryKey: ["merchant-orders-seller", activeProfileId] });
    },
    onError: (e) => Alert.alert(formatApiError(e))
  });

  const order = q.data;
  const isSeller = authMe?.user.id === order?.sellerUserId;

  const onChat = async () => {
    if (!accessToken || !order) return;
    const peerId = isSeller ? order.buyerUserId : order.sellerUserId;
    setBusy(true);
    try {
      const room = await ensureDirectChatRoom(
        accessToken,
        peerId,
        undefined,
        undefined,
        order.productId
      );
      navigation.navigate("ChatRoom", { roomId: room.id });
    } catch (e) {
      Alert.alert(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  if (q.isLoading || !order) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={merchantColors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{order.productName}</Text>
        <Text style={styles.status}>
          {t(`merchant.orders.status.${order.status}`, { defaultValue: order.status })}
        </Text>

        <View style={styles.block}>
          <Text style={styles.label}>{t("merchant.orders.buyer")}</Text>
          <Text style={styles.value}>{order.buyerName ?? order.buyerUserId}</Text>
        </View>
        <View style={styles.block}>
          <Text style={styles.label}>{t("merchant.orders.quantity")}</Text>
          <Text style={styles.value}>{order.quantity}</Text>
        </View>
        <View style={styles.block}>
          <Text style={styles.label}>{t("merchant.orders.total")}</Text>
          <Text style={styles.value}>
            {order.totalAmount.toLocaleString("fr-FR")} {order.productCurrency}
          </Text>
        </View>
        <View style={styles.block}>
          <Text style={styles.label}>{t("merchant.orders.commission")}</Text>
          <Text style={styles.value}>
            -{order.sellerCommission.toLocaleString("fr-FR")} {order.productCurrency}
          </Text>
        </View>
        <View style={styles.block}>
          <Text style={styles.label}>{t("merchant.orders.net")}</Text>
          <Text style={[styles.value, styles.net]}>
            {order.sellerNet.toLocaleString("fr-FR")} {order.productCurrency}
          </Text>
        </View>

        {order.dispute ? (
          <View style={styles.disputeBox}>
            <Text style={styles.disputeTitle}>{t("merchant.orders.disputeOpen")}</Text>
            <Text style={styles.disputeReason}>{order.dispute.reason}</Text>
            {order.dispute.sellerNote ? (
              <Text style={styles.note}>{t("merchant.orders.sellerNote")}: {order.dispute.sellerNote}</Text>
            ) : null}
            {order.dispute.buyerNote ? (
              <Text style={styles.note}>{t("merchant.orders.buyerNote")}: {order.dispute.buyerNote}</Text>
            ) : null}
          </View>
        ) : null}

        <Pressable style={styles.btn} onPress={() => void onChat()} disabled={busy}>
          <Text style={styles.btnTx}>{t("merchant.orders.message")}</Text>
        </Pressable>

        {isSeller && order.status === "paid" ? (
          <Pressable
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => completeM.mutate()}
            disabled={completeM.isPending}
          >
            <Text style={styles.btnTxSecondary}>{t("merchant.orders.markComplete")}</Text>
          </Pressable>
        ) : null}

        {order.status === "paid" || order.status === "completed" || order.status === "disputed" ? (
          <Pressable
            style={[styles.btn, styles.btnOutline]}
            onPress={() =>
              navigation.navigate("MerchantOrderDispute", { orderId: order.id })
            }
          >
            <Text style={styles.btnTxOutline}>
              {order.dispute ? t("merchant.orders.disputeManage") : t("merchant.orders.openDispute")}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: merchantColors.canvas },
  scroll: { padding: mobileSpacing.lg, gap: mobileSpacing.md },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "800" },
  status: { color: merchantColors.primary, fontWeight: "700" },
  block: { gap: 4 },
  label: { color: merchantColors.textSecondary, fontSize: 13 },
  value: { fontWeight: "600", fontSize: 16 },
  net: { color: merchantColors.success, fontWeight: "800" },
  disputeBox: {
    backgroundColor: "#FEF3C7",
    borderRadius: merchantRadius.card,
    padding: mobileSpacing.md,
    borderWidth: 1,
    borderColor: "#F59E0B",
    gap: 6
  },
  disputeTitle: { fontWeight: "800", color: "#92400E" },
  disputeReason: { color: "#78350F" },
  note: { fontSize: 13, color: merchantColors.textSecondary },
  btn: {
    backgroundColor: merchantColors.primary,
    padding: mobileSpacing.md,
    borderRadius: merchantRadius.button,
    alignItems: "center"
  },
  btnSecondary: { backgroundColor: merchantColors.success },
  btnOutline: { backgroundColor: "transparent", borderWidth: 1, borderColor: merchantColors.primary },
  btnTx: { color: "#fff", fontWeight: "700" },
  btnTxSecondary: { color: "#fff", fontWeight: "700" },
  btnTxOutline: { color: merchantColors.primary, fontWeight: "700" }
});
