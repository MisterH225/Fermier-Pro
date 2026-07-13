import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import { useBottomInset } from "../../hooks/useBottomInset";
import {
  completeMerchantOrder,
  confirmMerchantOrder,
  ensureDirectChatRoom,
  fetchMerchantOrder,
  markMerchantOrderDelivered,
  rejectMerchantOrder,
  shipMerchantOrder,
  type MerchantOrderDto
} from "../../lib/api";
import { formatApiError } from "../../lib/apiErrors";
import { merchantColors, merchantRadius } from "../../theme/merchantTheme";
import { mobileSpacing } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "MerchantOrderDetail">;

const TIMELINE_STEPS = [
  "paid",
  "confirmed",
  "shipping",
  "delivered",
  "completed"
] as const;

function stepReached(status: string, step: string): boolean {
  const order = [
    "payment_pending",
    "paid",
    "confirmed",
    "shipping",
    "delivered",
    "completed"
  ];
  if (
    status === "rejected" ||
    status === "auto_rejected" ||
    status === "refunded" ||
    status === "failed" ||
    status === "cancelled"
  ) {
    return step === "paid" && status !== "failed";
  }
  if (status === "disputed") {
    const idx = order.indexOf("delivered");
    const stepIdx = order.indexOf(step);
    return stepIdx >= 0 && stepIdx <= idx;
  }
  const statusIdx = order.indexOf(status);
  const stepIdx = order.indexOf(step);
  return statusIdx >= 0 && stepIdx >= 0 && stepIdx <= statusIdx;
}

function formatWhen(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return null;
  }
}

