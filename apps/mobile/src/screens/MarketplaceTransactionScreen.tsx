import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { PrimaryButton } from "../components/ui/PrimaryButton";
import { SecondaryButton } from "../components/ui/SecondaryButton";
import { useBottomInset } from "../hooks/useBottomInset";
import { useSession } from "../context/SessionContext";
import {
  cancelMarketplaceTransaction,
  confirmMarketplacePayment,
  declareMarketplaceWeight,
  disputeMarketplaceWeight,
  fetchMarketplaceTransaction,
  initiateMarketplacePayment,
  scheduleMarketplacePickup,
  validateMarketplaceWeight
} from "../lib/api";
import { marketplaceActionErrorMessage } from "../lib/marketplaceLabels";
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

  const tx = q.data;
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

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <Text style={styles.title}>{tx.listingTitle ?? "Annonce"}</Text>
        <Text style={styles.status}>{tx.status}</Text>
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
          </Text>
        ) : null}
        <Text style={styles.amount}>
          {money(tx.blockedAmount, cur)}
        </Text>
        <Text style={styles.hint}>
          {t("marketScreen.transaction.amountAdjustHint")}
        </Text>
      </View>

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

      {tx.status === "PAYMENT_HELD" ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("marketScreen.transaction.pickupSection")}
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

      {isBuyer && tx.status === "PICKUP_SCHEDULED" ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("marketScreen.transaction.weightSection")}
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
      ["PAYMENT_HELD", "PICKUP_SCHEDULED", "PAYMENT_PENDING"].includes(
        tx.status
      ) ? (
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
        </View>
      ) : null}
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
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 4,
    marginBottom: mobileSpacing.md
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
