import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
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
  CrossRatingModal,
  type CrossRatingTarget
} from "../../components/meteo/CrossRatingModal";
import {
  DeadlineNotice
} from "../../components/orders";
import { useSession } from "../../context/SessionContext";
import { useBottomInset } from "../../hooks/useBottomInset";
import { useOrderPalette } from "../../hooks/useOrderPalette";
import {
  acceptMerchantOrderDisputeReturn,
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
import {
  markCrossRatingDismissed,
  wasCrossRatingDismissed
} from "../../lib/crossRatingPrompt";
import { mobileSpacing, mobileFontSize, mobileStatusSurfaces } from "../../theme/mobileTheme";
import { uiNamedColors } from "../../theme/uiNamedColors";
import type { RootStackParamList } from "../../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "MerchantOrderDetail">;

export function MerchantOrderDetailScreen({ route }: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const { accessToken, activeProfileId, authMe } = useSession();
  const bottomInset = useBottomInset();
  const palette = useOrderPalette();
  const [busy, setBusy] = useState(false);
  const [ratingTarget, setRatingTarget] = useState<CrossRatingTarget | null>(
    null
  );
  const [ratingOpen, setRatingOpen] = useState(false);
  const ratingPrompted = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const activityY = useRef(0);

  const q = useQuery({
    queryKey: ["merchant-order", route.params.orderId],
    queryFn: () =>
      fetchMerchantOrder(accessToken!, route.params.orderId, activeProfileId),
    enabled: Boolean(accessToken)
  });

  useEffect(() => {
    const order = q.data;
    const myId = authMe?.user.id;
    if (
      !order ||
      !myId ||
      order.status !== "completed" ||
      ratingPrompted.current
    ) {
      return;
    }
    ratingPrompted.current = true;
    const isSeller = myId === order.sellerUserId;
    const isBuyer = myId === order.buyerUserId;
    const storageKind = isSeller ? "buyer" : isBuyer ? "merchant" : null;
    if (!storageKind) return;
    void (async () => {
      const dismissed = await wasCrossRatingDismissed(
        storageKind,
        order.id
      );
      if (dismissed) return;
      if (isSeller) {
        setRatingTarget({ kind: "buyer", merchantOrderId: order.id });
        setRatingOpen(true);
      } else if (isBuyer) {
        setRatingTarget({ kind: "merchant", merchantOrderId: order.id });
        setRatingOpen(true);
      }
    })();
  }, [q.data, authMe?.user.id]);

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
      action: "confirm" | "reject" | "ship" | "deliver" | "complete" | "acceptReturn"
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
        case "acceptReturn":
          if (!activeProfileId) throw new Error("no profile");
          return acceptMerchantOrderDisputeReturn(
            accessToken,
            activeProfileId,
            id,
            { note: t("merchant.orders.acceptReturnNote") }
          );
      }
    },
    onSuccess: async () => {
      await invalidate();
    },
    onError: (e) => Alert.alert(formatApiError(e))
  });

  const confirmAcceptReturn = () => {
    Alert.alert(
      t("merchant.orders.acceptReturnTitle"),
      t("merchant.orders.acceptReturnConfirm"),
      [
        { text: t("common.cancel", { defaultValue: "Annuler" }), style: "cancel" },
        {
          text: t("merchant.orders.acceptReturn"),
          style: "destructive",
          onPress: () => runAction.mutate("acceptReturn")
        }
      ]
    );
  };

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
        <ActivityIndicator color={palette.primary} />
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
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.canvas }]} edges={["bottom"]}>
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
          palette={palette}
        />

        {order.deadlineAt ? (
          <DeadlineNotice
            deadlineAt={order.deadlineAt}
            outcomeKey={order.timeoutOutcomeKey}
            palette={palette}
          />
        ) : null}

        <MerchantOrderProgressStepper order={order} palette={palette} />

        {/* CTA principal — style « Track Shipping » */}
        {isSeller && order.status === "paid" && escrowHeld ? (
          <View style={styles.actionsCol}>
            <Pressable
              style={[
                styles.primaryBtn,
                {
                  backgroundColor: palette.primary,
                  borderRadius: palette.radius.button
                },
                actionBusy && styles.btnDisabled
              ]}
              onPress={() => runAction.mutate("confirm")}
              disabled={actionBusy}
            >
              <Ionicons name="checkmark-circle" size={20} color={palette.onPrimary} />
              <Text style={[styles.primaryBtnTx, { color: palette.onPrimary }]}>
                {t("merchant.orders.accept")}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.secondaryBtn,
                {
                  backgroundColor: palette.cardBg,
                  borderColor: palette.primary,
                  borderRadius: palette.radius.button
                }
              ]}
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
              <Text style={[styles.secondaryBtnTx, { color: palette.primary }]}>
                {t("merchant.orders.reject")}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {isSeller && order.status === "paid" && !escrowHeld ? (
          <Pressable
            style={[
              styles.primaryBtn,
              {
                backgroundColor: palette.primary,
                borderRadius: palette.radius.button
              },
              actionBusy && styles.btnDisabled
            ]}
            onPress={() => runAction.mutate("complete")}
            disabled={actionBusy}
          >
            <Ionicons name="checkmark-done" size={20} color={palette.onPrimary} />
            <Text style={[styles.primaryBtnTx, { color: palette.onPrimary }]}>
              {t("merchant.orders.markComplete")}
            </Text>
          </Pressable>
        ) : null}

        {isSeller && order.status === "confirmed" ? (
          <Pressable
            style={[
              styles.primaryBtn,
              {
                backgroundColor: palette.primary,
                borderRadius: palette.radius.button
              },
              actionBusy && styles.btnDisabled
            ]}
            onPress={() => runAction.mutate("ship")}
            disabled={actionBusy}
          >
            <Ionicons name="bicycle" size={20} color={palette.onPrimary} />
            <Text style={[styles.primaryBtnTx, { color: palette.onPrimary }]}>
              {t("merchant.orders.startShipping")}
            </Text>
          </Pressable>
        ) : null}

        {isSeller && order.status === "shipping" ? (
          <View style={styles.actionsCol}>
            <Pressable
              style={[
                styles.primaryBtn,
                {
                  backgroundColor: palette.primary,
                  borderRadius: palette.radius.button
                },
                actionBusy && styles.btnDisabled
              ]}
              onPress={scrollToActivity}
            >
              <Ionicons name="search" size={20} color={palette.onPrimary} />
              <Text style={[styles.primaryBtnTx, { color: palette.onPrimary }]}>
                {t("merchant.orders.trackShipping")}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.secondaryBtn,
                {
                  backgroundColor: palette.cardBg,
                  borderColor: palette.primary,
                  borderRadius: palette.radius.button
                }
              ]}
              onPress={() => runAction.mutate("deliver")}
              disabled={actionBusy}
            >
              <Text style={[styles.secondaryBtnTx, { color: palette.primary }]}>
                {t("merchant.orders.markDelivered")}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {isBuyer && order.status === "delivered" ? (
          <Pressable
            style={[
              styles.primaryBtn,
              {
                backgroundColor: palette.primary,
                borderRadius: palette.radius.button
              },
              actionBusy && styles.btnDisabled
            ]}
            onPress={() => runAction.mutate("complete")}
            disabled={actionBusy}
          >
            <Ionicons name="checkmark-done" size={20} color={palette.onPrimary} />
            <Text style={[styles.primaryBtnTx, { color: palette.onPrimary }]}>
              {t("merchant.orders.confirmReceipt")}
            </Text>
          </Pressable>
        ) : null}

        {(order.status === "delivered" || order.status === "completed") &&
        !(isBuyer && order.status === "delivered") ? (
          <Pressable
            style={[
              styles.primaryBtn,
              {
                backgroundColor: palette.primary,
                borderRadius: palette.radius.button
              }
            ]}
            onPress={scrollToActivity}
          >
            <Ionicons name="search" size={20} color={palette.onPrimary} />
            <Text style={[styles.primaryBtnTx, { color: palette.onPrimary }]}>
              {t("merchant.orders.trackShipping")}
            </Text>
          </Pressable>
        ) : null}

        <MerchantOrderDeliveryCard
          order={order}
          isSeller={Boolean(isSeller)}
          palette={palette}
        />

        <MerchantOrderContactCard
          name={contactName}
          subtitle={contactSubtitle}
          phone={contactPhone}
          onMessage={() => void onChat()}
          messageBusy={busy}
          palette={palette}
        />

        {order.dispute && order.dispute.status === "open" ? (
          <View
            style={[
              styles.disputeBox,
              {
                borderRadius: palette.radius.card,
                backgroundColor: mobileStatusSurfaces.warningBg,
                borderColor: palette.warning
              }
            ]}
          >
            <Text style={[styles.disputeTitle, { color: uiNamedColors.c92400E }]}>
              {t("merchant.orders.disputeOpen")}
            </Text>
            <Text style={[styles.disputeReason, { color: uiNamedColors.c92400E }]}>
              {order.dispute.reason}
            </Text>
            {isSeller ? (
              <Pressable
                style={[
                  styles.acceptReturnBtn,
                  {
                    backgroundColor: palette.primary,
                    borderRadius: palette.radius.button
                  },
                  actionBusy && styles.btnDisabled
                ]}
                onPress={confirmAcceptReturn}
                disabled={actionBusy}
                testID="merchant-order-accept-return"
              >
                <Text style={[styles.acceptReturnBtnTx, { color: palette.onPrimary }]}>
                  {t("merchant.orders.acceptReturn")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {canDispute(order) ? (
          <Pressable
            style={[
              styles.disputeBtn,
              {
                borderRadius: palette.radius.button,
                borderColor: palette.danger
              }
            ]}
            onPress={() =>
              navigation.navigate("MerchantOrderDispute", { orderId: order.id })
            }
          >
            <Text style={[styles.disputeBtnTx, { color: palette.danger }]}>
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
          <MerchantOrderActivitySheet order={order} palette={palette} />
        </View>
      </ScrollView>
      <CrossRatingModal
        visible={ratingOpen}
        target={ratingTarget}
        onClose={() => setRatingOpen(false)}
        onSubmitted={() => {
          void markCrossRatingDismissed(
            ratingTarget?.kind === "buyer" ? "buyer" : "merchant",
            route.params.orderId
          );
        }}
        onSkipped={() => {
          void markCrossRatingDismissed(
            ratingTarget?.kind === "buyer" ? "buyer" : "merchant",
            route.params.orderId
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollView: { flex: 1 },
  scroll: {
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.lg,
    rowGap: mobileSpacing.md
  },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  actionsCol: { gap: 10 },
  primaryBtn: {
    paddingVertical: 16,
    paddingHorizontal: mobileSpacing.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10
  },
  primaryBtnTx: { fontWeight: "800", fontSize: mobileFontSize.lg },
  secondaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: mobileSpacing.lg,
    alignItems: "center",
    borderWidth: 1.5
  },
  secondaryBtnTx: {
    fontWeight: "800",
    fontSize: mobileFontSize.md
  },
  btnDisabled: { opacity: 0.55 },
  acceptReturnBtn: {
    marginTop: 10,
    paddingVertical: 12,
    alignItems: "center"
  },
  acceptReturnBtnTx: { fontWeight: "800" },
  disputeBox: {
    padding: mobileSpacing.md,
    borderWidth: 1,
    gap: 6
  },
  disputeTitle: { fontWeight: "800" },
  disputeReason: {},
  disputeBtn: {
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    backgroundColor: "transparent"
  },
  disputeBtnTx: { fontWeight: "800" }
});
