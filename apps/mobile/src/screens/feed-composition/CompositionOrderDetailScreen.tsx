import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import {
  DeadlineNotice,
  OrderTrackingStepper,
  type OrderTrackingStep
} from "../../components/orders";
import { useSession } from "../../context/SessionContext";
import { useBottomInset } from "../../hooks/useBottomInset";
import { useOrderPalette } from "../../hooks/useOrderPalette";
import {
  acceptCompositionOrder,
  confirmCompositionOrderPayment,
  confirmCompositionReceipt,
  fetchCompositionOrder,
  markCompositionDelivered,
  markCompositionOutForDelivery,
  markCompositionReady,
  openCompositionOrderDispute,
  payCompositionOrder,
  rejectCompositionOrder,
  reviseCompositionOrder,
  startCompositionProduction,
  type CompositionOrderStatus
} from "../../lib/api";
import { formatApiError } from "../../lib/apiErrors";
import { isDeliveryModuleActive } from "../../lib/feedComposition";
import { formatXof } from "../../lib/feedCompositionFormat";
import { openPaymentCheckout } from "../../lib/paymentCheckout";
import type { RootStackParamList } from "../../types/navigation";
import {
  mobileFontSize,
  mobileRadius,
  mobileSpacing,
  mobileStatusSurfaces
} from "../../theme/mobileTheme";

type Props = NativeStackScreenProps<
  RootStackParamList,
  "CompositionOrderDetail"
>;

const TRACKING_STEPS: OrderTrackingStep[] = [
  { key: "sent", labelKey: "orders.composition.steps.sent", icon: "paper-plane" },
  {
    key: "revised",
    labelKey: "orders.composition.steps.revised",
    icon: "create"
  },
  {
    key: "accepted",
    labelKey: "orders.composition.steps.accepted",
    icon: "checkmark-circle"
  },
  { key: "paid", labelKey: "orders.composition.steps.paid", icon: "card" },
  {
    key: "production",
    labelKey: "orders.composition.steps.production",
    icon: "construct"
  },
  {
    key: "ready",
    labelKey: "orders.composition.steps.ready",
    icon: "cube"
  }
];

function statusLabelFr(status: CompositionOrderStatus): string {
  const labels: Record<CompositionOrderStatus, string> = {
    SENT_TO_MILL: "Envoyée au moulin",
    MILL_REVISED: "Révisée par le moulin",
    ACCEPTED: "Acceptée",
    REJECTED: "Refusée",
    CANCELLED: "Annulée",
    PAID: "Payée",
    IN_PRODUCTION: "En production",
    READY_FOR_PICKUP: "Prête au retrait",
    OUT_FOR_DELIVERY: "En livraison",
    DISPUTED: "Litige ouvert",
    COMPLETED: "Terminée",
    REFUNDED: "Remboursée"
  };
  return labels[status] ?? status;
}

function trackingIndex(status: CompositionOrderStatus): {
  activeIndex: number;
  completedThroughIndex: number;
} {
  switch (status) {
    case "SENT_TO_MILL":
      return { activeIndex: 0, completedThroughIndex: -1 };
    case "MILL_REVISED":
      return { activeIndex: 1, completedThroughIndex: 0 };
    case "ACCEPTED":
      return { activeIndex: 2, completedThroughIndex: 1 };
    case "PAID":
      return { activeIndex: 3, completedThroughIndex: 2 };
    case "IN_PRODUCTION":
      return { activeIndex: 4, completedThroughIndex: 3 };
    case "READY_FOR_PICKUP":
    case "OUT_FOR_DELIVERY":
    case "DISPUTED":
      return { activeIndex: 5, completedThroughIndex: 4 };
    case "COMPLETED":
      return { activeIndex: 5, completedThroughIndex: 5 };
    case "REJECTED":
    case "CANCELLED":
    case "REFUNDED":
      return { activeIndex: 1, completedThroughIndex: 0 };
    default:
      return { activeIndex: 0, completedThroughIndex: -1 };
  }
}

function formatDateFr(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}

