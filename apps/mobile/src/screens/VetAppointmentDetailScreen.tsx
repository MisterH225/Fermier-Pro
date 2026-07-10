import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
  MarketplacePaymentMethodPicker,
  type MarketplacePaymentMethodChoice
} from "../components/buyer/MarketplacePaymentMethodPicker";
import { MobileAppShell } from "../components/layout/MobileAppShell";
import { PrimaryButton } from "../components/ui/PrimaryButton";
import { SecondaryButton } from "../components/ui/SecondaryButton";
import { useSession } from "../context/SessionContext";
import {
  cancelVetAppointment,
  completeVetAppointmentService,
  confirmVetAppointmentPayment,
  fetchUserWallet,
  fetchVetAppointment,
  initiateVetAppointmentPayment,
  submitVetAppointmentRating,
  vetAcceptAppointment,
  vetRefuseAppointment
} from "../lib/api";
import { formatApiError } from "../lib/apiErrors";
import { openPaymentCheckout } from "../lib/paymentCheckout";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";
import { useBottomInset } from "../hooks/useBottomInset";

type Props = NativeStackScreenProps<RootStackParamList, "VetAppointmentDetail">;

const RATING_TAGS = [
  "Ponctuel",
  "Professionnel",
  "Bon diagnostic",
  "Prix raisonnable"
] as const;

function money(n: number, currency: string): string {
  return `${Math.round(n).toLocaleString("fr-FR")} ${currency}`;
}

function conflictBadgeStyle(status?: string | null) {
  if (status === "CONFLICT_EXACT") {
    return { bg: "#FEE2E2", color: "#B91C1C" };
  }
  if (status === "CONFLICT_NEARBY") {
    return { bg: "#FEF3C7", color: "#B45309" };
  }
  return { bg: "#DCFCE7", color: "#15803D" };
}

function formatWhen(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function deadlineLabel(deadline: string | null | undefined): string | null {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / (60 * 60 * 1000));
  const m = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  return `${h}h ${m}min`;
}

