import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
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
import { MerchantOrderActivitySheet } from "../../components/merchant/orders/MerchantOrderActivitySheet";
import { MerchantOrderContactCard } from "../../components/merchant/orders/MerchantOrderContactCard";
import { MerchantOrderDeliveryCard } from "../../components/merchant/orders/MerchantOrderDeliveryCard";
import { MerchantOrderProgressStepper } from "../../components/merchant/orders/MerchantOrderProgressStepper";
import { MerchantOrderTrackingHeader } from "../../components/merchant/orders/MerchantOrderTrackingHeader";
import {
  merchantOrderPalette,
  OrderDeadlineBanner
} from "../../components/orders";
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

export function MerchantOrderDetailScreen({ route }: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const { accessToken, activeProfileId, authMe } = useSession();
  const bottomInset = useBottomInset();
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const activityY = useRef(0);

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

  const scrollToActivity = () => {
    scrollRef.current?.scrollTo({ y: Math.max(0, activityY.current - 12), animated: true });
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

  const contactName = isSeller
    ? (order.buyerName ?? t("merchant.orders.buyer"))
    : (order.sellerName ?? t("merchant.orders.seller"));
  const contactPhone = isSeller ? order.buyerPhone : order.sellerPhone;
  const contactSubtitle = isSeller
    ? t("merchant.orders.contact.buyerHint")
    : t("merchant.orders.contact.sellerHint");

  const actionBusy = runAction.isPending;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: bottomInset + mobileSpacing.xl }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        <MerchantOrderTrackingHeader
          orderId={order.id}
          status={order.status}
          statusLabel={statusLabel}
        />

        {order.status === "paid" && escrowHeld && order.timeoutAt ? (
          <OrderDeadlineBanner
            deadlineAt={order.timeoutAt}
            labelKey="merchant.orders.respondBefore"
            palette={merchantOrderPalette}
          />
        ) : null}

        <MerchantOrderProgressStepper order={order} />

        {/* CTA principal — style « Track Shipping » */}
        {isSeller && order.status === "paid" && escrowHeld ? (
          <View style={styles.actionsCol}>
            <Pressable
              style={[styles.primaryBtn, actionBusy && styles.btnDisabled]}
              onPress={() => runAction.mutate("confirm")}
              disabled={actionBusy}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.primaryBtnTx}>{t("merchant.orders.accept")}</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
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
              disabled={actionBusy}
            >
              <Text style={styles.secondaryBtnTx}>{t("merchant.orders.reject")}</Text>
            </Pressable>
          </View>
        ) : null}

        {isSeller && order.status === "paid" && !escrowHeld ? (
          <Pressable
            style={[styles.primaryBtn, actionBusy && styles.btnDisabled]}
            onPress={() => runAction.mutate("complete")}
            disabled={actionBusy}
          >
            <Ionicons name="checkmark-done" size={20} color="#fff" />
            <Text style={styles.primaryBtnTx}>{t("merchant.orders.markComplete")}</Text>
          </Pressable>
        ) : null}

        {isSeller && order.status === "confirmed" ? (
          <Pressable
            style={[styles.primaryBtn, actionBusy && styles.btnDisabled]}
            onPress={() => runAction.mutate("ship")}
            disabled={actionBusy}
          >
            <Ionicons name="bicycle" size={20} color="#fff" />
            <Text style={styles.primaryBtnTx}>{t("merchant.orders.startShipping")}</Text>
          </Pressable>
        ) : null}

        {isSeller && order.status === "shipping" ? (
          <View style={styles.actionsCol}>
            <Pressable
              style={[styles.primaryBtn, actionBusy && styles.btnDisabled]}
              onPress={scrollToActivity}
            >
              <Ionicons name="search" size={20} color="#fff" />
              <Text style={styles.primaryBtnTx}>
                {t("merchant.orders.trackShipping")}
              </Text>
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => runAction.mutate("deliver")}
              disabled={actionBusy}
            >
              <Text style={styles.secondaryBtnTx}>
                {t("merchant.orders.markDelivered")}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {isBuyer && order.status === "delivered" ? (
          <Pressable
            style={[styles.primaryBtn, actionBusy && styles.btnDisabled]}
            onPress={() => runAction.mutate("complete")}
            disabled={actionBusy}
          >
            <Ionicons name="checkmark-done" size={20} color="#fff" />
            <Text style={styles.primaryBtnTx}>{t("merchant.orders.confirmReceipt")}</Text>
          </Pressable>
        ) : null}

        {(order.status === "delivered" || order.status === "completed") &&
        !(isBuyer && order.status === "delivered") ? (
          <Pressable style={styles.primaryBtn} onPress={scrollToActivity}>
            <Ionicons name="search" size={20} color="#fff" />
            <Text style={styles.primaryBtnTx}>{t("merchant.orders.trackShipping")}</Text>
          </Pressable>
        ) : null}

        <MerchantOrderDeliveryCard order={order} isSeller={Boolean(isSeller)} />

        <MerchantOrderContactCard
          name={contactName}
          subtitle={contactSubtitle}
          phone={contactPhone}
          onMessage={() => void onChat()}
          messageBusy={busy}
        />

        {order.dispute ? (
          <View style={styles.disputeBox}>
            <Text style={styles.disputeTitle}>{t("merchant.orders.disputeOpen")}</Text>
            <Text style={styles.disputeReason}>{order.dispute.reason}</Text>
          </View>
        ) : null}

        {canDispute(order) ? (
          <Pressable
            style={styles.disputeBtn}
            onPress={() =>
              navigation.navigate("MerchantOrderDispute", { orderId: order.id })
            }
          >
            <Text style={styles.disputeBtnTx}>
              {order.dispute
                ? t("merchant.orders.disputeManage")
                : t("merchant.orders.openDispute")}
            </Text>
          </Pressable>
        ) : null}

        <View
          onLayout={(e) => {
            activityY.current = e.nativeEvent.layout.y;
          }}
        >
          <MerchantOrderActivitySheet order={order} />
        </View>
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
  actionsCol: { gap: 10 },
  primaryBtn: {
    backgroundColor: merchantColors.primary,
    paddingVertical: 16,
    paddingHorizontal: mobileSpacing.lg,
    borderRadius: merchantRadius.button,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10
  },
  primaryBtnTx: { color: "#fff", fontWeight: "800", fontSize: 16 },
  secondaryBtn: {
    backgroundColor: merchantColors.cardBg,
    paddingVertical: 14,
    paddingHorizontal: mobileSpacing.lg,
    borderRadius: merchantRadius.button,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: merchantColors.primary
  },
  secondaryBtnTx: {
    color: merchantColors.primary,
    fontWeight: "800",
    fontSize: 15
  },
  btnDisabled: { opacity: 0.55 },
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
  disputeBtn: {
    paddingVertical: 14,
    borderRadius: merchantRadius.button,
    alignItems: "center",
    borderWidth: 1,
    borderColor: merchantColors.danger,
    backgroundColor: "transparent"
  },
  disputeBtnTx: { color: merchantColors.danger, fontWeight: "800" }
});
