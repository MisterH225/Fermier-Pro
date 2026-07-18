import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { AppDatePicker } from "../components/common/AppDatePicker";
import { MarketplaceModuleGate } from "../components/MarketplaceModuleGate";
import { invalidateBuyerDashboardQueries } from "../lib/buyerDashboardQueries";
import {
  formatMarketMoney,
  parseMarketNum
} from "../components/marketplace/MarketplaceListingCard";
import { ConfirmReceiptModal } from "../components/marketplace/ConfirmReceiptModal";
import { ConfirmShipmentModal } from "../components/marketplace/ConfirmShipmentModal";
import { DeclareWeightModal } from "../components/marketplace/DeclareWeightModal";
import { DeclareSellerWeightModal } from "../components/marketplace/DeclareSellerWeightModal";
import {
  MarketplacePaymentMethodPicker,
  type MarketplacePaymentMethodChoice
} from "../components/buyer/MarketplacePaymentMethodPicker";
import { TransferToFarmModal } from "../components/marketplace/TransferToFarmModal";
import {
  PrimaryButton,
  SecondaryButton
} from "../components/marketplace/transaction/MarketplaceTransactionActionButtons";
import { MarketplaceTransactionOverview } from "../components/marketplace/transaction/MarketplaceTransactionOverview";
import { MarketplaceTransactionStatusNotice } from "../components/marketplace/transaction/MarketplaceTransactionStatusNotice";
import { TransactionReceiptCard } from "../components/marketplace/TransactionReceiptCard";
import { useBottomInset } from "../hooks/useBottomInset";
import { useSession } from "../context/SessionContext";
import {
  cancelMarketplaceTransaction,
  completeMarketplacePendingTransfer,
  confirmMarketplacePayment,
  confirmMarketplacePickup,
  confirmMarketplaceReceipt,
  confirmMarketplaceShipment,
  declareMarketplaceWeight,
  declareSellerMarketplaceWeight,
  ensureDirectChatRoom,
  fetchMarketplaceTransaction,
  fetchBuyerWallet,
  initiateMarketplacePayment,
  requestMarketplaceWeightArbitration,
  scheduleMarketplacePickup,
  syncMarketplacePayment,
  validateMarketplaceWeight,
  type MarketplaceTransactionDto
} from "../lib/api";
import {
  marketplaceActionErrorMessage,
  projectMarketplaceFinalAmount
} from "../lib/marketplaceLabels";
import { marketplaceTransactionActions } from "../lib/marketplaceOrderStatusUi";
import { openPaymentCheckout } from "../lib/paymentCheckout";
import { fromIsoDateString, startOfDay } from "../lib/appDate";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<
  RootStackParamList,
  "MarketplaceTransaction"
>;

function money(n: number, currency: string): string {
  return formatMarketMoney(Math.round(n), currency);
}

const PAYMENT_SYNC_ATTEMPTS = 20;
const PAYMENT_SYNC_INTERVAL_MS = 2500;

async function waitForMarketplacePaymentHeld(
  accessToken: string,
  transactionId: string,
  activeProfileId?: string | null
): Promise<MarketplaceTransactionDto | { pendingExternalPayment: true }> {
  for (let attempt = 0; attempt < PAYMENT_SYNC_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, PAYMENT_SYNC_INTERVAL_MS)
      );
    }
    const synced = await syncMarketplacePayment(
      accessToken,
      transactionId,
      activeProfileId
    );
    if (synced.status === "PAYMENT_HELD") {
      return synced;
    }
    if (synced.status === "PAYMENT_FAILED") {
      throw new Error("MARKETPLACE_PAYMENT_FAILED_AFTER_CHECKOUT");
    }
  }
  return { pendingExternalPayment: true as const };
}

