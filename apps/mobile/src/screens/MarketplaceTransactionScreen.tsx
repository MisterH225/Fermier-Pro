import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
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
import {
  MarketplacePaymentMethodPicker,
  type MarketplacePaymentMethodChoice
} from "../components/buyer/MarketplacePaymentMethodPicker";
import { TransferToFarmModal } from "../components/marketplace/TransferToFarmModal";
import { PrimaryButton } from "../components/ui/PrimaryButton";
import { SecondaryButton } from "../components/ui/SecondaryButton";
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
  disputeMarketplaceWeight,
  fetchMarketplaceTransaction,
  fetchBuyerWallet,
  initiateMarketplacePayment,
  scheduleMarketplacePickup,
  validateMarketplaceWeight
} from "../lib/api";
import {
  marketplaceActionErrorMessage,
  projectMarketplaceFinalAmount
} from "../lib/marketplaceLabels";
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

function stepIndex(status: string): number {
  switch (status) {
    case "PAYMENT_PENDING":
      return 0;
    case "PAYMENT_HELD":
    case "PICKUP_PROPOSED":
      return 1;
    case "PICKUP_SCHEDULED":
    case "WEIGHT_DECLARED":
    case "WEIGHT_DISPUTED":
      return 2;
    case "WEIGHT_VALIDATED":
    case "SELLER_SHIPPED":
    case "DELIVERY_DISPUTED":
      return 3;
    case "BUYER_RECEIVED":
    case "TRANSACTION_CLOSED":
      return 4;
    default:
      return 0;
  }
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
  const [realWeight, setRealWeight] = useState("");
  const [shipmentOpen, setShipmentOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] =
    useState<MarketplacePaymentMethodChoice>("mobile_money");
  const minPickupDate = useMemo(() => startOfDay(new Date()), []);

  const q = useQuery({
    queryKey: ["marketplaceTransaction", transactionId, activeProfileId],
    queryFn: () =>
      fetchMarketplaceTransaction(
        accessToken,
        transactionId,
        activeProfileId
      ),
    enabled: clientFeatures.marketplace && Boolean(accessToken)
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
      const init = await initiateMarketplacePayment(
        accessToken!,
        transactionId,
        activeProfileId,
        paymentMethod
      );
      return confirmMarketplacePayment(
        accessToken,
        transactionId,
        init.providerRef,
        activeProfileId
      );
    },
    onSuccess: () => {
      invalidate();
      Alert.alert(
        t("marketScreen.transaction.paymentSuccessTitle"),
        t("marketScreen.transaction.paymentSuccessBody")
      );
    },
    onError: (e: Error) =>
      Alert.alert(
        t("marketScreen.transaction.paymentErrorTitle"),
        marketplaceActionErrorMessage(e, t)
      )
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
      realWeightKg?: number;
      animalWeights?: { animalId: string; weightKg: number }[];
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
    mutationFn: () => {
      const kg = Number.parseFloat(realWeight.replace(",", "."));
      if (!Number.isFinite(kg) || kg <= 0) {
        throw new Error(t("marketScreen.transaction.invalidWeight"));
      }
      return declareMarketplaceWeight(
        accessToken,
        transactionId,
        kg,
        activeProfileId
      );
    },
    onSuccess: () => {
      invalidate();
      Alert.alert(
        t("marketScreen.transaction.weightDeclaredTitle"),
        t("marketScreen.transaction.weightDeclaredBody")
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

  const disputeMut = useMutation({
    mutationFn: () =>
      disputeMarketplaceWeight(
        accessToken,
        transactionId,
        undefined,
        activeProfileId
      ),
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

  const tx = q.data;
  const walletBalance = walletQ.data?.balance ?? 0;
  const payCurrency = tx?.currency ?? walletQ.data?.currency ?? "XOF";
  const payAmount = tx?.blockedAmount ?? 0;

  // Frais de plateforme : présents uniquement pour les transactions où l'acheteur supporte la commission
  const hasPlatformFee = tx?.buyerPaysCommission === true && (tx?.commissionRate ?? 0) > 0;
  const feeRatePct = hasPlatformFee ? Math.round((tx!.commissionRate ?? 0) * 100) : 0;
  const feeEstimate = hasPlatformFee ? (tx?.platformFeeEstimate ?? 0) : 0;
  const dealPrice = hasPlatformFee
    ? payAmount - feeEstimate
    : payAmount;

  const handlePayPress = () => {
    if (!hasPlatformFee) {
      payMut.mutate();
      return;
    }
    Alert.alert(
      t("marketScreen.transaction.feeConsentTitle"),
      t("marketScreen.transaction.feeConsentBody", {
        dealAmount: money(dealPrice, payCurrency),
        pct: feeRatePct,
        feeAmount: money(feeEstimate, payCurrency),
        totalAmount: money(payAmount, payCurrency)
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
    if (walletBalance >= payAmount && payAmount > 0) {
      setPaymentMethod("wallet");
    }
  }, [walletBalance, payAmount]);

  const draftKg = useMemo(() => {
    const kg = Number.parseFloat(realWeight.replace(",", "."));
    return Number.isFinite(kg) && kg > 0 ? kg : null;
  }, [realWeight]);

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
  const cur = tx.currency || "XOF";
  const estKg = parseMarketNum(tx.estimatedWeightKg);
  const agreedPerKg = parseMarketNum(tx.agreedPricePerKg);
  const agreedFlat = parseMarketNum(tx.agreedFlatPrice);
  const currentStep = stepIndex(tx.status);
  const statusLabel = t(`marketScreen.transaction.status.${tx.status}`, {
    defaultValue: tx.status
  });
  const projectedFinal =
    tx.finalAmount ??
    projectMarketplaceFinalAmount({
      priceType: tx.priceType,
      agreedPricePerKg: agreedPerKg,
      agreedFlatPrice: agreedFlat,
      realWeightKg: tx.realWeightKg,
      draftWeightKg: draftKg
    });
  const stepLabels = [
    t("marketScreen.transaction.stepPayment"),
    t("marketScreen.transaction.stepPickup"),
    t("marketScreen.transaction.stepWeight"),
    t("marketScreen.transaction.stepHandover"),
    t("marketScreen.transaction.stepClosing")
  ];
  const animalIds = tx.listingAnimalIds ?? [];
  const canConfirmPickup = isSeller && tx.status === "PICKUP_PROPOSED";
  const canConfirmShipment = isSeller && tx.status === "WEIGHT_VALIDATED";
  const canConfirmReceipt = isBuyer && tx.status === "SELLER_SHIPPED";
  const canDeclareWeight =
    isBuyer && tx.status === "PICKUP_SCHEDULED";
  const pendingTransfer = tx.pendingTransfer;
  const canCompleteTransfer =
    isBuyer &&
    tx.status === "TRANSACTION_CLOSED" &&
    pendingTransfer != null &&
    pendingTransfer.completedAt == null &&
    pendingTransfer.cancelledAt == null;
  const showPickupForm = isBuyer && tx.status === "PAYMENT_HELD";
  const showScheduledPickup =
    Boolean(tx.pickupDate && tx.pickupLocation) &&
    [
      "PICKUP_PROPOSED",
      "PICKUP_SCHEDULED",
      "WEIGHT_DECLARED",
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
      <View style={styles.card}>
        <Text style={styles.title}>{tx.listingTitle ?? "Annonce"}</Text>
        <Text style={styles.status}>{statusLabel}</Text>

        <View style={styles.stepper}>
          {stepLabels.map((label, idx) => {
            const done = currentStep > idx;
            const active = currentStep === idx || (idx === 3 && currentStep === 3);
            return (
              <View key={label} style={styles.stepRow}>
                <View
                  style={[
                    styles.stepDot,
                    done && styles.stepDotDone,
                    active && styles.stepDotActive
                  ]}
                />
                <Text
                  style={[
                    styles.stepLabel,
                    (done || active) && styles.stepLabelActive
                  ]}
                >
                  {label}
                </Text>
              </View>
            );
          })}
        </View>

        {agreedFlat != null ? (
          <Text style={styles.line}>
            {t("marketScreen.transaction.agreedPrice")}{" "}
            {money(agreedFlat, cur)}
          </Text>
        ) : agreedPerKg != null ? (
          <Text style={styles.line}>
            {t("marketScreen.transaction.agreedPricePerKg")}{" "}
            {money(agreedPerKg, cur)}/kg
          </Text>
        ) : null}
        {estKg != null ? (
          <Text style={styles.line}>
            {t("marketScreen.totalWeight")}{" "}
            {estKg.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg
            {tx.realWeightKg != null
              ? ` → ${tx.realWeightKg.toLocaleString("fr-FR", {
                  maximumFractionDigits: 1
                })} kg (${t("marketScreen.transaction.realWeight").toLowerCase()})`
              : ""}
          </Text>
        ) : null}
        <Text style={styles.amount}>
          {tx.status === "TRANSACTION_CLOSED" && tx.finalAmount != null
            ? money(tx.finalAmount, cur)
            : money(tx.blockedAmount, cur)}
        </Text>
        {tx.status === "TRANSACTION_CLOSED" && tx.finalAmount != null ? (
          <Text style={styles.hint}>
            {t("marketScreen.transaction.finalCost", {
              amount: money(tx.finalAmount, cur)
            })}
          </Text>
        ) : (
          <Text style={styles.hint}>
            {t("marketScreen.transaction.amountAdjustHint")}
          </Text>
        )}
        {projectedFinal != null &&
        tx.status !== "TRANSACTION_CLOSED" &&
        tx.priceType !== "flat" ? (
          <Text style={styles.projected}>
            {t("marketScreen.transaction.projectedFinalCost", {
              amount: money(projectedFinal, cur)
            })}
          </Text>
        ) : null}
      </View>

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

      {isSeller && tx.status === "PAYMENT_PENDING" ? (
        <View style={styles.section}>
          <Text style={styles.waiting}>
            {t("marketScreen.transaction.sellerWaitPayment")}
          </Text>
        </View>
      ) : null}

      {isSeller && tx.status === "PAYMENT_HELD" ? (
        <View style={styles.section}>
          <Text style={styles.waiting}>
            {t("marketScreen.transaction.sellerWaitBuyerPickup")}
          </Text>
        </View>
      ) : null}

      {isSeller && tx.status === "PICKUP_PROPOSED" ? (
        <View style={styles.section}>
          <Text style={styles.waiting}>
            {t("marketScreen.transaction.sellerConfirmPickup")}
          </Text>
        </View>
      ) : null}

      {isBuyer && tx.status === "PICKUP_PROPOSED" ? (
        <View style={styles.section}>
          <Text style={styles.waiting}>
            {t("marketScreen.transaction.buyerWaitPickupConfirm")}
          </Text>
        </View>
      ) : null}

      {isSeller && tx.status === "PICKUP_SCHEDULED" ? (
        <View style={styles.section}>
          <Text style={styles.waiting}>
            {t("marketScreen.transaction.sellerWaitWeight")}
          </Text>
        </View>
      ) : null}

      {isBuyer && tx.status === "PICKUP_SCHEDULED" ? (
        <View style={styles.section}>
          <Text style={styles.waiting}>
            {t("marketScreen.transaction.buyerDeclareWeight")}
          </Text>
        </View>
      ) : null}

      {isSeller && tx.status === "WEIGHT_VALIDATED" ? (
        <View style={styles.section}>
          <Text style={styles.waiting}>
            {t("marketScreen.transaction.sellerConfirmHandover")}
          </Text>
        </View>
      ) : null}

      {isBuyer && tx.status === "WEIGHT_VALIDATED" ? (
        <View style={styles.section}>
          <Text style={styles.waiting}>
            {t("marketScreen.transaction.buyerWaitHandover")}
          </Text>
        </View>
      ) : null}

      {isSeller && tx.status === "SELLER_SHIPPED" ? (
        <View style={styles.section}>
          <Text style={styles.waiting}>
            {t("marketScreen.transaction.sellerWaitReceipt")}
          </Text>
        </View>
      ) : null}

      {isBuyer && tx.status === "SELLER_SHIPPED" ? (
        <View style={styles.section}>
          <Text style={styles.waiting}>
            {t("marketScreen.transaction.buyerWaitReceipt")}
          </Text>
        </View>
      ) : null}

      {isBuyer && tx.status === "PAYMENT_HELD" ? (
        <View style={styles.section}>
          <Text style={styles.waiting}>
            {t("marketScreen.transaction.buyerProposePickup")}
          </Text>
        </View>
      ) : null}

      {tx.status === "BUYER_RECEIVED" ? (
        <View style={styles.section}>
          <Text style={styles.waiting}>
            {t("marketScreen.transaction.finalizing")}
          </Text>
        </View>
      ) : null}

      {tx.status === "WEIGHT_DISPUTED" ? (
        <View style={styles.section}>
          <Text style={styles.waiting}>
            {t("marketScreen.transaction.weightDisputed")}
          </Text>
        </View>
      ) : null}

      {tx.status === "DELIVERY_DISPUTED" ? (
        <View style={styles.section}>
          <Text style={styles.waiting}>
            {t("marketScreen.transaction.deliveryDisputed")}
          </Text>
        </View>
      ) : null}

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

      {isBuyer && tx.status === "PAYMENT_PENDING" ? (
        <View style={styles.section}>
          {hasPlatformFee ? (
            <View style={styles.feeBreakdown}>
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>
                  {t("marketScreen.transaction.dealPriceLabel")}
                </Text>
                <Text style={styles.feeValue}>
                  {money(dealPrice, cur)}
                </Text>
              </View>
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>
                  {tx.priceType === "flat"
                    ? t("marketScreen.transaction.platformFeeLabel", { pct: feeRatePct })
                    : t("marketScreen.transaction.platformFeeEstimatedLabel", { pct: feeRatePct })}
                </Text>
                <Text style={styles.feeValue}>
                  {money(feeEstimate, cur)}
                </Text>
              </View>
              <View style={[styles.feeRow, styles.feeTotalRow]}>
                <Text style={styles.feeTotalLabel}>
                  {t("marketScreen.transaction.totalPaymentLabel")}
                </Text>
                <Text style={styles.feeTotalValue}>
                  {money(tx.blockedAmount, cur)}
                </Text>
              </View>
            </View>
          ) : null}
          <MarketplacePaymentMethodPicker
            amount={payAmount}
            currency={payCurrency}
            walletBalance={walletBalance}
            value={paymentMethod}
            onChange={setPaymentMethod}
          />
          <PrimaryButton
            label={t("marketScreen.transaction.payCta", {
              amount: money(tx.blockedAmount, cur)
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
              : t("marketScreen.transaction.weightAtDeliveryHint")}
          </Text>
          <Text style={styles.label}>
            {t("marketScreen.transaction.realWeight")}
          </Text>
          <TextInput
            style={styles.input}
            value={realWeight}
            onChangeText={setRealWeight}
            keyboardType="decimal-pad"
            placeholder="0,0"
          />
          <PrimaryButton
            label={t("marketScreen.transaction.declareWeight")}
            onPress={() => weightMut.mutate()}
            loading={weightMut.isPending}
            disabled={!realWeight.trim()}
          />
        </View>
      ) : null}

      {isSeller && tx.status === "WEIGHT_DECLARED" ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("marketScreen.transaction.sellerWeightReview")}
          </Text>
          {tx.realWeightKg != null ? (
            <Text style={styles.line}>
              {tx.realWeightKg.toLocaleString("fr-FR", {
                maximumFractionDigits: 1
              })}{" "}
              kg
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
            label={t("marketScreen.transaction.disputeWeight")}
            onPress={() => disputeMut.mutate()}
            loading={disputeMut.isPending}
            style={{ marginTop: mobileSpacing.sm }}
          />
        </View>
      ) : null}

      {(isBuyer || isSeller) &&
      [
        "PAYMENT_HELD",
        "PICKUP_SCHEDULED",
        "PAYMENT_PENDING",
        "SELLER_SHIPPED"
      ].includes(tx.status) ? (
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
        estimatedWeightKg={estKg}
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
  content: { padding: mobileSpacing.lg },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: mobileSpacing.lg
  },
  error: { ...mobileTypography.body, color: mobileColors.error },
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.lg
  },
  title: { ...mobileTypography.cardTitle, color: mobileColors.textPrimary },
  status: {
    ...mobileTypography.body,
    color: mobileColors.accent,
    marginTop: 4,
    marginBottom: mobileSpacing.md,
    fontWeight: "600"
  },
  stepper: {
    marginBottom: mobileSpacing.md,
    gap: mobileSpacing.xs
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: mobileColors.border
  },
  stepDotDone: {
    backgroundColor: mobileColors.success
  },
  stepDotActive: {
    backgroundColor: mobileColors.accent
  },
  stepLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  stepLabelActive: {
    color: mobileColors.textPrimary
  },
  line: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    marginBottom: 4
  },
  amount: {
    ...mobileTypography.title,
    color: mobileColors.accent,
    marginTop: mobileSpacing.sm
  },
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm
  },
  projected: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    marginTop: mobileSpacing.sm,
    fontWeight: "600"
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
    backgroundColor: "rgba(46, 125, 50, 0.06)",
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.md,
    gap: mobileSpacing.xs
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
  }
});