export function VetAppointmentDetailScreen({ route, navigation }: Props) {
  const bottomInset = useBottomInset();
  const { appointmentId } = route.params;
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";
  const { accessToken, activeProfileId, authMe, clientFeatures } = useSession();
  const qc = useQueryClient();
  const myId = authMe?.user?.id;

  const [servicePrice, setServicePrice] = useState("");
  const [vetNotes, setVetNotes] = useState("");
  const [refusalReason, setRefusalReason] = useState("");
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showRating, setShowRating] = useState(false);
  const [paymentMethod, setPaymentMethod] =
    useState<MarketplacePaymentMethodChoice>("mobile_money");
  const userPickedPaymentMethod = useRef(false);
  const [pendingProviderRef, setPendingProviderRef] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["vetAppointment", appointmentId, activeProfileId],
    queryFn: () => fetchVetAppointment(accessToken!, appointmentId, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["vetAppointment", appointmentId] });
    void qc.invalidateQueries({ queryKey: ["vetAppointments"] });
    void qc.invalidateQueries({ queryKey: ["vetDashboard"] });
    void qc.invalidateQueries({ queryKey: ["user-wallet"] });
  }, [qc, appointmentId]);

  const walletQ = useQuery({
    queryKey: ["user-wallet", "vet-appointment", appointmentId],
    queryFn: () => fetchUserWallet(accessToken!),
    enabled: Boolean(accessToken && clientFeatures.wallet)
  });

  const payAmount = useMemo(() => {
    const appt = q.data;
    if (!appt) return 0;
    const blocked = appt.blockedAmount;
    if (blocked != null && Number.isFinite(Number(blocked))) {
      return Math.round(Number(blocked));
    }
    return Math.round(Number(appt.servicePrice ?? 0));
  }, [q.data]);

  const walletBalance = Number(walletQ.data?.balance ?? 0);
  const walletEnabled = clientFeatures.wallet;
  const canPayWithWallet = walletEnabled && walletBalance >= payAmount;

  useEffect(() => {
    if (userPickedPaymentMethod.current) {
      return;
    }
    setPaymentMethod("mobile_money");
  }, [payAmount]);

  useEffect(() => {
    if (paymentMethod === "wallet" && !canPayWithWallet) {
      setPaymentMethod("mobile_money");
    }
  }, [paymentMethod, canPayWithWallet]);

  const tryConfirmPendingPayment = useCallback(async () => {
    if (!accessToken || !pendingProviderRef) {
      return;
    }
    try {
      const updated = await confirmVetAppointmentPayment(
        accessToken,
        appointmentId,
        pendingProviderRef,
        activeProfileId
      );
      if (updated.status === "APPOINTMENT_CONFIRMED") {
        setPendingProviderRef(null);
        invalidate();
        Alert.alert(
          t("vet.appointment.paymentSuccessTitle"),
          t("vet.appointment.paymentSuccessBody")
        );
      }
    } catch {
      // Webhook ou prochain essai confirmera le RDV.
    }
  }, [
    accessToken,
    pendingProviderRef,
    appointmentId,
    activeProfileId,
    invalidate,
    t
  ]);

  useEffect(() => {
    if (!pendingProviderRef) {
      return;
    }
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void tryConfirmPendingPayment();
      }
    });
    return () => sub.remove();
  }, [pendingProviderRef, tryConfirmPendingPayment]);

  useEffect(() => {
    if (!pendingProviderRef) {
      return;
    }
    const timer = setInterval(() => {
      void tryConfirmPendingPayment();
    }, 5_000);
    return () => clearInterval(timer);
  }, [pendingProviderRef, tryConfirmPendingPayment]);

  const acceptMut = useMutation({
    mutationFn: () => {
      const price = Number.parseFloat(servicePrice.replace(/\s/g, ""));
      if (!Number.isFinite(price) || price <= 0) {
        throw new Error(t("vet.appointment.invalidPrice"));
      }
      return vetAcceptAppointment(
        accessToken!,
        appointmentId,
        { servicePrice: price, notes: vetNotes.trim() || undefined },
        activeProfileId
      );
    },
    onSuccess: () => {
      invalidate();
      Alert.alert(t("vet.appointment.acceptedTitle"), t("vet.appointment.acceptedBody"));
    },
    onError: (e: Error) => Alert.alert(t("common.error"), formatApiError(e))
  });

  const refuseMut = useMutation({
    mutationFn: () =>
      vetRefuseAppointment(
        accessToken!,
        appointmentId,
        refusalReason.trim() || undefined,
        activeProfileId
      ),
    onSuccess: () => {
      invalidate();
      navigation.goBack();
    },
    onError: (e: Error) => Alert.alert(t("common.error"), formatApiError(e))
  });

  const payMut = useMutation({
    mutationFn: async () => {
      if (paymentMethod === "wallet" && !canPayWithWallet) {
        throw new Error(t("buyer.wallet.topUp.insufficientBalance"));
      }
      const init = await initiateVetAppointmentPayment(
        accessToken!,
        appointmentId,
        activeProfileId,
        paymentMethod
      );
      if (paymentMethod === "mobile_money") {
        setPendingProviderRef(init.providerRef);
        const checkoutUrl = init.paymentUrl?.trim();
        if (!checkoutUrl) {
          throw new Error("VET_CHECKOUT_URL_MISSING");
        }
        await openPaymentCheckout(checkoutUrl);
        return null;
      }
      return confirmVetAppointmentPayment(
        accessToken!,
        appointmentId,
        init.providerRef,
        activeProfileId
      );
    },
    onSuccess: (result) => {
      if (!result) {
        Alert.alert(
          t("marketScreen.transaction.paymentPendingTitle"),
          t("marketScreen.transaction.paymentPendingBody")
        );
        return;
      }
      setPendingProviderRef(null);
      invalidate();
      Alert.alert(
        t("vet.appointment.paymentSuccessTitle"),
        t("vet.appointment.paymentSuccessBody")
      );
    },
    onError: (e: Error) => {
      if (e.message === "VET_CHECKOUT_URL_MISSING") {
        Alert.alert(
          t("common.error"),
          t("merchant.purchase.paymentLinkMissing")
        );
        return;
      }
      Alert.alert(t("common.error"), formatApiError(e));
    }
  });

  const completeMut = useMutation({
    mutationFn: () =>
      completeVetAppointmentService(accessToken!, appointmentId, activeProfileId),
    onSuccess: () => {
      invalidate();
      setShowRating(true);
    },
    onError: (e: Error) => Alert.alert(t("common.error"), formatApiError(e))
  });

  const ratingMut = useMutation({
    mutationFn: () => {
      if (rating < 1 || rating > 5) {
        throw new Error(t("vet.appointment.ratingRequired"));
      }
      return submitVetAppointmentRating(
        accessToken!,
        appointmentId,
        {
          rating,
          comment: ratingComment.trim() || undefined,
          tags: selectedTags.length ? selectedTags : undefined
        },
        activeProfileId
      );
    },
    onSuccess: () => {
      invalidate();
      navigation.goBack();
    },
    onError: (e: Error) => Alert.alert(t("common.error"), formatApiError(e))
  });

  const cancelMut = useMutation({
    mutationFn: () =>
      cancelVetAppointment(accessToken!, appointmentId, undefined, activeProfileId),
    onSuccess: () => {
      invalidate();
      navigation.goBack();
    },
    onError: (e: Error) => Alert.alert(t("common.error"), formatApiError(e))
  });

  const appt = q.data;
  const isVet = Boolean(appt && myId === appt.vetUserId);
  const isProducer = Boolean(appt && myId === appt.producerUserId);

  const whenLabel = useMemo(
    () => formatWhen(appt?.confirmedAt ?? appt?.requestedAt, locale),
    [appt?.confirmedAt, appt?.requestedAt, locale]
  );

  const deadline = useMemo(
    () => deadlineLabel(appt?.paymentDeadline),
    [appt?.paymentDeadline]
  );

  if (q.isPending || !appt) {
    return (
      <MobileAppShell title={t("vet.appointment.title")}>
        <ActivityIndicator color={mobileColors.accent} style={{ marginTop: 32 }} />
      </MobileAppShell>
    );
  }

  const conflictStyle = conflictBadgeStyle(appt.conflictStatus);
  const needsRating =
    showRating ||
    (isProducer && appt.status === "APPOINTMENT_COMPLETED" && !appt.rating);

  return (
    <MobileAppShell title={t("vet.appointment.title")}>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingBottom: bottomInset }]}>
        <Text style={styles.status}>{appt.status.replace(/_/g, " ")}</Text>

        {isVet && appt.conflictStatus ? (
          <View style={[styles.badge, { backgroundColor: conflictStyle.bg }]}>
            <Text style={[styles.badgeTx, { color: conflictStyle.color }]}>
              {appt.conflictLabel ?? appt.conflictStatus}
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.label}>{t("vet.appointment.farm")}</Text>
          <Text style={styles.value}>{appt.farmName ?? "—"}</Text>
          {appt.farmLocation ? (
            <Text style={styles.meta}>📍 {appt.farmLocation}</Text>
          ) : null}

          <Text style={styles.label}>{t("vet.appointment.when")}</Text>
          <Text style={styles.value}>{whenLabel}</Text>

          <Text style={styles.label}>{t("vet.appointment.reason")}</Text>
          <Text style={styles.value}>{appt.reason}</Text>

          {appt.notes ? (
            <>
              <Text style={styles.label}>{t("vet.appointment.notes")}</Text>
              <Text style={styles.value}>{appt.notes}</Text>
            </>
          ) : null}

          {isProducer && appt.vetName ? (
            <>
              <Text style={styles.label}>{t("vet.appointment.vet")}</Text>
              <Text style={styles.value}>{appt.vetName}</Text>
            </>
          ) : null}

          {isVet && appt.producerName ? (
            <>
              <Text style={styles.label}>{t("vet.appointment.producer")}</Text>
              <Text style={styles.value}>{appt.producerName}</Text>
            </>
          ) : null}

          {appt.servicePrice != null ? (
            <>
              <Text style={styles.label}>{t("vet.appointment.price")}</Text>
              <Text style={styles.price}>
                {money(appt.servicePrice, appt.currency)}
              </Text>
            </>
          ) : null}
        </View>

        {isVet && appt.status === "APPOINTMENT_REQUESTED" ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("vet.appointment.vetAcceptTitle")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("vet.appointment.pricePlaceholder")}
              placeholderTextColor={mobileColors.textSecondary}
              keyboardType="numeric"
              value={servicePrice}
              onChangeText={setServicePrice}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t("vet.appointment.vetNotesPlaceholder")}
              placeholderTextColor={mobileColors.textSecondary}
              multiline
              value={vetNotes}
              onChangeText={setVetNotes}
            />
            <PrimaryButton
              label={t("vet.appointment.acceptCta")}
              onPress={() => acceptMut.mutate()}
              loading={acceptMut.isPending}
            />
            <TextInput
              style={[styles.input, styles.textArea, { marginTop: mobileSpacing.md }]}
              placeholder={t("vet.appointment.refusalPlaceholder")}
              placeholderTextColor={mobileColors.textSecondary}
              multiline
              value={refusalReason}
              onChangeText={setRefusalReason}
            />
            <SecondaryButton
              label={t("vet.appointment.refuseCta")}
              onPress={() => refuseMut.mutate()}
              loading={refuseMut.isPending}
            />
          </View>
        ) : null}

        {isProducer && appt.status === "APPOINTMENT_REQUESTED" ? (
          <View style={styles.section}>
            <Text style={styles.hint}>{t("vet.appointment.waitingVetHint")}</Text>
            <SecondaryButton
              label={t("vet.appointment.cancelCta")}
              onPress={() =>
                Alert.alert(
                  t("vet.appointment.cancelConfirmTitle"),
                  t("vet.appointment.cancelConfirmBody"),
                  [
                    { text: t("common.cancel"), style: "cancel" },
                    { text: t("vet.appointment.cancelCta"), onPress: () => cancelMut.mutate() }
                  ]
                )
              }
              loading={cancelMut.isPending}
            />
          </View>
        ) : null}

        {isProducer && appt.status === "AWAITING_PAYMENT" ? (
          <View style={styles.section}>
            <Text style={styles.hint}>{t("vet.appointment.paymentHint")}</Text>
            {deadline ? (
              <Text style={styles.deadline}>
                {t("vet.appointment.paymentDeadline", { time: deadline })}
              </Text>
            ) : null}
            <MarketplacePaymentMethodPicker
              amount={payAmount}
              currency={appt.currency}
              walletBalance={walletBalance}
              value={paymentMethod}
              onChange={(method) => {
                userPickedPaymentMethod.current = true;
                setPaymentMethod(method);
              }}
              walletEnabled={walletEnabled}
            />
            <PrimaryButton
              label={t("vet.appointment.payCta", {
                amount: money(appt.servicePrice ?? 0, appt.currency)
              })}
              onPress={() => payMut.mutate()}
              loading={payMut.isPending}
              disabled={paymentMethod === "wallet" && !canPayWithWallet}
            />
            <SecondaryButton
              label={t("vet.appointment.cancelCta")}
              onPress={() =>
                Alert.alert(
                  t("vet.appointment.cancelConfirmTitle"),
                  t("vet.appointment.cancelConfirmBody"),
                  [
                    { text: t("common.cancel"), style: "cancel" },
                    { text: t("vet.appointment.cancelCta"), onPress: () => cancelMut.mutate() }
                  ]
                )
              }
            />
          </View>
        ) : null}

        {isProducer && appt.status === "APPOINTMENT_CONFIRMED" ? (
          <View style={styles.section}>
            <Text style={styles.hint}>{t("vet.appointment.completeHint")}</Text>
            <PrimaryButton
              label={t("vet.appointment.completeCta")}
              onPress={() =>
                Alert.alert(
                  t("vet.appointment.completeConfirmTitle"),
                  t("vet.appointment.completeConfirmBody"),
                  [
                    { text: t("common.cancel"), style: "cancel" },
                    { text: t("vet.appointment.completeCta"), onPress: () => completeMut.mutate() }
                  ]
                )
              }
              loading={completeMut.isPending}
            />
          </View>
        ) : null}

        {needsRating ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("vet.appointment.ratingTitle")}</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setRating(n)} accessibilityRole="button">
                  <Text style={[styles.star, rating >= n && styles.starOn]}>
                    {rating >= n ? "★" : "☆"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.tags}>
              {RATING_TAGS.map((tag) => {
                const on = selectedTags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    style={[styles.tag, on && styles.tagOn]}
                    onPress={() =>
                      setSelectedTags((prev) =>
                        on ? prev.filter((x) => x !== tag) : [...prev, tag]
                      )
                    }
                  >
                    <Text style={[styles.tagTx, on && styles.tagTxOn]}>{tag}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t("vet.appointment.ratingCommentPlaceholder")}
              placeholderTextColor={mobileColors.textSecondary}
              multiline
              value={ratingComment}
              onChangeText={setRatingComment}
            />
            <PrimaryButton
              label={t("vet.appointment.ratingSubmit")}
              onPress={() => ratingMut.mutate()}
              loading={ratingMut.isPending}
            />
          </View>
        ) : null}

        {appt.status === "APPOINTMENT_RATED" || appt.status === "APPOINTMENT_COMPLETED" && appt.rating ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t("vet.appointment.rated")}</Text>
            <Text style={styles.value}>
              {"★".repeat(appt.rating?.rating ?? 0)} ({appt.rating?.rating}/5)
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </MobileAppShell>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: mobileSpacing.lg, gap: mobileSpacing.md },
  status: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: mobileColors.accent,
    textTransform: "uppercase"
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: mobileRadius.sm
  },
  badgeTx: { fontSize: 13, fontWeight: "700" },
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.lg,
    gap: 4
  },
  label: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 8
  },
  value: { ...mobileTypography.body, fontWeight: "600" },
  meta: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  price: { ...mobileTypography.title, color: mobileColors.accent },
  section: { gap: mobileSpacing.sm },
  sectionTitle: { ...mobileTypography.title, fontSize: 17 },
  hint: { ...mobileTypography.body, color: mobileColors.textSecondary, lineHeight: 22 },
  deadline: { ...mobileTypography.meta, fontWeight: "700", color: "#B45309" },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.sm,
    padding: mobileSpacing.md,
    ...mobileTypography.body,
    backgroundColor: mobileColors.background
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  stars: { flexDirection: "row", gap: 8 },
  star: { fontSize: 32, color: mobileColors.border },
  starOn: { color: "#F59E0B" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: mobileRadius.sm,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  tagOn: { backgroundColor: mobileColors.accent, borderColor: mobileColors.accent },
  tagTx: { fontSize: 13, color: mobileColors.textSecondary },
  tagTxOn: { color: mobileColors.onAccent, fontWeight: "600" }
});
