import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { AppDatePicker } from "../components/common/AppDatePicker";
import { MarketplaceModuleGate } from "../components/MarketplaceModuleGate";
import {
  formatMarketMoney,
  parseMarketNum
} from "../components/marketplace/MarketplaceListingCard";
import { ConfirmReceiptModal } from "../components/marketplace/ConfirmReceiptModal";
import { ConfirmShipmentModal } from "../components/marketplace/ConfirmShipmentModal";
import { PrimaryButton } from "../components/ui/PrimaryButton";
import { SecondaryButton } from "../components/ui/SecondaryButton";
import { TransactionReceiptCard } from "../components/marketplace/TransactionReceiptCard";
import { useBottomInset } from "../hooks/useBottomInset";
import { useSession } from "../context/SessionContext";
import {
  cancelMarketplaceTransaction,
  confirmMarketplacePayment,
  confirmMarketplaceReceipt,
  confirmMarketplaceShipment,
  declareMarketplaceWeight,
  disputeMarketplaceWeight,
  fetchMarketplaceTransaction,
  initiateMarketplacePayment,
  scheduleMarketplacePickup,
  validateMarketplaceWeight
} from "../lib/api";
import {
  marketplaceActionErrorMessage,
  projectMarketplaceFinalAmount
} from "../lib/marketplaceLabels";
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
    case "PICKUP_SCHEDULED":
      return 1;
    case "SELLER_SHIPPED":
      return 2;
    case "BUYER_RECEIVED":
    case "WEIGHT_DECLARED":
    case "WEIGHT_DISPUTED":
    case "WEIGHT_VALIDATED":
    case "DELIVERY_DISPUTED":
      return 3;
    case "TRANSACTION_CLOSED":
      return 4;
    default:
      return 0;
  }
}

function formatPickupDate(iso: string): string {
  const d = new Date(iso);
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

  const invalidate = () => {
    void qc.invalidateQueries({
      queryKey: ["marketplaceTransaction", transactionId]
    });
    void qc.invalidateQueries({ queryKey: ["marketplaceTransactions"] });
    void qc.invalidateQueries({ queryKey: ["marketplaceTransactionSummary"] });
  };

  const payMut = useMutation({
    mutationFn: async () => {
      const init = await initiateMarketplacePayment(
        accessToken,
        transactionId,
        activeProfileId
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
        t("marketScreen.transaction.pickupSuccessTitle"),
        t("marketScreen.transaction.pickupSuccessBody")
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

  const tx = q.data;
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
    t("marketScreen.transaction.stepShipment"),
    t("marketScreen.transaction.stepReceipt"),
    t("marketScreen.transaction.stepClosing")
  ];
  const animalIds = tx.listingAnimalIds ?? [];
  const canConfirmShipment =
    isSeller &&
    (tx.status === "PAYMENT_HELD" || tx.status === "PICKUP_SCHEDULED");
  const canConfirmReceipt = isBuyer && tx.status === "SELLER_SHIPPED";
  const canDeclareWeight = isBuyer && tx.status === "BUYER_RECEIVED";
  const showPickupForm =
    tx.status === "PAYMENT_HELD" || tx.status === "PICKUP_SCHEDULED";
  const showScheduledPickup =
    Boolean(tx.pickupDate && tx.pickupLocation) &&
    ["PICKUP_SCHEDULED", "SELLER_SHIPPED", "BUYER_RECEIVED", "WEIGHT_DECLARED", "WEIGHT_VALIDATED"].includes(
      tx.status
    );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      keyboardShouldPersistTaps="handled"
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
            {t("marketScreen.transaction.sellerWaitSchedule")}
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
            {t("marketScreen.transaction.buyerWaitSchedule")}
          </Text>
        </View>
      ) : null}

      {tx.status === "WEIGHT_VALIDATED" ? (
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
          <PrimaryButton
            label={t("marketScreen.transaction.payCta", {
              amount: money(tx.blockedAmount, cur)
            })}
            onPress={() => payMut.mutate()}
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
            minDate={new Date()}
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
            label={t("marketScreen.transaction.confirmPickup")}
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
            {t("marketScreen.transaction.weightAtDeliveryHint")}
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
          <TransactionReceiptCard
            transactionId={transactionId}
            accessToken={accessToken!}
            activeProfileId={activeProfileId}
            receiptGenerationStatus={tx.receiptGenerationStatus}
            receipt={tx.receipt}
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
        onClose={() => setReceiptOpen(false)}
        onConfirm={(payload) => receiptMut.mutate(payload)}
      />
    </ScrollView>
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
  }
});