function defaultFutureIso(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

export function CompositionOrderDetailScreen({ route }: Props) {
  const { orderId } = route.params;
  const { accessToken, activeProfileId, authMe, platformModules } =
    useSession();
  const qc = useQueryClient();
  const bottomPad = useBottomInset();
  const palette = useOrderPalette();
  const deliveryEnabled = isDeliveryModuleActive(platformModules);
  const [productionStartDraft, setProductionStartDraft] = useState(
    defaultFutureIso(3)
  );
  const [readyEstimateDraft, setReadyEstimateDraft] = useState(
    defaultFutureIso(7)
  );
  const [millNoteDraft, setMillNoteDraft] = useState("");
  const [deliveryFeeDraft, setDeliveryFeeDraft] = useState("0");
  const [deliveryNoteDraft, setDeliveryNoteDraft] = useState("");
  const [pendingPayment, setPendingPayment] = useState<{
    providerRef: string;
    paymentUrl: string | null;
  } | null>(null);

  const profileType = authMe?.profiles?.find(
    (p) => p.id === activeProfileId
  )?.type;
  const isMillViewer =
    profileType === "merchant" && activeProfileId != null;

  const orderQ = useQuery({
    queryKey: ["composition-order", orderId],
    queryFn: () =>
      fetchCompositionOrder(accessToken!, orderId, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const order = orderQ.data;
  const isMillForOrder = Boolean(
    order && isMillViewer && activeProfileId === order.millProfileId
  );
  const isProducerForOrder = Boolean(
    order && authMe?.user.id === order.producerUserId
  );

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["composition-order", orderId] });
    void qc.invalidateQueries({ queryKey: ["marketplace-orders"] });
  }, [qc, orderId]);

  const acceptMut = useMutation({
    mutationFn: () =>
      acceptCompositionOrder(accessToken!, orderId, activeProfileId),
    onSuccess: () => {
      invalidate();
      Alert.alert("Acceptée", "Vous pouvez maintenant payer la commande.");
    },
    onError: (err) => Alert.alert("Erreur", formatApiError(err))
  });

  const rejectMut = useMutation({
    mutationFn: () =>
      rejectCompositionOrder(accessToken!, orderId, activeProfileId),
    onSuccess: () => {
      invalidate();
      Alert.alert("Refusée", "La commande a été refusée.");
    },
    onError: (err) => Alert.alert("Erreur", formatApiError(err))
  });

  const reviseMut = useMutation({
    mutationFn: () =>
      reviseCompositionOrder(
        accessToken!,
        orderId,
        {
          millNote: millNoteDraft.trim() || undefined,
          productionStartEstimate: productionStartDraft,
          readyEstimate: readyEstimateDraft
        },
        activeProfileId
      ),
    onSuccess: () => {
      invalidate();
      Alert.alert("Révision envoyée", "Le producteur peut accepter ou refuser.");
    },
    onError: (err) => Alert.alert("Erreur", formatApiError(err))
  });

  const startProdMut = useMutation({
    mutationFn: () =>
      startCompositionProduction(accessToken!, orderId, activeProfileId),
    onSuccess: () => {
      invalidate();
      Alert.alert("Production lancée", "La fabrication a commencé.");
    },
    onError: (err) => Alert.alert("Erreur", formatApiError(err))
  });

  const markReadyMut = useMutation({
    mutationFn: () =>
      markCompositionReady(accessToken!, orderId, activeProfileId),
    onSuccess: () => {
      invalidate();
      Alert.alert("Prête", "Le producteur peut venir récupérer le mélange.");
    },
    onError: (err) => Alert.alert("Erreur", formatApiError(err))
  });

  const outForDeliveryMut = useMutation({
    mutationFn: () =>
      markCompositionOutForDelivery(
        accessToken!,
        orderId,
        {
          feeXof: Math.max(0, Number(deliveryFeeDraft) || 0),
          note: deliveryNoteDraft.trim() || undefined
        },
        activeProfileId
      ),
    onSuccess: () => {
      invalidate();
      Alert.alert("Livraison", "Livraison démarrée — marquez livré à la remise.");
    },
    onError: (err) => Alert.alert("Erreur", formatApiError(err))
  });

  const markDeliveredMut = useMutation({
    mutationFn: () =>
      markCompositionDelivered(accessToken!, orderId, activeProfileId),
    onSuccess: () => {
      invalidate();
      Alert.alert("Livré", "Le producteur peut confirmer la réception.");
    },
    onError: (err) => Alert.alert("Erreur", formatApiError(err))
  });

  const confirmReceiptMut = useMutation({
    mutationFn: () =>
      confirmCompositionReceipt(accessToken!, orderId, activeProfileId),
    onSuccess: () => {
      invalidate();
      Alert.alert(
        "Merci",
        "Réception confirmée — le paiement du moulin est libéré."
      );
    },
    onError: (err) => Alert.alert("Erreur", formatApiError(err))
  });

  const disputeMut = useMutation({
    mutationFn: (reason: string) =>
      openCompositionOrderDispute(
        accessToken!,
        orderId,
        reason,
        activeProfileId
      ),
    onSuccess: () => {
      invalidate();
      Alert.alert(
        "Litige ouvert",
        "La libération du paiement est suspendue le temps de l'examen."
      );
    },
    onError: (err) => Alert.alert("Erreur", formatApiError(err))
  });

  const tryConfirmPayment = useCallback(async () => {
    if (!accessToken || !pendingPayment) return;
    try {
      const updated = await confirmCompositionOrderPayment(
        accessToken,
        orderId,
        pendingPayment.providerRef,
        activeProfileId
      );
      if (updated.status === "PAID") {
        setPendingPayment(null);
        invalidate();
        Alert.alert("Paiement confirmé", "Le moulin peut démarrer la production.");
      }
    } catch {
      // webhook ou prochain poll
    }
  }, [accessToken, pendingPayment, orderId, activeProfileId, invalidate]);

  const syncPayment = useCallback(async () => {
    if (!accessToken) return;
    try {
      const fresh = await fetchCompositionOrder(
        accessToken,
        orderId,
        activeProfileId
      );
      if (fresh.status === "PAID") {
        setPendingPayment(null);
        invalidate();
        return;
      }
    } catch {
      // ignore
    }
    await tryConfirmPayment();
  }, [accessToken, orderId, activeProfileId, invalidate, tryConfirmPayment]);

  useEffect(() => {
    if (!pendingPayment) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncPayment();
    });
    return () => sub.remove();
  }, [pendingPayment, syncPayment]);

  const payMut = useMutation({
    mutationFn: async () => {
      const init = await payCompositionOrder(
        accessToken!,
        orderId,
        { paymentMethod: "mobile_money" },
        activeProfileId
      );
      if (init.paymentUrl) {
        setPendingPayment({
          providerRef: init.providerRef,
          paymentUrl: init.paymentUrl
        });
        await openPaymentCheckout(init.paymentUrl);
        return;
      }
      await confirmCompositionOrderPayment(
        accessToken!,
        orderId,
        init.providerRef,
        activeProfileId
      );
    },
    onSuccess: () => {
      invalidate();
      Alert.alert("Paiement", "Paiement initié. Confirmation en cours…");
    },
    onError: (err) => Alert.alert("Erreur", formatApiError(err))
  });

  const tracking = useMemo(
    () => (order ? trackingIndex(order.status) : { activeIndex: 0, completedThroughIndex: -1 }),
    [order]
  );

  const displayPrice = order?.finalPriceXof ?? order?.quotedPriceXof ?? 0;

  if (orderQ.isPending) {
    return (
      <View style={[styles.center, { backgroundColor: palette.canvas }]}>
        <ActivityIndicator color={palette.primary} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.center, { backgroundColor: palette.canvas }]}>
        <Text style={{ color: palette.textPrimary }}>Commande introuvable.</Text>
      </View>
    );
  }

  const terminalNegative =
    order.status === "REJECTED" ||
    order.status === "CANCELLED" ||
    order.status === "REFUNDED";

  const canConfirmPickup =
    isProducerForOrder && order.status === "READY_FOR_PICKUP";
  const canConfirmDelivery =
    isProducerForOrder &&
    order.status === "OUT_FOR_DELIVERY" &&
    Boolean(order.delivery?.deliveredAt);
  const canDispute =
    isProducerForOrder &&
    (order.status === "READY_FOR_PICKUP" ||
      (order.status === "OUT_FOR_DELIVERY" &&
        Boolean(order.delivery?.deliveredAt))) &&
    Boolean(order.disputeWindowEndsAt) &&
    !order.dispute;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: palette.canvas }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: bottomPad + mobileSpacing.xl }
      ]}
      testID="composition-order-detail"
    >
      <Text style={[styles.ref, { color: palette.textSecondary }]}>
        Commande composition
      </Text>
      <Text style={[styles.title, { color: palette.textPrimary }]}>
        {statusLabelFr(order.status)}
      </Text>
      <Text style={[styles.amount, { color: palette.primary }]}>
        {formatXof(displayPrice)}
      </Text>

      {terminalNegative ? (
        <View
          style={[
            styles.bannerDanger,
            { backgroundColor: mobileStatusSurfaces.errorBg }
          ]}
        >
          <Text style={[styles.bannerDangerText, { color: palette.danger }]}>
            Cette commande est {statusLabelFr(order.status).toLowerCase()}.
          </Text>
        </View>
      ) : (
        <OrderTrackingStepper
          steps={TRACKING_STEPS}
          activeIndex={tracking.activeIndex}
          completedThroughIndex={tracking.completedThroughIndex}
          palette={palette}
        />
      )}

      <View style={[styles.datesCard, { borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
          Dates
        </Text>
        <Text style={[styles.dateRow, { color: palette.textSecondary }]}>
          Début production (estimé) :{" "}
          {formatDateFr(order.productionStartEstimate)}
        </Text>
        <Text style={[styles.dateRow, { color: palette.textSecondary }]}>
          Disponibilité (estimée) : {formatDateFr(order.readyEstimate)}
        </Text>
        {order.readyActual ? (
          <Text style={[styles.dateRow, { color: palette.textSecondary }]}>
            Prête le : {formatDateFr(order.readyActual)}
          </Text>
        ) : null}
      </View>

      {order.millNote ? (
        <Text style={[styles.note, { color: palette.textPrimary }]}>
          Note du moulin : {order.millNote}
        </Text>
      ) : null}

      {(order.status === "PAID" || order.status === "IN_PRODUCTION") &&
      order.readyEstimate ? (
        <DeadlineNotice
          deadlineAt={order.readyEstimate}
          labelKey="orders.composition.readyBy"
          palette={palette}
        />
      ) : null}

      {(order.status === "READY_FOR_PICKUP" ||
        order.status === "OUT_FOR_DELIVERY") &&
      order.disputeWindowEndsAt ? (
        <DeadlineNotice
          deadlineAt={order.disputeWindowEndsAt}
          outcomeKey="deadline.outcome.compositionAutoComplete"
          palette={palette}
        />
      ) : null}

      {order.status === "DISPUTED" ? (
        <View
          style={[
            styles.bannerDanger,
            { backgroundColor: mobileStatusSurfaces.errorBg }
          ]}
        >
          <Text style={[styles.bannerDangerText, { color: palette.danger }]}>
            Litige ouvert
            {order.dispute?.reason ? ` — ${order.dispute.reason}` : ""}. Le
            paiement est suspendu.
          </Text>
        </View>
      ) : null}

      {order.delivery ? (
        <View style={[styles.datesCard, { borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
            Livraison
          </Text>
          <Text style={[styles.dateRow, { color: palette.textSecondary }]}>
            Statut : {order.delivery.status}
          </Text>
          <Text style={[styles.dateRow, { color: palette.textSecondary }]}>
            Frais : {formatXof(order.delivery.feeXof)}
          </Text>
          {order.delivery.deliveredAt ? (
            <Text style={[styles.dateRow, { color: palette.textSecondary }]}>
              Remise le : {formatDateFr(order.delivery.deliveredAt)}
            </Text>
          ) : null}
          {order.delivery.note ? (
            <Text style={[styles.dateRow, { color: palette.textSecondary }]}>
              Note : {order.delivery.note}
            </Text>
          ) : null}
        </View>
      ) : null}

      {isProducerForOrder && order.status === "MILL_REVISED" ? (
        <View style={styles.actions}>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: palette.primary }]}
            onPress={() => acceptMut.mutate()}
            disabled={acceptMut.isPending}
            testID="accept-composition-order"
          >
            <Text style={[styles.btnLabel, { color: palette.onPrimary }]}>
              Accepter la révision
            </Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryBtn, { borderColor: palette.primary }]}
            onPress={() =>
              Alert.alert(
                "Refuser",
                "Refuser la proposition du moulin ?",
                [
                  { text: "Annuler", style: "cancel" },
                  { text: "Refuser", style: "destructive", onPress: () => rejectMut.mutate() }
                ]
              )
            }
            disabled={rejectMut.isPending}
            testID="reject-composition-order"
          >
            <Text style={[styles.secondaryLabel, { color: palette.primary }]}>
              Refuser
            </Text>
          </Pressable>
        </View>
      ) : null}

      {isProducerForOrder && order.status === "ACCEPTED" ? (
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: palette.primary }]}
          onPress={() => payMut.mutate()}
          disabled={payMut.isPending}
          testID="pay-composition-order"
        >
          {payMut.isPending ? (
            <ActivityIndicator color={palette.onPrimary} />
          ) : (
            <Text style={[styles.btnLabel, { color: palette.onPrimary }]}>
              Payer {formatXof(displayPrice)}
            </Text>
          )}
        </Pressable>
      ) : null}

      {pendingPayment ? (
        <Pressable
          style={[styles.secondaryBtn, { borderColor: palette.primary }]}
          onPress={() => void tryConfirmPayment()}
        >
          <Text style={[styles.secondaryLabel, { color: palette.primary }]}>
            J'ai payé — confirmer
          </Text>
        </Pressable>
      ) : null}

      {isMillForOrder &&
      (order.status === "SENT_TO_MILL" || order.status === "MILL_REVISED") ? (
        <View style={styles.actions}>
          <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
            Réviser la commande
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: palette.textPrimary,
                borderColor: palette.border,
                backgroundColor: palette.cardBg
              }
            ]}
            placeholder="Note pour le producteur (optionnel)"
            placeholderTextColor={palette.textSecondary}
            value={millNoteDraft}
            onChangeText={setMillNoteDraft}
            multiline
          />
          <Text style={[styles.hint, { color: palette.textSecondary }]}>
            Début production (ISO, ex. 2026-08-15T09:00:00.000Z)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: palette.textPrimary,
                borderColor: palette.border,
                backgroundColor: palette.cardBg
              }
            ]}
            value={productionStartDraft}
            onChangeText={setProductionStartDraft}
            autoCapitalize="none"
            testID="production-start-input"
          />
          <Text style={[styles.hint, { color: palette.textSecondary }]}>
            Disponibilité estimée (ISO)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: palette.textPrimary,
                borderColor: palette.border,
                backgroundColor: palette.cardBg
              }
            ]}
            value={readyEstimateDraft}
            onChangeText={setReadyEstimateDraft}
            autoCapitalize="none"
            testID="ready-estimate-input"
          />
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: palette.primary }]}
            onPress={() => reviseMut.mutate()}
            disabled={reviseMut.isPending}
            testID="mill-revise-order"
          >
            <Text style={[styles.btnLabel, { color: palette.onPrimary }]}>
              Envoyer la révision
            </Text>
          </Pressable>
        </View>
      ) : null}

      {isMillForOrder && order.status === "PAID" ? (
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: palette.primary }]}
          onPress={() => startProdMut.mutate()}
          disabled={startProdMut.isPending}
          testID="start-composition-production"
        >
          <Text style={[styles.btnLabel, { color: palette.onPrimary }]}>
            Lancer la production
          </Text>
        </Pressable>
      ) : null}

      {isMillForOrder && order.status === "IN_PRODUCTION" ? (
        <View style={styles.actions}>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: palette.primary }]}
            onPress={() => markReadyMut.mutate()}
            disabled={markReadyMut.isPending}
            testID="mark-composition-ready"
          >
            <Text style={[styles.btnLabel, { color: palette.onPrimary }]}>
              Marquer comme prête (retrait)
            </Text>
          </Pressable>
          {deliveryEnabled ? (
            <View style={styles.actions}>
              <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
                Ou livrer (autogéré)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: palette.textPrimary,
                    borderColor: palette.border,
                    backgroundColor: palette.cardBg
                  }
                ]}
                value={deliveryFeeDraft}
                onChangeText={setDeliveryFeeDraft}
                keyboardType="numeric"
                placeholder="Frais de livraison (XOF)"
                placeholderTextColor={palette.textSecondary}
                testID="delivery-fee-input"
              />
              <TextInput
                style={[
                  styles.input,
                  {
                    color: palette.textPrimary,
                    borderColor: palette.border,
                    backgroundColor: palette.cardBg
                  }
                ]}
                value={deliveryNoteDraft}
                onChangeText={setDeliveryNoteDraft}
                placeholder="Note de remise (optionnel)"
                placeholderTextColor={palette.textSecondary}
              />
              <Pressable
                style={[styles.secondaryBtn, { borderColor: palette.primary }]}
                onPress={() => outForDeliveryMut.mutate()}
                disabled={outForDeliveryMut.isPending}
                testID="mark-composition-out-for-delivery"
              >
                <Text style={[styles.secondaryLabel, { color: palette.primary }]}>
                  Marquer en livraison
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {isMillForOrder &&
      order.status === "OUT_FOR_DELIVERY" &&
      !order.delivery?.deliveredAt ? (
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: palette.primary }]}
          onPress={() => markDeliveredMut.mutate()}
          disabled={markDeliveredMut.isPending}
          testID="mark-composition-delivered"
        >
          <Text style={[styles.btnLabel, { color: palette.onPrimary }]}>
            Marquer livré
          </Text>
        </Pressable>
      ) : null}

      {(canConfirmPickup || canConfirmDelivery) && (
        <View style={styles.actions}>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: palette.primary }]}
            onPress={() => confirmReceiptMut.mutate()}
            disabled={confirmReceiptMut.isPending}
            testID="confirm-composition-receipt"
          >
            <Text style={[styles.btnLabel, { color: palette.onPrimary }]}>
              J'ai bien reçu ma commande
            </Text>
          </Pressable>
          {canDispute ? (
            <Pressable
              style={[styles.secondaryBtn, { borderColor: palette.danger }]}
              onPress={() =>
                Alert.alert(
                  "Signaler un problème",
                  "Décrivez le problème (sac manquant, mauvais intrant, quantité…).",
                  [
                    { text: "Annuler", style: "cancel" },
                    {
                      text: "Sac manquant",
                      onPress: () => disputeMut.mutate("Sac manquant")
                    },
                    {
                      text: "Quantité incorrecte",
                      onPress: () =>
                        disputeMut.mutate("Quantité incorrecte")
                    },
                    {
                      text: "Mauvais intrant",
                      style: "destructive",
                      onPress: () => disputeMut.mutate("Mauvais intrant")
                    }
                  ]
                )
              }
              disabled={disputeMut.isPending}
              testID="open-composition-dispute"
            >
              <Text style={[styles.secondaryLabel, { color: palette.danger }]}>
                Signaler un problème
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: mobileSpacing.lg,
    gap: mobileSpacing.md
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  ref: {
    fontSize: mobileFontSize.xs,
    fontWeight: "600"
  },
  title: {
    fontSize: mobileFontSize.xl,
    fontWeight: "800"
  },
  amount: {
    fontSize: mobileFontSize.lg,
    fontWeight: "800"
  },
  bannerDanger: {
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md
  },
  bannerDangerText: {
    fontWeight: "700",
    fontSize: mobileFontSize.sm
  },
  datesCard: {
    borderWidth: 1,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    gap: mobileSpacing.xs
  },
  sectionTitle: {
    fontSize: mobileFontSize.md,
    fontWeight: "800"
  },
  dateRow: {
    fontSize: mobileFontSize.sm,
    fontWeight: "600"
  },
  note: {
    fontSize: mobileFontSize.sm,
    lineHeight: 20
  },
  actions: { gap: mobileSpacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    minHeight: 44,
    fontSize: mobileFontSize.sm
  },
  hint: {
    fontSize: mobileFontSize.xs,
    fontWeight: "600"
  },
  primaryBtn: {
    borderRadius: mobileRadius.md,
    paddingVertical: mobileSpacing.md,
    alignItems: "center"
  },
  btnLabel: {
    fontWeight: "800",
    textAlign: "center"
  },
  secondaryBtn: {
    borderWidth: 1,
    borderRadius: mobileRadius.md,
    paddingVertical: mobileSpacing.md,
    alignItems: "center"
  },
  secondaryLabel: {
    fontWeight: "700",
    textAlign: "center"
  }
});