function formatPickupDate(iso: string): string {
  const d = fromIsoDateString(iso) ?? new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function MarketplaceTransactionScreen({ route, navigation }: Props) {
  const { transactionId } = route.params;
  const { t } = useTranslation();
  const { accessToken, activeProfileId, authMe, clientFeatures } =
    useSession();
  const bottomInset = useBottomInset();
  const qc = useQueryClient();
  const [pickupDate, setPickupDate] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [declareWeightOpen, setDeclareWeightOpen] = useState(false);
  const [sellerWeightOpen, setSellerWeightOpen] = useState(false);
  const [shipmentOpen, setShipmentOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] =
    useState<MarketplacePaymentMethodChoice>("mobile_money");
  const userPickedPaymentMethod = useRef(false);
  const minPickupDate = useMemo(() => startOfDay(new Date()), []);

  const q = useQuery({
    queryKey: ["marketplaceTransaction", transactionId, activeProfileId],
    queryFn: () =>
      fetchMarketplaceTransaction(
        accessToken,
        transactionId,
        activeProfileId
      ),
    enabled: clientFeatures.marketplace && Boolean(accessToken),
    refetchOnMount: "always",
    staleTime: 0
  });

  const walletQ = useQuery({
    queryKey: ["buyerWallet", activeProfileId],
    queryFn: () => fetchBuyerWallet(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const invalidate = () => {
    void qc.invalidateQueries({
      queryKey: ["marketplaceTransaction", transactionId]
    });
    void qc.invalidateQueries({ queryKey: ["marketplaceTransactions"] });
    void qc.invalidateQueries({ queryKey: ["marketplaceTransactionSummary"] });
    void qc.invalidateQueries({ queryKey: ["buyerWallet"] });
    void qc.invalidateQueries({ queryKey: ["buyerWalletEntries"] });
    invalidateBuyerDashboardQueries(qc);
  };

  const payMut = useMutation({
    mutationFn: async () => {
      const refetchResult = await q.refetch();
      if (refetchResult.error) {
        throw refetchResult.error;
      }
      const fresh = refetchResult.data;
      if (!fresh) {
        throw new Error("MARKETPLACE_TRANSACTION_NOT_FOUND");
      }
      if (fresh.status === "PAYMENT_HELD") {
        throw new Error("MARKETPLACE_PAYMENT_ALREADY_HELD");
      }
      if (fresh.status !== "PAYMENT_PENDING" && fresh.status !== "PAYMENT_FAILED") {
        throw new Error(`MARKETPLACE_PAYMENT_INVALID_STATUS:${fresh.status}`);
      }

      const init = await initiateMarketplacePayment(
        accessToken!,
        transactionId,
        activeProfileId,
        paymentMethod
      );
      const usesMobileMoney = init.paymentMethod !== "wallet";
      if (usesMobileMoney) {
        const checkoutUrl = init.paymentUrl?.trim();
        if (!checkoutUrl) {
          throw new Error("MARKETPLACE_CHECKOUT_URL_MISSING");
        }
        await openPaymentCheckout(checkoutUrl);
        return waitForMarketplacePaymentHeld(
          accessToken!,
          transactionId,
          activeProfileId
        );
      }
      return confirmMarketplacePayment(
        accessToken,
        transactionId,
        init.providerRef,
        activeProfileId
      );
    },
    onSuccess: (result) => {
      invalidate();
      if (
        result &&
        "pendingExternalPayment" in result &&
        result.pendingExternalPayment
      ) {
        Alert.alert(
          t("marketScreen.transaction.paymentPendingTitle"),
          t("marketScreen.transaction.paymentPendingBody")
        );
        return;
      }
      const status =
        result && "status" in result ? result.status : undefined;
      if (status === "PAYMENT_HELD") {
        Alert.alert(
          t("marketScreen.transaction.paymentSuccessTitle"),
          t("marketScreen.transaction.paymentSuccessBody")
        );
        return;
      }
      if (status === "PAYMENT_PENDING") {
        Alert.alert(
          t("marketScreen.transaction.paymentPendingTitle"),
          t("marketScreen.transaction.paymentPendingBody")
        );
        return;
      }
      void q.refetch();
    },
    onError: async (e: Error) => {
      if (e.message === "MARKETPLACE_PAYMENT_ALREADY_HELD") {
        invalidate();
        Alert.alert(
          t("marketScreen.transaction.paymentAlreadyHeldTitle"),
          t("marketScreen.transaction.paymentAlreadyHeldBody")
        );
        return;
      }
      if (e.message === "MARKETPLACE_TRANSACTION_NOT_FOUND") {
        invalidate();
      }
      if (e.message === "MARKETPLACE_PAYMENT_FAILED_AFTER_CHECKOUT") {
        invalidate();
        Alert.alert(
          t("marketScreen.transaction.paymentErrorTitle"),
          t("marketScreen.transaction.paymentFailedRetryHint")
        );
        return;
      }
      if (e.message === "MARKETPLACE_CHECKOUT_URL_MISSING") {
        Alert.alert(
          t("marketScreen.transaction.paymentErrorTitle"),
          t("marketScreen.transaction.checkoutUrlMissing")
        );
        return;
      }
      if (e.message === "MARKETPLACE_CHECKOUT_URL_INVALID") {
        Alert.alert(
          t("marketScreen.transaction.paymentErrorTitle"),
          t("marketScreen.transaction.checkoutUrlInvalid")
        );
        return;
      }
      if (/session de paiement expirée/i.test(e.message)) {
        try {
          const init = await initiateMarketplacePayment(
            accessToken!,
            transactionId,
            activeProfileId,
            "mobile_money"
          );
          const checkoutUrl = init.paymentUrl?.trim();
          if (checkoutUrl) {
            await openPaymentCheckout(checkoutUrl);
            invalidate();
            Alert.alert(
              t("marketScreen.transaction.paymentPendingTitle"),
              t("marketScreen.transaction.paymentPendingBody")
            );
            return;
          }
        } catch {
          /* retombe sur l'alerte d'erreur ci-dessous */
        }
      }
      const msg = marketplaceActionErrorMessage(e, t);
      if (
        msg.toLowerCase().includes("en attente") ||
        msg.toLowerCase().includes("awaiting confirmation")
      ) {
        invalidate();
        Alert.alert(
          t("marketScreen.transaction.paymentPendingTitle"),
          t("marketScreen.transaction.paymentPendingBody")
        );
        return;
      }
      Alert.alert(
        t("marketScreen.transaction.paymentErrorTitle"),
        msg
      );
    }
  });

  const pickupMut = useMutation({
    mutationFn: () =>
      scheduleMarketplacePickup(
        accessToken,
        transactionId,
        {
          pickupDate,
          pickupLocation: pickupLocation.trim()
        },
        activeProfileId
      ),
    onSuccess: () => {
      invalidate();
      Alert.alert(
        t("marketScreen.transaction.pickupProposedTitle"),
        t("marketScreen.transaction.pickupProposedBody")
      );
    },
    onError: (e: Error) =>
      Alert.alert("Impossible", marketplaceActionErrorMessage(e, t))
  });

  const confirmPickupMut = useMutation({
    mutationFn: () =>
      confirmMarketplacePickup(accessToken, transactionId, activeProfileId),
    onSuccess: () => {
      invalidate();
      Alert.alert(
        t("marketScreen.transaction.pickupConfirmedTitle"),
        t("marketScreen.transaction.pickupConfirmedBody")
      );
    },
    onError: (e: Error) =>
      Alert.alert("Impossible", marketplaceActionErrorMessage(e, t))
  });

  const shipmentMut = useMutation({
    mutationFn: (payload: {
      shippedAt: string;
      method?: "handover" | "third_party" | "seller_delivery";
      notes?: string;
    }) =>
      confirmMarketplaceShipment(
        accessToken,
        transactionId,
        payload,
        activeProfileId
      ),
    onSuccess: () => {
      setShipmentOpen(false);
      invalidate();
      Alert.alert(
        t("marketScreen.shipmentModal.successTitle"),
        t("marketScreen.shipmentModal.successBody")
      );
    },
    onError: (e: Error) =>
      Alert.alert("Impossible", marketplaceActionErrorMessage(e, t))
  });

  const receiptMut = useMutation({
    mutationFn: (payload: {
      receivedAt: string;
      condition: "conform" | "minor_issue" | "major_issue";
      receivedAnimalIds: string[];
      receivedHeadcount?: number;
      notes?: string;
    }) =>
      confirmMarketplaceReceipt(
        accessToken,
        transactionId,
        payload,
        activeProfileId
      ),
    onSuccess: () => {
      setReceiptOpen(false);
      invalidate();
      Alert.alert(
        t("marketScreen.receiptModal.successTitle"),
        t("marketScreen.receiptModal.successBody")
      );
    },
    onError: (e: Error) =>
      Alert.alert("Impossible", marketplaceActionErrorMessage(e, t))
  });

  const weightMut = useMutation({
    mutationFn: (payload: {
      animalWeights?: Array<{
        animalId: string;
        weightKg: number;
        photoUrl?: string;
      }>;
      realWeightKg?: number;
    }) =>
      declareMarketplaceWeight(
        accessToken,
        transactionId,
        payload,
        activeProfileId
      ),
    onSuccess: () => {
      setDeclareWeightOpen(false);
      invalidate();
      Alert.alert(
        t("marketScreen.transaction.weightDeclaredTitle"),
        t("marketScreen.transaction.weightDeclaredBody")
      );
    },
    onError: (e: Error) =>
      Alert.alert("Impossible", marketplaceActionErrorMessage(e, t))
  });

  const sellerWeightMut = useMutation({
    mutationFn: (payload: { sellerDeclaredWeightKg: number; photoUrl?: string }) =>
      declareSellerMarketplaceWeight(
        accessToken,
        transactionId,
        payload,
        activeProfileId
      ),
    onSuccess: () => {
      setSellerWeightOpen(false);
      invalidate();
      Alert.alert(
        t("marketScreen.transaction.sellerWeightDeclaredTitle"),
        t("marketScreen.transaction.sellerWeightDeclaredBody")
      );
    },
    onError: (e: Error) =>
      Alert.alert("Impossible", marketplaceActionErrorMessage(e, t))
  });

  const arbitrationMut = useMutation({
    mutationFn: () =>
      requestMarketplaceWeightArbitration(
        accessToken,
        transactionId,
        activeProfileId
      ),
    onSuccess: () => {
      invalidate();
      Alert.alert(
        t("marketScreen.transaction.arbitrationRequestedTitle"),
        t("marketScreen.transaction.arbitrationRequestedBody")
      );
    },
    onError: (e: Error) =>
      Alert.alert("Impossible", marketplaceActionErrorMessage(e, t))
  });

  const validateMut = useMutation({
    mutationFn: () =>
      validateMarketplaceWeight(accessToken, transactionId, activeProfileId),
    onSuccess: () => invalidate(),
    onError: (e: Error) =>
      Alert.alert("Impossible", marketplaceActionErrorMessage(e, t))
  });

  const cancelMut = useMutation({
    mutationFn: () =>
      cancelMarketplaceTransaction(
        accessToken,
        transactionId,
        activeProfileId
      ),
    onSuccess: () => {
      invalidate();
      navigation.goBack();
    },
    onError: (e: Error) =>
      Alert.alert("Impossible", marketplaceActionErrorMessage(e, t))
  });

  const transferMut = useMutation({
    mutationFn: (payload: { buyerFarmId: string; penId?: string }) =>
      completeMarketplacePendingTransfer(
        accessToken,
        transactionId,
        payload,
        activeProfileId
      ),
    onSuccess: () => {
      setTransferOpen(false);
      invalidate();
      Alert.alert(
        t("marketScreen.transferModal.successTitle"),
        t("marketScreen.transferModal.successBody")
      );
    },
    onError: (e: Error) =>
      Alert.alert("Impossible", marketplaceActionErrorMessage(e, t))
  });

  const contactMut = useMutation({
    mutationFn: (peerUserId: string) =>
      ensureDirectChatRoom(
        accessToken!,
        peerUserId,
        activeProfileId,
        q.data?.listingId
      ),
    onSuccess: (room) => {
      void qc.invalidateQueries({ queryKey: ["chatRooms", activeProfileId] });
      navigation.navigate("ChatRoom", {
        roomId: room.id,
        headline:
          room.title?.trim() ||
          t("marketScreen.transaction.marketplaceCounterparty"),
        listingId: q.data?.listingId
      });
    },
    onError: (e: Error) =>
      Alert.alert("Impossible", marketplaceActionErrorMessage(e, t))
  });

  const tx = q.data;
  const walletBalance = walletQ.data?.balance ?? 0;
  const payCurrency = tx?.currency ?? walletQ.data?.currency ?? "XOF";
  const payAmount = tx?.blockedAmount ?? 0;

  // Prix convenu réel = prix forfaitaire OU prix/kg × poids estimé
  // On N'utilise PAS blockedAmount - fee car blockedAmount inclut aussi le buffer poids (+10 %)
  const agreedDeal = tx
    ? tx.agreedFlatPrice != null
      ? tx.agreedFlatPrice
      : (tx.agreedPricePerKg ?? 0) * (tx.estimatedWeightKg ?? 0)
    : 0;

  // Frais acheteur — affichés même à 0 pour la transparence totale
  const buyerCommissionRate = tx?.commissionRate ?? 0;
  const buyerPaysCommission = tx?.buyerPaysCommission === true;
  const feeRatePct = Math.round(buyerCommissionRate * 100);
  const feeEstimate = buyerPaysCommission ? (tx?.platformFeeEstimate ?? 0) : 0;
  // Total = achat + frais (sans buffer per_kg — restitué à la clôture)
  const paymentTotal = agreedDeal + feeEstimate;

  // Toujours montrer la confirmation avec le détail avant de payer
  const handlePayPress = () => {
    Alert.alert(
      t("marketScreen.transaction.feeConsentTitle"),
      t("marketScreen.transaction.feeConsentBody", {
        dealAmount: money(agreedDeal, payCurrency),
        pct: feeRatePct,
        feeAmount: money(feeEstimate, payCurrency),
        totalAmount: money(paymentTotal, payCurrency)
      }),
      [
        {
          text: t("marketScreen.transaction.feeConsentCancel"),
          style: "cancel"
        },
        {
          text: t("marketScreen.transaction.feeConsentConfirm"),
          onPress: () => payMut.mutate()
        }
      ]
    );
  };

  useEffect(() => {
    if (userPickedPaymentMethod.current) {
      return;
    }
    setPaymentMethod("mobile_money");
  }, [payAmount]);

  useEffect(() => {
    const status = q.data?.status;
    const buyer = authMe?.user.id === q.data?.buyerUserId;
    if (status !== "PAYMENT_PENDING" || !buyer) {
      return;
    }
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void q.refetch();
      }
    });
    return () => sub.remove();
  }, [q.data?.status, q.data?.buyerUserId, authMe?.user.id, q]);

  if (!clientFeatures.marketplace) {
    return (
      <MarketplaceModuleGate>
        <View />
      </MarketplaceModuleGate>
    );
  }

  if (q.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={mobileColors.accent} />
      </View>
    );
  }

  if (!tx) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Transaction introuvable.</Text>
      </View>
    );
  }

  const myId = authMe?.user.id;
  const isBuyer = myId === tx.buyerUserId;
  const isSeller = myId === tx.sellerUserId;
  const role = isBuyer ? "buyer" : "seller";
  const availableActions = marketplaceTransactionActions(tx.status, role);
  const hasAction = (action: (typeof availableActions)[number]) =>
    availableActions.includes(action);
  const cur = tx.currency || "XOF";
  const estKg = parseMarketNum(tx.estimatedWeightKg);
  const agreedPerKg = parseMarketNum(tx.agreedPricePerKg);
  const agreedFlat = parseMarketNum(tx.agreedFlatPrice);
  const statusLabel = t(`marketScreen.transaction.status.${tx.status}`, {
    defaultValue: tx.status
  });
  const payReady =
    hasAction("pay") &&
    q.isSuccess &&
    !q.isFetching;
  const projectedFinal =
    tx.finalAmount ??
    projectMarketplaceFinalAmount({
      priceType: tx.priceType,
      agreedPricePerKg: agreedPerKg,
      agreedFlatPrice: agreedFlat,
      realWeightKg: tx.realWeightKg
    });
  const animalIds = tx.listingAnimalIds ?? [];
  const canConfirmPickup = hasAction("confirm_pickup");
  const canConfirmShipment = hasAction("confirm_shipment");
  const canConfirmReceipt = hasAction("confirm_receipt");
  const canDeclareWeight = hasAction("declare_weight");
  const pendingTransfer = tx.pendingTransfer;
  const canCompleteTransfer =
    hasAction("complete_transfer") &&
    pendingTransfer != null &&
    pendingTransfer.completedAt == null &&
    pendingTransfer.cancelledAt == null;
  const showPickupForm = hasAction("propose_pickup");
  const overviewAmount =
    tx.status === "TRANSACTION_CLOSED" && tx.finalAmount != null
      ? money(tx.finalAmount, cur)
      : money(tx.blockedAmount, cur);
  const overviewAgreedPrice =
    agreedFlat != null
      ? money(agreedFlat, cur)
      : agreedPerKg != null
        ? `${money(agreedPerKg, cur)}/kg`
        : t("marketScreen.transaction.notAvailable");
  const overviewAgreedWeight =
    estKg != null
      ? `${estKg.toLocaleString("fr-FR", {
          maximumFractionDigits: 1
        })} kg`
      : t("marketScreen.transaction.notAvailable");
  const overviewDeclaredWeight =
    tx.realWeightKg != null || tx.sellerDeclaredWeightKg != null
      ? [
          tx.realWeightKg != null
            ? `${t("marketScreen.transaction.buyerShort")}: ${tx.realWeightKg.toLocaleString(
                "fr-FR",
                { maximumFractionDigits: 1 }
              )} kg`
            : null,
          tx.sellerDeclaredWeightKg != null
            ? `${t("marketScreen.transaction.sellerShort")}: ${tx.sellerDeclaredWeightKg.toLocaleString(
                "fr-FR",
                { maximumFractionDigits: 1 }
              )} kg`
            : null
        ]
          .filter(Boolean)
          .join(" · ")
      : t("marketScreen.transaction.notDeclared");
  const showScheduledPickup =
    Boolean(tx.pickupDate && tx.pickupLocation) &&
    [
      "PICKUP_PROPOSED",
      "PICKUP_SCHEDULED",
      "WEIGHT_DECLARED",
      "WEIGHT_COUNTER_DECLARED",
      "WEIGHT_DISPUTED",
      "WEIGHT_VALIDATED",
      "SELLER_SHIPPED",
      "BUYER_RECEIVED"
    ].includes(tx.status);

  return (
    <KeyboardAvoidingView
      style={styles.scroll}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <MarketplaceTransactionOverview
        transaction={tx}
        role={role}
        amount={overviewAmount}
        agreedPrice={overviewAgreedPrice}
        agreedWeight={overviewAgreedWeight}
        declaredWeight={overviewDeclaredWeight}
        onMessage={() =>
          contactMut.mutate(isBuyer ? tx.sellerUserId : tx.buyerUserId)
        }
        messageBusy={contactMut.isPending}
      />

      {showScheduledPickup && tx.pickupDate && tx.pickupLocation ? (
        <View style={styles.section}>
          <Text style={styles.line}>
            {t("marketScreen.transaction.scheduledPickup", {
              date: formatPickupDate(tx.pickupDate),
              location: tx.pickupLocation
            })}
          </Text>
        </View>
      ) : null}

      <MarketplaceTransactionStatusNotice status={tx.status} role={role} />

      {canConfirmPickup ? (
        <View style={styles.section}>
          <PrimaryButton
            label={t("marketScreen.transaction.confirmPickupCta")}
            onPress={() => confirmPickupMut.mutate()}
            loading={confirmPickupMut.isPending}
          />
        </View>
      ) : null}

      {canConfirmShipment ? (
        <View style={styles.section}>
          <PrimaryButton
            label={t("marketScreen.shipmentModal.open")}
            onPress={() => setShipmentOpen(true)}
          />
        </View>
      ) : null}

      {canConfirmReceipt ? (
        <View style={styles.section}>
          <PrimaryButton
            label={t("marketScreen.receiptModal.open")}
            onPress={() => setReceiptOpen(true)}
          />
        </View>
      ) : null}

      {isBuyer &&
      tx.status !== "PAYMENT_PENDING" &&
      tx.status !== "PAYMENT_FAILED" &&
      tx.status !== "PAYMENT_HELD" ? (
        <View style={styles.section}>
          <Text style={styles.waiting}>
            {tx.status === "PAYMENT_HELD"
              ? t("marketScreen.transaction.paymentAlreadyHeldBody")
              : t("marketScreen.transaction.paymentInvalidStatus", {
                  status: statusLabel
                })}
          </Text>
        </View>
      ) : null}

      {isBuyer && tx.status === "PAYMENT_FAILED" ? (
        <View style={styles.section}>
          <Text style={styles.hint}>
            {t("marketScreen.transaction.paymentFailedRetryHint")}
          </Text>
        </View>
      ) : null}

      {payReady ? (
        <View style={styles.section}>
          {/* Récapitulatif toujours visible — transparence obligatoire */}
          <View style={styles.feeBreakdown}>
            <Text style={styles.feeBreakdownTitle}>
              {t("marketScreen.transaction.paymentSummaryTitle")}
            </Text>
            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>
                {tx.priceType === "flat"
                  ? t("marketScreen.transaction.dealPriceLabel")
                  : t("marketScreen.transaction.dealPriceEstimatedLabel")}
              </Text>
              <Text style={styles.feeValue}>{money(agreedDeal, cur)}</Text>
            </View>
            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>
                {feeRatePct > 0
                  ? (tx.priceType === "flat"
                      ? t("marketScreen.transaction.platformFeeLabel", { pct: feeRatePct })
                      : t("marketScreen.transaction.platformFeeEstimatedLabel", { pct: feeRatePct }))
                  : t("marketScreen.transaction.platformFeeZeroLabel")}
              </Text>
              <Text style={[styles.feeValue, feeEstimate > 0 && styles.feeValueAccent]}>
                {feeEstimate > 0 ? money(feeEstimate, cur) : t("marketScreen.transaction.feeIncluded")}
              </Text>
            </View>
            <View style={[styles.feeRow, styles.feeTotalRow]}>
              <Text style={styles.feeTotalLabel}>
                {t("marketScreen.transaction.totalPaymentLabel")}
              </Text>
              <Text style={styles.feeTotalValue}>{money(paymentTotal, cur)}</Text>
            </View>
            {tx.priceType !== "flat" ? (
                <Text style={styles.feeBufferNote}>
                  {t("marketScreen.transaction.feePerKgNote")}
                </Text>
              ) : null}
          </View>
          <MarketplacePaymentMethodPicker
            amount={payAmount}
            currency={payCurrency}
            walletBalance={walletBalance}
            value={paymentMethod}
            onChange={(method) => {
              userPickedPaymentMethod.current = true;
              setPaymentMethod(method);
            }}
            walletEnabled={clientFeatures.wallet}
          />
          <PrimaryButton
            label={t("marketScreen.transaction.payCta", {
              amount: money(paymentTotal, cur)
            })}
            onPress={handlePayPress}
            loading={payMut.isPending}
          />
        </View>
      ) : null}

      {showPickupForm ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("marketScreen.transaction.pickupSection")}
          </Text>
          <Text style={styles.hint}>
            {t("marketScreen.transaction.schedulePickupHint")}
          </Text>
          <AppDatePicker
            label={t("marketScreen.transaction.pickupDate")}
            mode="date"
            isoValue={pickupDate}
            onIsoChange={setPickupDate}
            minDate={minPickupDate}
          />
          <Text style={styles.label}>
            {t("marketScreen.transaction.pickupLocation")}
          </Text>
          <TextInput
            style={styles.input}
            value={pickupLocation}
            onChangeText={setPickupLocation}
            placeholder={t("marketScreen.transaction.pickupLocationPh")}
          />
          <PrimaryButton
            label={t("marketScreen.transaction.proposePickup")}
            onPress={() => pickupMut.mutate()}
            loading={pickupMut.isPending}
            disabled={!pickupDate.trim() || !pickupLocation.trim()}
          />
        </View>
      ) : null}

      {canDeclareWeight ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("marketScreen.transaction.weightSection")}
          </Text>
          <Text style={styles.hint}>
            {tx.priceType === "flat"
              ? t("marketScreen.transaction.weightAtDeliveryFlatHint")
              : t("marketScreen.transaction.declareWeightPerAnimalHint")}
          </Text>
          <PrimaryButton
            label={t("marketScreen.transaction.declareWeight")}
            onPress={() => setDeclareWeightOpen(true)}
          />
        </View>
      ) : null}

      {hasAction("counter_weight") ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("marketScreen.transaction.sellerWeightReview")}
          </Text>
          {tx.realWeightKg != null ? (
            <Text style={styles.line}>
              {t("marketScreen.transaction.buyerDeclaredWeight", {
                kg: tx.realWeightKg.toLocaleString("fr-FR", {
                  maximumFractionDigits: 1
                })
              })}
            </Text>
          ) : null}
          {projectedFinal != null ? (
            <Text style={styles.line}>
              {t("marketScreen.transaction.projectedFinalCost", {
                amount: money(projectedFinal, cur)
              })}
            </Text>
          ) : null}
          <PrimaryButton
            label={t("marketScreen.transaction.validateWeight")}
            onPress={() => validateMut.mutate()}
            loading={validateMut.isPending}
          />
          <SecondaryButton
            label={t("marketScreen.transaction.sellerDeclareWeightCta")}
            onPress={() => setSellerWeightOpen(true)}
            style={{ marginTop: mobileSpacing.sm }}
          />
        </View>
      ) : null}

      {(isBuyer || isSeller) && tx.status === "WEIGHT_COUNTER_DECLARED" ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("marketScreen.transaction.weightDiffSection")}
          </Text>
          {tx.realWeightKg != null ? (
            <Text style={styles.line}>
              {t("marketScreen.transaction.buyerDeclaredWeight", {
                kg: tx.realWeightKg.toLocaleString("fr-FR", {
                  maximumFractionDigits: 1
                })
              })}
            </Text>
          ) : null}
          {tx.sellerDeclaredWeightKg != null ? (
            <Text style={styles.line}>
              {t("marketScreen.transaction.sellerDeclaredWeightLine", {
                kg: tx.sellerDeclaredWeightKg.toLocaleString("fr-FR", {
                  maximumFractionDigits: 1
                })
              })}
            </Text>
          ) : null}
          {tx.weightDiffKg != null ? (
            <Text style={styles.line}>
              {t("marketScreen.transaction.weightDiffLine", {
                kg: tx.weightDiffKg.toLocaleString("fr-FR", {
                  maximumFractionDigits: 1
                })
              })}
            </Text>
          ) : null}
          {tx.weightArbitrationThresholds ? (
            <Text style={styles.hint}>
              {t("marketScreen.transaction.arbitrationThresholdsHint", {
                min: tx.weightArbitrationThresholds.minDiffKg,
                cumulative: tx.weightArbitrationThresholds.cumulativeMinDiffKg
              })}
            </Text>
          ) : null}
          {hasAction("validate_weight") ? (
            <PrimaryButton
              label={t("marketScreen.transaction.validateWeight")}
              onPress={() => validateMut.mutate()}
              loading={validateMut.isPending}
            />
          ) : null}
          {hasAction("request_weight_arbitration") &&
          tx.canRequestWeightArbitration ? (
            <SecondaryButton
              label={t("marketScreen.transaction.requestArbitration")}
              onPress={() => arbitrationMut.mutate()}
              loading={arbitrationMut.isPending}
              style={{ marginTop: mobileSpacing.sm }}
            />
          ) : (
            <Text style={[styles.hint, { marginTop: mobileSpacing.sm }]}>
              {t("marketScreen.transaction.belowArbitrationThreshold")}
            </Text>
          )}
        </View>
      ) : null}

      {hasAction("cancel") ? (
        <View style={styles.section}>
          <SecondaryButton
            label={t("marketScreen.transaction.cancel")}
            onPress={() => cancelMut.mutate()}
            loading={cancelMut.isPending}
          />
        </View>
      ) : null}

      {tx.status === "TRANSACTION_CLOSED" ? (
        <View style={styles.section}>
          <Text style={styles.success}>
            {t("marketScreen.transaction.closed")}
          </Text>
          {canCompleteTransfer ? (
            <View style={{ marginTop: mobileSpacing.md }}>
              <PrimaryButton
                label={t("marketScreen.transferModal.open")}
                onPress={() => setTransferOpen(true)}
              />
            </View>
          ) : null}
          <TransactionReceiptCard
            transactionId={transactionId}
            accessToken={accessToken!}
            activeProfileId={activeProfileId}
            receiptGenerationStatus={tx.receiptGenerationStatus}
            receipt={tx.receipt}
            onReceiptUpdated={invalidate}
          />
        </View>
      ) : null}

      <DeclareWeightModal
        visible={declareWeightOpen}
        submitting={weightMut.isPending}
        transactionId={transactionId}
        listingId={tx.listingId}
        animalIds={animalIds}
        priceType={tx.priceType}
        onClose={() => setDeclareWeightOpen(false)}
        onConfirm={(payload) => weightMut.mutate(payload)}
      />
      <DeclareSellerWeightModal
        visible={sellerWeightOpen}
        submitting={sellerWeightMut.isPending}
        transactionId={transactionId}
        listingId={tx.listingId}
        buyerWeightKg={tx.realWeightKg}
        weightArbitrationThresholds={tx.weightArbitrationThresholds}
        onClose={() => setSellerWeightOpen(false)}
        onConfirm={(payload) => sellerWeightMut.mutate(payload)}
      />
      <ConfirmShipmentModal
        visible={shipmentOpen}
        submitting={shipmentMut.isPending}
        onClose={() => setShipmentOpen(false)}
        onConfirm={(payload) => shipmentMut.mutate(payload)}
      />
      <ConfirmReceiptModal
        visible={receiptOpen}
        submitting={receiptMut.isPending}
        animalIds={animalIds}
        priceType={tx.priceType}
        currency={cur}
        agreedPricePerKg={agreedPerKg}
        agreedFlatPrice={agreedFlat}
        declaredWeightKg={tx.realWeightKg}
        blockedAmount={tx.blockedAmount}
        onClose={() => setReceiptOpen(false)}
        onConfirm={(payload) => receiptMut.mutate(payload)}
      />
      {pendingTransfer ? (
        <TransferToFarmModal
          visible={transferOpen}
          submitting={transferMut.isPending}
          pendingTransfer={pendingTransfer}
          accessToken={accessToken!}
          activeProfileId={activeProfileId}
          onClose={() => setTransferOpen(false)}
          onConfirm={(payload) => transferMut.mutate(payload)}
        />
      ) : null}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: mobileColors.surfaceMuted },
  content: { padding: mobileSpacing.lg, gap: mobileSpacing.md },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: mobileSpacing.lg
  },
  error: { ...mobileTypography.body, color: mobileColors.error },
  line: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    marginBottom: 4
  },
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm
  },
  waiting: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    lineHeight: 22
  },
  section: { marginTop: mobileSpacing.lg },
  sectionTitle: {
    ...mobileTypography.sectionTitle,
    color: mobileColors.textPrimary,
    marginBottom: mobileSpacing.sm
  },
  label: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: 4,
    marginTop: mobileSpacing.sm
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    ...mobileTypography.body,
    backgroundColor: mobileColors.background
  },
  success: {
    ...mobileTypography.body,
    color: mobileColors.success,
    textAlign: "center"
  },
  feeBreakdown: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.lg,
    marginBottom: mobileSpacing.md,
    gap: mobileSpacing.sm,
    borderWidth: 1.5,
    borderColor: mobileColors.accent
  },
  feeBreakdownTitle: {
    ...mobileTypography.sectionTitle,
    color: mobileColors.accent,
    fontWeight: "700",
    marginBottom: mobileSpacing.xs
  },
  feeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  feeTotalRow: {
    marginTop: mobileSpacing.xs,
    paddingTop: mobileSpacing.xs,
    borderTopWidth: 1,
    borderTopColor: mobileColors.border
  },
  feeLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    flex: 1
  },
  feeValue: {
    ...mobileTypography.meta,
    color: mobileColors.textPrimary,
    fontWeight: "600"
  },
  feeTotalLabel: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontWeight: "700",
    flex: 1
  },
  feeTotalValue: {
    ...mobileTypography.body,
    color: mobileColors.accent,
    fontWeight: "700"
  },
  feeValueAccent: {
    color: mobileColors.accent
  },
  feeBufferNote: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.xs,
    fontStyle: "italic"
  }
});