export function MerchantOrderDetailScreen({ route }: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const { accessToken, activeProfileId, authMe } = useSession();
  const bottomInset = useBottomInset();
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["merchant-order", route.params.orderId],
    queryFn: () =>
      fetchMerchantOrder(accessToken!, route.params.orderId, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["merchant-order", route.params.orderId]
    });
    await queryClient.invalidateQueries({
      queryKey: ["merchant-orders-seller", activeProfileId]
    });
    await queryClient.invalidateQueries({
      queryKey: ["merchant-orders-buyer"]
    });
  };

  const runAction = useMutation({
    mutationFn: async (
      action: "confirm" | "reject" | "ship" | "deliver" | "complete"
    ) => {
      if (!accessToken) throw new Error("no auth");
      const id = route.params.orderId;
      switch (action) {
        case "confirm":
          if (!activeProfileId) throw new Error("no profile");
          return confirmMerchantOrder(accessToken, activeProfileId, id);
        case "reject":
          if (!activeProfileId) throw new Error("no profile");
          return rejectMerchantOrder(accessToken, activeProfileId, id);
        case "ship":
          if (!activeProfileId) throw new Error("no profile");
          return shipMerchantOrder(accessToken, activeProfileId, id);
        case "deliver":
          if (!activeProfileId) throw new Error("no profile");
          return markMerchantOrderDelivered(accessToken, activeProfileId, id);
        case "complete":
          return completeMerchantOrder(accessToken, id, activeProfileId);
      }
    },
    onSuccess: async () => {
      await invalidate();
    },
    onError: (e) => Alert.alert(formatApiError(e))
  });

  const order = q.data;
  const isSeller = authMe?.user.id === order?.sellerUserId;
  const isBuyer = authMe?.user.id === order?.buyerUserId;
  const escrowHeld = order?.escrowHeld !== false;

  const statusLabel = useMemo(() => {
    if (!order) return "";
    if (isBuyer && order.status === "paid") {
      return t("merchant.orders.status.paidBuyer", {
        defaultValue: "En attente du commerçant"
      });
    }
    return t(`merchant.orders.status.${order.status}`, {
      defaultValue: order.status
    });
  }, [order, t, isBuyer]);

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

  const canDispute = (o: MerchantOrderDto) => {
    if (o.dispute) return true;
    if (o.status === "shipping") return true;
    if (o.status === "delivered") {
      if (!o.disputeWindowEndsAt) return true;
      return new Date(o.disputeWindowEndsAt).getTime() > Date.now();
    }
    if (!escrowHeld && (o.status === "paid" || o.status === "completed")) {
      return true;
    }
    return false;
  };

  if (q.isLoading || !order) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={merchantColors.primary} />
      </View>
    );
  }

  const shortId = `#${order.id.slice(-6).toUpperCase()}`;

  const primaryActions = (
    <>
      {isSeller && order.status === "paid" && escrowHeld ? (
        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.btn, styles.btnSuccess, { flex: 1 }]}
            onPress={() => runAction.mutate("confirm")}
            disabled={runAction.isPending}
          >
            <Text style={styles.btnTx}>{t("merchant.orders.accept")}</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnDanger, { flex: 1 }]}
            onPress={() =>
              Alert.alert(
                t("merchant.orders.reject"),
                t("merchant.orders.rejectConfirm"),
                [
                  { text: t("common.cancel"), style: "cancel" },
                  {
                    text: t("merchant.orders.reject"),
                    style: "destructive",
                    onPress: () => runAction.mutate("reject")
                  }
                ]
              )
            }
            disabled={runAction.isPending}
          >
            <Text style={styles.btnTx}>{t("merchant.orders.reject")}</Text>
          </Pressable>
        </View>
      ) : null}

      {isSeller && order.status === "paid" && !escrowHeld ? (
        <Pressable
          style={[styles.btn, styles.btnSuccess]}
          onPress={() => runAction.mutate("complete")}
          disabled={runAction.isPending}
        >
          <Text style={styles.btnTx}>{t("merchant.orders.markComplete")}</Text>
        </Pressable>
      ) : null}

      {isSeller && order.status === "confirmed" ? (
        <Pressable
          style={[styles.btn, styles.btnSecondary]}
          onPress={() => runAction.mutate("ship")}
          disabled={runAction.isPending}
        >
          <Text style={styles.btnTx}>{t("merchant.orders.startShipping")}</Text>
        </Pressable>
      ) : null}

      {isSeller && order.status === "shipping" ? (
        <Pressable
          style={[styles.btn, styles.btnSecondary]}
          onPress={() => runAction.mutate("deliver")}
          disabled={runAction.isPending}
        >
          <Text style={styles.btnTx}>{t("merchant.orders.markDelivered")}</Text>
        </Pressable>
      ) : null}

      {isBuyer && order.status === "delivered" ? (
        <Pressable
          style={[styles.btn, styles.btnSuccess]}
          onPress={() => runAction.mutate("complete")}
          disabled={runAction.isPending}
        >
          <Text style={styles.btnTx}>{t("merchant.orders.confirmReceipt")}</Text>
        </Pressable>
      ) : null}
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: bottomInset + mobileSpacing.xl }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        <View style={styles.headerRow}>
          <Text style={styles.orderId}>{shortId}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeTx}>{statusLabel}</Text>
          </View>
        </View>
        <Text style={styles.meta}>
          {formatWhen(order.createdAt) ?? order.createdAt}
        </Text>
        {order.status === "paid" && escrowHeld && order.timeoutAt ? (
          <Text style={styles.timeout}>
            {t("merchant.orders.respondBefore", {
              when: formatWhen(order.timeoutAt) ?? order.timeoutAt
            })}
          </Text>
        ) : null}

        {primaryActions}

        <Text style={styles.sectionTitle}>{t("merchant.orders.items")}</Text>
        <View style={styles.itemRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemName}>{order.productName}</Text>
            <Text style={styles.itemQty}>
              {t("merchant.orders.qtyItems", { count: order.quantity })}
            </Text>
          </View>
          <Text style={styles.itemPrice}>
            {order.unitPrice.toLocaleString("fr-FR")} {order.productCurrency}
          </Text>
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t("merchant.orders.amount")}</Text>
            <Text style={styles.summaryValue}>
              {order.totalAmount.toLocaleString("fr-FR")} {order.productCurrency}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t("merchant.orders.payment")}</Text>
            <Text style={styles.summaryValue}>
              {order.paymentMethod}
              {order.status !== "payment_pending" && order.status !== "failed"
                ? ` · ${t("merchant.orders.paidBadge")}`
                : ""}
            </Text>
          </View>
          {isSeller ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t("merchant.orders.net")}</Text>
              <Text style={[styles.summaryValue, styles.net]}>
                {order.sellerNet.toLocaleString("fr-FR")} {order.productCurrency}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>{t("merchant.orders.timeline")}</Text>
        <View style={styles.timeline}>
          {TIMELINE_STEPS.map((step, idx) => {
            const done = stepReached(order.status, step);
            const stamp =
              step === "paid"
                ? order.paidAt
                : step === "confirmed"
                  ? order.confirmedAt
                  : step === "shipping"
                    ? order.shippedAt
                    : step === "delivered"
                      ? order.deliveredAt
                      : order.completedAt;
            return (
              <View key={step} style={styles.tlRow}>
                <View style={styles.tlRail}>
                  <View style={[styles.tlDot, done && styles.tlDotOn]} />
                  {idx < TIMELINE_STEPS.length - 1 ? (
                    <View style={[styles.tlLine, done && styles.tlLineOn]} />
                  ) : null}
                </View>
                <View style={styles.tlBody}>
                  <Text style={[styles.tlTitle, done && styles.tlTitleOn]}>
                    {t(`merchant.orders.timelineStep.${step}`)}
                  </Text>
                  {formatWhen(stamp) ? (
                    <Text style={styles.tlTime}>{formatWhen(stamp)}</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>
            {isSeller ? t("merchant.orders.buyer") : t("merchant.orders.seller")}
          </Text>
          <Text style={styles.value}>
            {isSeller
              ? (order.buyerName ?? order.buyerUserId)
              : (order.sellerName ?? order.sellerUserId)}
          </Text>
        </View>

        {order.dispute ? (
          <View style={styles.disputeBox}>
            <Text style={styles.disputeTitle}>{t("merchant.orders.disputeOpen")}</Text>
            <Text style={styles.disputeReason}>{order.dispute.reason}</Text>
          </View>
        ) : null}

        <Pressable style={styles.btn} onPress={() => void onChat()} disabled={busy}>
          <Text style={styles.btnTx}>{t("merchant.orders.message")}</Text>
        </Pressable>

        {canDispute(order) ? (
          <Pressable
            style={[styles.btn, styles.btnOutline]}
            onPress={() =>
              navigation.navigate("MerchantOrderDispute", { orderId: order.id })
            }
          >
            <Text style={styles.btnTxOutline}>
              {order.dispute
                ? t("merchant.orders.disputeManage")
                : t("merchant.orders.openDispute")}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: merchantColors.canvas },
  scrollView: { flex: 1 },
  scroll: {
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.lg,
    rowGap: mobileSpacing.md
  },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  orderId: { fontSize: 22, fontWeight: "800", color: merchantColors.primary },
  badge: {
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999
  },
  badgeTx: { color: "#065F46", fontWeight: "700", fontSize: 12 },
  meta: { color: merchantColors.textSecondary, fontSize: 13 },
  timeout: { color: "#B45309", fontWeight: "600", fontSize: 13 },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginTop: 8 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8
  },
  itemName: { fontWeight: "700", fontSize: 16 },
  itemQty: { color: merchantColors.textSecondary, fontSize: 13 },
  itemPrice: { fontWeight: "700" },
  summary: {
    backgroundColor: "#F3F4F6",
    borderRadius: merchantRadius.card,
    padding: mobileSpacing.md,
    gap: 8
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8
  },
  summaryLabel: { color: merchantColors.textSecondary },
  summaryValue: { fontWeight: "600" },
  net: { color: merchantColors.success, fontWeight: "800" },
  timeline: { paddingLeft: 4 },
  tlRow: { flexDirection: "row", gap: 12, minHeight: 44 },
  tlRail: { width: 20, alignItems: "center" },
  tlDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    backgroundColor: "#fff"
  },
  tlDotOn: {
    backgroundColor: merchantColors.success,
    borderColor: merchantColors.success
  },
  tlLine: { width: 2, height: 28, backgroundColor: "#E5E7EB", marginVertical: 2 },
  tlLineOn: { backgroundColor: "#A7F3D0" },
  tlBody: { flex: 1, paddingBottom: 8 },
  tlTitle: { color: merchantColors.textSecondary, fontWeight: "600" },
  tlTitleOn: { color: merchantColors.textPrimary },
  tlTime: { fontSize: 12, color: merchantColors.textSecondary, marginTop: 2 },
  block: { gap: 4 },
  label: { color: merchantColors.textSecondary, fontSize: 13 },
  value: { fontWeight: "600", fontSize: 16 },
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
  actionsRow: { flexDirection: "row", gap: 10 },
  btn: {
    backgroundColor: merchantColors.primary,
    padding: mobileSpacing.md,
    borderRadius: merchantRadius.button,
    alignItems: "center"
  },
  btnSuccess: { backgroundColor: merchantColors.success },
  btnSecondary: { backgroundColor: "#2563EB" },
  btnDanger: { backgroundColor: "#DC2626" },
  btnOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#DC2626"
  },
  btnTx: { color: "#fff", fontWeight: "700" },
  btnTxOutline: { color: "#DC2626", fontWeight: "700" }
});
