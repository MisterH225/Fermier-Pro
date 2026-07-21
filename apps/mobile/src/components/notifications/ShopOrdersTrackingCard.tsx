import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSession } from "../../context/SessionContext";
import {
  fetchMerchantBuyerOrders,
  fetchMerchantSellerOrders
} from "../../lib/api";
import {
  ACTIVE_ORDER_TRACKING_STATUSES,
  buildDashboardTrackingSteps,
  formatTrackingStepWhen,
  pickCurrentTrackingOrder,
  trackingBadgeLabelKey,
  trackingBadgeTone,
  trackingParties,
  trackingReferenceOf
} from "../../lib/currentOrderTracking";
import {
  dismissOrderTrackingCard,
  loadDismissedOrderIds,
  pruneDismissedOrderIds
} from "../../lib/ordersTrackingDismiss";
import type { RootStackParamList } from "../../types/navigation";
import { OrderStatusBadge } from "../orders";
import { mobileColors, mobileRadius, mobileShadows, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { uiNamedColors } from "../../theme/uiNamedColors";

type Props = {
  /** Conservé pour compatibilité des dashboards existants (non utilisé sur le fond carte). */
  accentColor?: string;
  backgroundColor?: string;
};

/**
 * Carte dashboard « Suivi actuel » — commande boutique active.
 * Swipe droite → gauche pour masquer la carte (persisté localement).
 */
export function ShopOrdersTrackingCard(_props: Props) {
  const { t, i18n } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken, authMe, activeProfileId } = useSession();
  const qc = useQueryClient();
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";

  const activeType =
    authMe?.profiles?.find((p) => p.id === activeProfileId)?.type ??
    authMe?.activeProfile?.type ??
    null;
  const isMerchant = activeType === "merchant";
  const role = isMerchant ? "seller" : "buyer";
  const dismissScope =
    activeProfileId ?? authMe?.user.id ?? "anonymous";

  const ordersQ = useQuery({
    queryKey: isMerchant
      ? ["merchant-orders-seller", activeProfileId, "tracking-card"]
      : ["merchant-orders-buyer", "tracking-card"],
    queryFn: () =>
      isMerchant
        ? fetchMerchantSellerOrders(accessToken!, activeProfileId!)
        : fetchMerchantBuyerOrders(accessToken!),
    enabled: Boolean(accessToken && (isMerchant ? activeProfileId : true)),
    refetchOnWindowFocus: true,
    staleTime: 30_000
  });

  const dismissedQ = useQuery({
    queryKey: ["orders-tracking-dismissed", dismissScope],
    queryFn: () => loadDismissedOrderIds(dismissScope),
    enabled: Boolean(dismissScope),
    staleTime: 60_000
  });

  useEffect(() => {
    if (!ordersQ.data || !dismissScope) return;
    const activeIds = ordersQ.data
      .filter((o) => ACTIVE_ORDER_TRACKING_STATUSES.has(o.status))
      .map((o) => o.id);
    void pruneDismissedOrderIds(dismissScope, activeIds).then((next) => {
      qc.setQueryData(["orders-tracking-dismissed", dismissScope], next);
    });
  }, [ordersQ.data, dismissScope, qc]);

  const dismissMut = useMutation({
    mutationFn: (orderId: string) =>
      dismissOrderTrackingCard(dismissScope, orderId),
    onSuccess: (next) => {
      qc.setQueryData(["orders-tracking-dismissed", dismissScope], next);
    }
  });

  const dismissedIds = useMemo(
    () => dismissedQ.data ?? new Set<string>(),
    [dismissedQ.data]
  );

  const order = pickCurrentTrackingOrder(ordersQ.data, dismissedIds);
  if (!order) {
    return null;
  }

  const reference = trackingReferenceOf(order);
  const parties = trackingParties(order, role, {
    seller: t("ordersTracking.youSeller"),
    buyer: t("ordersTracking.youBuyer"),
    product:
      order.productName?.trim() || t("buyer.history.shopOrderFallback")
  });
  const steps = buildDashboardTrackingSteps(order);
  const completedThrough = steps.reduce(
    (acc, step, index) => (step.done ? index : acc),
    -1
  );

  const openDetail = () => {
    navigation.navigate("MerchantOrderDetail", { orderId: order.id });
  };

  const renderDelete = () => (
    <Pressable
      style={styles.swipeDelete}
      onPress={() => dismissMut.mutate(order.id)}
      accessibilityRole="button"
      accessibilityLabel={t("ordersTracking.dismissA11y")}
    >
      <Ionicons name="trash-outline" size={22} color={mobileColors.background} />
      <Text style={styles.swipeLabel}>{t("ordersTracking.dismiss")}</Text>
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>{t("ordersTracking.sectionTitle")}</Text>
      <Swipeable
        renderRightActions={renderDelete}
        overshootRight={false}
        onSwipeableOpen={(direction) => {
          // Ouverture complète du panneau droit = suppression (swipe G←D).
          if (direction === "right") {
            dismissMut.mutate(order.id);
          }
        }}
      >
        <Pressable
          onPress={openDetail}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t("ordersTracking.openA11y", { ref: reference })}
        >
          <View style={styles.headerRow}>
            <View style={styles.refBlock}>
              <Text style={styles.refLabel}>
                {t("ordersTracking.trackingLabel")}
              </Text>
              <Text style={styles.refValue} numberOfLines={1}>
                {reference}
              </Text>
            </View>
            <OrderStatusBadge
              labelKey={trackingBadgeLabelKey(order.status)}
              tone={trackingBadgeTone(order.status)}
            />
          </View>

          <View style={styles.partiesRow}>
            <View style={styles.partyCol}>
              <Text style={styles.partyLabel}>{t(parties.sender.labelKey)}</Text>
              <Text style={styles.partyValue} numberOfLines={3}>
                {parties.sender.value}
              </Text>
            </View>
            <View style={styles.partyCol}>
              <Text style={styles.partyLabel}>
                {t(parties.recipient.labelKey)}
              </Text>
              <Text style={styles.partyValue} numberOfLines={3}>
                {parties.recipient.value}
              </Text>
            </View>
          </View>

          <View style={styles.stepper} accessibilityRole="progressbar">
            {steps.map((step, index) => {
              const reached = index <= completedThrough || step.current;
              const filled = index <= completedThrough;
              const timeLabel = step.timestamp
                ? formatTrackingStepWhen(step.timestamp, locale)
                : null;
              return (
                <View key={step.key} style={styles.stepCol}>
                  <View style={styles.railRow}>
                    {index > 0 ? (
                      <View
                        style={[
                          styles.line,
                          styles.lineLeft,
                          index <= completedThrough
                            ? styles.lineDone
                            : styles.lineIdle
                        ]}
                      />
                    ) : (
                      <View style={styles.lineSpacer} />
                    )}
                    <View
                      style={[
                        styles.node,
                        filled || step.current
                          ? styles.nodeDone
                          : styles.nodeIdle
                      ]}
                    >
                      {filled || step.current ? (
                        <Ionicons name="checkmark" size={14} color={mobileColors.background} />
                      ) : null}
                    </View>
                    {index < steps.length - 1 ? (
                      <View
                        style={[
                          styles.line,
                          styles.lineRight,
                          index < completedThrough
                            ? styles.lineDone
                            : styles.lineIdle
                        ]}
                      />
                    ) : (
                      <View style={styles.lineSpacer} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepLabel,
                      reached ? styles.stepLabelActive : styles.stepLabelIdle
                    ]}
                    numberOfLines={2}
                  >
                    {t(step.labelKey)}
                  </Text>
                  {timeLabel ? (
                    <Text style={styles.stepTime}>{timeLabel}</Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        </Pressable>
      </Swipeable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: mobileSpacing.md, gap: mobileSpacing.sm },
  sectionTitle: {
    ...mobileTypography.sectionTitle,
    color: mobileColors.textPrimary,
    fontWeight: "800"
  },
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.xl,
    padding: mobileSpacing.lg,
    borderWidth: 1,
    borderColor: mobileColors.border,
    gap: mobileSpacing.lg,
    ...mobileShadows.card
  },
  pressed: { opacity: 0.92 },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  refBlock: { flex: 1, gap: 4 },
  refLabel: {
    fontSize: mobileFontSize.sm,
    fontWeight: "600",
    color: mobileColors.textSecondary
  },
  refValue: {
    fontSize: mobileFontSize.xl,
    fontWeight: "800",
    color: mobileColors.textPrimary
  },
  partiesRow: { flexDirection: "row", gap: 16 },
  partyCol: { flex: 1, gap: 4 },
  partyLabel: {
    fontSize: mobileFontSize.sm,
    fontWeight: "600",
    color: mobileColors.textSecondary
  },
  partyValue: {
    fontSize: mobileFontSize.md,
    fontWeight: "800",
    color: mobileColors.textPrimary,
    lineHeight: 20
  },
  stepper: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between"
  },
  stepCol: { flex: 1, alignItems: "center", gap: 6 },
  railRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    height: 28
  },
  lineSpacer: { flex: 1 },
  line: { flex: 1, height: 3 },
  lineLeft: { borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  lineRight: { borderTopLeftRadius: 2, borderBottomLeftRadius: 2 },
  lineDone: { backgroundColor: mobileColors.textPrimary },
  lineIdle: { backgroundColor: uiNamedColors.cE5E7EB },
  node: {
    width: 28,
    height: 28,
    borderRadius: mobileRadius.lg,
    alignItems: "center",
    justifyContent: "center"
  },
  nodeDone: { backgroundColor: mobileColors.textPrimary },
  nodeIdle: { backgroundColor: uiNamedColors.cD1D5DB },
  stepLabel: {
    fontSize: mobileFontSize.sm,
    textAlign: "center",
    fontWeight: "700"
  },
  stepLabelActive: { color: mobileColors.textPrimary },
  stepLabelIdle: { color: uiNamedColors.c9CA3AF, fontWeight: "600" },
  stepTime: {
    fontSize: mobileFontSize.xs,
    color: mobileColors.textSecondary,
    textAlign: "center"
  },
  swipeDelete: {
    width: 96,
    marginLeft: 8,
    borderRadius: mobileRadius.xl,
    backgroundColor: mobileColors.error,
    alignItems: "center",
    justifyContent: "center",
    gap: 4
  },
  swipeLabel: {
    color: mobileColors.background,
    fontSize: mobileFontSize.sm,
    fontWeight: "700"
  }
});
