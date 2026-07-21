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
import { PlatformFeePreview } from "../components/common/PlatformFeePreview";
import { MobileAppShell } from "../components/layout/MobileAppShell";
import { PrimaryButton } from "../components/ui/PrimaryButton";
import { SecondaryButton } from "../components/ui/SecondaryButton";
import { useSession } from "../context/SessionContext";
import { VetProfileModal } from "../components/sante/VetProfileModal";
import {
  cancelVetAppointment,
  completeVetAppointmentService,
  confirmVetAppointmentPayment,
  fetchUserWallet,
  fetchVetAppointment,
  initiateVetAppointmentPayment,
  producerAcceptAppointment,
  producerRefuseAppointment,
  submitVetAppointmentRating,
  submitVetVisitReport,
  vetAcceptAppointment,
  vetRefuseAppointment
} from "../lib/api";
import { formatApiError } from "../lib/apiErrors";
import { openPaymentCheckout } from "../lib/paymentCheckout";
import {
  computeVetFeeBreakdown,
  parsePriceInput
} from "../lib/platformFees";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileStatusSurfaces, mobileFontSize } from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";
import { useBottomInset } from "../hooks/useBottomInset";
import { producerColors } from "../theme/producerTheme";

type Props = NativeStackScreenProps<RootStackParamList, "VetAppointmentDetail">;

const RATING_TAG_KEYS = [
  "punctual",
  "professional",
  "goodDiagnosis",
  "fairPrice"
] as const;

function money(n: number, currency: string, locale: string): string {
  return `${Math.round(n).toLocaleString(locale)} ${currency}`;
}

function appointmentStatusLabel(
  status: string,
  t: (key: string) => string
): string {
  const key = `vet.appointment.status.${status}`;
  const label = t(key);
  return label === key ? status.replace(/_/g, " ") : label;
}

function reasonLabel(reason: string, t: (key: string) => string): string {
  const key = `vet.schedule.reasons.${reason}`;
  const label = t(key);
  return label === key ? reason : label;
}

function conflictStatusLabel(
  status: string | null | undefined,
  t: (key: string) => string
): string | null {
  if (!status) return null;
  const key = `vet.appointment.conflict.${status}`;
  const label = t(key);
  return label === key ? status.replace(/_/g, " ") : label;
}

function conflictBadgeStyle(status?: string | null) {
  if (status === "CONFLICT_EXACT") {
    return { bg: mobileStatusSurfaces.errorBg, color: producerColors.dangerStrong };
  }
  if (status === "CONFLICT_NEARBY") {
    return { bg: producerColors.kpiAmberSoft, color: producerColors.warningDeep };
  }
  return { bg: mobileStatusSurfaces.successBg, color: producerColors.successDeep };
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
  const { accessToken, activeProfileId, authMe, clientFeatures, platformFees } =
    useSession();
  const qc = useQueryClient();
  const myId = authMe?.user?.id;

  const [servicePrice, setServicePrice] = useState("");
  const [vetNotes, setVetNotes] = useState("");
  const [refusalReason, setRefusalReason] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showRating, setShowRating] = useState(false);
  const [paymentMethod, setPaymentMethod] =
    useState<MarketplacePaymentMethodChoice>("mobile_money");
  const userPickedPaymentMethod = useRef(false);
  const [pendingProviderRef, setPendingProviderRef] = useState<string | null>(null);
  const [vetProfileOpen, setVetProfileOpen] = useState(false);
  const [producerRefusalReason, setProducerRefusalReason] = useState("");
  const [reportSubjects, setReportSubjects] = useState("");
  const [reportDiagnosis, setReportDiagnosis] = useState("");
  const [reportPrescription, setReportPrescription] = useState("");

  const q = useQuery({
    queryKey: ["vetAppointment", appointmentId, activeProfileId],
    queryFn: () => fetchVetAppointment(accessToken!, appointmentId, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["vetAppointment", appointmentId] });
    void qc.invalidateQueries({ queryKey: ["vetAppointments"] });
    void qc.invalidateQueries({ queryKey: ["vetDashboard"] });
    void qc.invalidateQueries({ queryKey: ["farmHealth"] });
    void qc.invalidateQueries({ queryKey: ["user-wallet"] });
  }, [qc, appointmentId]);

  const walletQ = useQuery({
    queryKey: ["user-wallet", "vet-appointment", appointmentId],
    queryFn: () => fetchUserWallet(accessToken!),
    enabled: Boolean(accessToken && clientFeatures.wallet)
  });

  const vetFeeBreakdown = useMemo(() => {
    const parsed = parsePriceInput(servicePrice);
    if (parsed == null) {
      return null;
    }
    return computeVetFeeBreakdown(parsed, platformFees.vetCommissionRate);
  }, [servicePrice, platformFees.vetCommissionRate]);

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
    onSuccess: (result) => {
      invalidate();
      if (result.requiresRating) {
        setShowRating(true);
      }
    },
    onError: (e: Error) => Alert.alert(t("common.error"), formatApiError(e))
  });

  const producerAcceptMut = useMutation({
    mutationFn: () =>
      producerAcceptAppointment(accessToken!, appointmentId, activeProfileId),
    onSuccess: (result) => {
      invalidate();
      if (result.status === "AWAITING_PAYMENT") {
        Alert.alert(
          t("vet.appointment.producerAcceptedPaidTitle"),
          t("vet.appointment.producerAcceptedPaidBody")
        );
      } else {
        Alert.alert(
          t("vet.appointment.producerAcceptedFreeTitle"),
          t("vet.appointment.producerAcceptedFreeBody")
        );
      }
    },
    onError: (e: Error) => Alert.alert(t("common.error"), formatApiError(e))
  });

  const producerRefuseMut = useMutation({
    mutationFn: () => {
      const reason = producerRefusalReason.trim();
      if (!reason) {
        throw new Error(t("vet.appointment.producerRefuseReasonRequired"));
      }
      return producerRefuseAppointment(
        accessToken!,
        appointmentId,
        reason,
        activeProfileId
      );
    },
    onSuccess: () => {
      invalidate();
      navigation.goBack();
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
      cancelVetAppointment(
        accessToken!,
        appointmentId,
        cancellationReason.trim(),
        activeProfileId
      ),
    onSuccess: () => {
      setCancellationReason("");
      invalidate();
      navigation.goBack();
    },
    onError: (e: Error) => Alert.alert(t("common.error"), formatApiError(e))
  });

  const reportMut = useMutation({
    mutationFn: () => {
      if (
        !reportSubjects.trim() ||
        !reportDiagnosis.trim() ||
        !reportPrescription.trim()
      ) {
        throw new Error(t("vet.appointment.reportRequiredFields"));
      }
      return submitVetVisitReport(
        accessToken!,
        appointmentId,
        {
          subjectsTreated: reportSubjects.trim(),
          diagnosis: reportDiagnosis.trim(),
          prescription: reportPrescription.trim()
        },
        activeProfileId
      );
    },
    onSuccess: () => {
      setReportSubjects("");
      setReportDiagnosis("");
      setReportPrescription("");
      invalidate();
      Alert.alert(
        t("vet.appointment.reportSubmitted"),
        t("vet.appointment.reportReadyHint")
      );
    },
    onError: (e: Error) => Alert.alert(t("common.error"), formatApiError(e))
  });

  const appt = q.data;
  const isVet = Boolean(appt && myId === appt.vetUserId);
  const isProducer = Boolean(appt && myId === appt.producerUserId);
  // Annuler seulement après acceptation, ou pour retirer sa propre proposition/demande.
  const canCancel = Boolean(
    appt &&
      (isProducer || isVet) &&
      !appt.cancelledAt &&
      (["APPOINTMENT_CONFIRMED", "AWAITING_PAYMENT"].includes(appt.status) ||
        (isVet && appt.status === "VISIT_PROPOSED") ||
        (isProducer && appt.status === "APPOINTMENT_REQUESTED"))
  );
  const hasVisitReport = Boolean(appt?.visitReportSubmittedAt);
  const canSubmitReport =
    Boolean(appt) &&
    isVet &&
    ["APPOINTMENT_CONFIRMED", "APPOINTMENT_IN_PROGRESS"].includes(
      appt!.status
    ) &&
    !hasVisitReport &&
    !appt!.cancelledAt;
  const isPaidConfirmed = Boolean(
    appt?.paymentConfirmedAt && (appt.blockedAmount ?? 0) > 0
  );
  const isOrphanConfirmed = Boolean(
    appt &&
      appt.status === "APPOINTMENT_CONFIRMED" &&
      !appt.isFree &&
      !isPaidConfirmed &&
      !(typeof appt.servicePrice === "number" && appt.servicePrice > 0)
  );

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
        <Text style={styles.status}>
          {appt.status === "VISIT_PROPOSED" && isVet
            ? t("vet.appointment.awaitingProducerResponse")
            : appointmentStatusLabel(appt.status, t)}
        </Text>

        {appt.cancellationReason ? (
          <View style={styles.card}>
            <Text style={styles.label}>
              {t("vet.appointment.cancellationReasonLabel")}
            </Text>
            <Text style={styles.value}>{appt.cancellationReason}</Text>
            {appt.cancelledAt ? (
              <Text style={styles.meta}>{formatWhen(appt.cancelledAt, locale)}</Text>
            ) : null}
          </View>
        ) : null}

        {appt.refusalReason ? (
          <View style={styles.card} testID="vet-appointment-refusal-reason">
            <Text style={styles.label}>
              {t("vet.appointment.refusalReasonLabel")}
            </Text>
            <Text style={styles.value}>{appt.refusalReason}</Text>
          </View>
        ) : null}

        {isVet && appt.conflictStatus ? (
          <View style={[styles.badge, { backgroundColor: conflictStyle.bg }]}>
            <Text style={[styles.badgeTx, { color: conflictStyle.color }]}>
              {conflictStatusLabel(appt.conflictStatus, t)}
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
          <Text style={styles.value}>{reasonLabel(appt.reason, t)}</Text>

          {appt.notes ? (
            <>
              <Text style={styles.label}>{t("vet.appointment.notes")}</Text>
              <Text style={styles.value}>{appt.notes}</Text>
            </>
          ) : null}

          {isProducer && appt.vetName ? (
            <>
              <Text style={styles.label}>{t("vet.appointment.vet")}</Text>
              <Pressable onPress={() => setVetProfileOpen(true)}>
                <Text style={styles.vetLink}>{appt.vetName} →</Text>
              </Pressable>
            </>
          ) : null}

          {isVet && appt.producerName ? (
            <>
              <Text style={styles.label}>{t("vet.appointment.producer")}</Text>
              <Text style={styles.value}>{appt.producerName}</Text>
            </>
          ) : null}

          {appt.isFree ? (
            <View style={styles.freeBadge}>
              <Text style={styles.freeBadgeTx}>
                {t("vet.appointment.freeBadge")}
              </Text>
            </View>
          ) : appt.servicePrice != null ? (
            <>
              <Text style={styles.label}>{t("vet.appointment.price")}</Text>
              <Text style={styles.price}>
                {money(appt.servicePrice, appt.currency, locale)}
              </Text>
            </>
          ) : null}
        </View>

        {hasVisitReport ? (
          <View style={styles.card} testID="vet-appointment-visit-report">
            <Text style={styles.sectionTitle}>
              {t("vet.appointment.reportTitle")}
            </Text>
            {appt.visitSubjectsTreated ? (
              <>
                <Text style={styles.label}>
                  {t("vet.appointment.reportSubjects")}
                </Text>
                <Text style={styles.value}>{appt.visitSubjectsTreated}</Text>
              </>
            ) : null}
            {appt.visitDiagnosis ? (
              <>
                <Text style={styles.label}>
                  {t("vet.appointment.reportDiagnosis")}
                </Text>
                <Text style={styles.value}>{appt.visitDiagnosis}</Text>
              </>
            ) : null}
            {appt.visitPrescription ? (
              <>
                <Text style={styles.label}>
                  {t("vet.appointment.reportPrescription")}
                </Text>
                <Text style={styles.value}>{appt.visitPrescription}</Text>
              </>
            ) : null}
          </View>
        ) : null}

        {canSubmitReport ? (
          <View style={styles.section} testID="vet-appointment-report-form">
            <Text style={styles.sectionTitle}>
              {t("vet.appointment.reportTitle")}
            </Text>
            <Text style={styles.hint}>{t("vet.appointment.reportHint")}</Text>
            <Text style={styles.label}>
              {t("vet.appointment.reportSubjects")} *
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t("vet.appointment.reportSubjectsPlaceholder")}
              placeholderTextColor={mobileColors.textSecondary}
              multiline
              value={reportSubjects}
              onChangeText={setReportSubjects}
            />
            <Text style={styles.label}>
              {t("vet.appointment.reportDiagnosis")} *
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t("vet.appointment.reportDiagnosisPlaceholder")}
              placeholderTextColor={mobileColors.textSecondary}
              multiline
              value={reportDiagnosis}
              onChangeText={setReportDiagnosis}
            />
            <Text style={styles.label}>
              {t("vet.appointment.reportPrescription")} *
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t("vet.appointment.reportPrescriptionPlaceholder")}
              placeholderTextColor={mobileColors.textSecondary}
              multiline
              value={reportPrescription}
              onChangeText={setReportPrescription}
            />
            <PrimaryButton
              label={t("vet.appointment.reportSubmitCta")}
              onPress={() => reportMut.mutate()}
              loading={reportMut.isPending}
            />
          </View>
        ) : null}

        {isProducer &&
        ["APPOINTMENT_CONFIRMED", "APPOINTMENT_IN_PROGRESS"].includes(
          appt.status
        ) &&
        !hasVisitReport &&
        !isOrphanConfirmed ? (
          <Text style={styles.hint}>
            {t("vet.appointment.reportWaitingProducer")}
          </Text>
        ) : null}

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
            <PlatformFeePreview
              breakdown={vetFeeBreakdown}
              currency={q.data?.currency || "XOF"}
              unitLabelKey="platformFees.unitPerService"
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
          </View>
        ) : null}

        {isProducer && appt.status === "VISIT_PROPOSED" ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("vet.appointment.proposalTitle")}
            </Text>
            <Text style={styles.hint}>{t("vet.appointment.proposalHint")}</Text>
            {appt.isFree ? (
              <View style={styles.freeBadge}>
                <Text style={styles.freeBadgeTx}>
                  {t("vet.appointment.freeBadge")}
                </Text>
              </View>
            ) : (
              <Text style={styles.price}>
                {money(appt.servicePrice ?? 0, appt.currency, locale)}
              </Text>
            )}
            <PrimaryButton
              label={t("vet.appointment.producerAcceptCta")}
              onPress={() => producerAcceptMut.mutate()}
              loading={producerAcceptMut.isPending}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t("vet.appointment.producerRefusePlaceholder")}
              placeholderTextColor={mobileColors.textSecondary}
              multiline
              value={producerRefusalReason}
              onChangeText={setProducerRefusalReason}
            />
            <SecondaryButton
              label={t("vet.appointment.producerRefuseCta")}
              onPress={() => {
                if (!producerRefusalReason.trim()) {
                  Alert.alert(
                    t("common.error"),
                    t("vet.appointment.producerRefuseReasonRequired")
                  );
                  return;
                }
                producerRefuseMut.mutate();
              }}
              loading={producerRefuseMut.isPending}
            />
          </View>
        ) : null}

        {isProducer && appt.status === "AWAITING_PAYMENT" ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("vet.appointment.paymentRecapTitle")}
            </Text>
            <Text style={styles.price}>
              {money(appt.servicePrice ?? payAmount, appt.currency, locale)}
            </Text>
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
                amount: money(appt.servicePrice ?? 0, appt.currency, locale)
              })}
              onPress={() => payMut.mutate()}
              loading={payMut.isPending}
              disabled={paymentMethod === "wallet" && !canPayWithWallet}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t("vet.appointment.producerRefusePlaceholder")}
              placeholderTextColor={mobileColors.textSecondary}
              multiline
              value={producerRefusalReason}
              onChangeText={setProducerRefusalReason}
            />
            <SecondaryButton
              label={t("vet.appointment.refuseAmountCta")}
              onPress={() => {
                if (!producerRefusalReason.trim()) {
                  Alert.alert(
                    t("common.error"),
                    t("vet.appointment.producerRefuseReasonRequired")
                  );
                  return;
                }
                Alert.alert(
                  t("vet.appointment.refuseAmountTitle"),
                  t("vet.appointment.refuseAmountBody"),
                  [
                    { text: t("common.cancel"), style: "cancel" },
                    {
                      text: t("vet.appointment.refuseAmountCta"),
                      style: "destructive",
                      onPress: () => producerRefuseMut.mutate()
                    }
                  ]
                );
              }}
              loading={producerRefuseMut.isPending}
            />
          </View>
        ) : null}

        {isOrphanConfirmed && hasVisitReport ? (
          <View style={styles.section} testID="vet-appointment-orphan-section">
            <Text style={styles.hint}>
              {t("vet.appointment.orphanConfirmedHint")}
            </Text>
            <PrimaryButton
              label={t("vet.appointment.closeOrphanCta")}
              onPress={() => completeMut.mutate()}
              loading={completeMut.isPending}
            />
          </View>
        ) : null}

        {isOrphanConfirmed && !hasVisitReport && isVet ? (
          <Text style={styles.hint}>
            {t("vet.appointment.reportRequiredBeforeConfirm")}
          </Text>
        ) : null}

        {isProducer &&
        appt.status === "APPOINTMENT_CONFIRMED" &&
        !isOrphanConfirmed &&
        hasVisitReport ? (
          <View style={styles.section}>
            <Text style={styles.hint}>
              {appt.isFree
                ? t("vet.appointment.completeFreeHint")
                : t("vet.appointment.reportReadyHint")}
            </Text>
            <PrimaryButton
              label={
                appt.isFree
                  ? t("vet.appointment.completeFreeCta")
                  : t("vet.appointment.completeCta")
              }
              onPress={() =>
                Alert.alert(
                  t("vet.appointment.completeConfirmTitle"),
                  appt.isFree
                    ? t("vet.appointment.completeFreeConfirmBody")
                    : t("vet.appointment.completeConfirmBody"),
                  [
                    { text: t("common.cancel"), style: "cancel" },
                    {
                      text: appt.isFree
                        ? t("vet.appointment.completeFreeCta")
                        : t("vet.appointment.completeCta"),
                      onPress: () => completeMut.mutate()
                    }
                  ]
                )
              }
              loading={completeMut.isPending}
            />
          </View>
        ) : null}

        {isVet &&
        appt.isFree &&
        appt.status === "APPOINTMENT_CONFIRMED" &&
        hasVisitReport ? (
          <View style={styles.section}>
            <Text style={styles.hint}>{t("vet.appointment.completeFreeHint")}</Text>
            <PrimaryButton
              label={t("vet.appointment.completeFreeCta")}
              onPress={() => completeMut.mutate()}
              loading={completeMut.isPending}
            />
          </View>
        ) : null}

        {canCancel ? (
          <View style={styles.section} testID="vet-appointment-cancel-section">
            <Text style={styles.sectionTitle}>
              {t("vet.appointment.cancelSectionTitle")}
            </Text>
            <Text style={styles.hint}>
              {appt.status === "VISIT_PROPOSED"
                ? t("vet.appointment.awaitingProducerResponse")
                : appt.status === "APPOINTMENT_REQUESTED"
                  ? t("vet.appointment.waitingVetHint")
                  : isPaidConfirmed
                    ? t("vet.appointment.cancelHintPaid")
                    : t("vet.appointment.cancelHintUnpaid")}
            </Text>
            <Text style={styles.label}>
              {t("vet.appointment.cancelReasonLabel")}
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t("vet.appointment.cancelReasonPlaceholder")}
              placeholderTextColor={mobileColors.textSecondary}
              multiline
              value={cancellationReason}
              onChangeText={setCancellationReason}
              testID="vet-appointment-cancel-reason"
              accessibilityLabel={t("vet.appointment.cancelReasonLabel")}
            />
            <SecondaryButton
              label={t("vet.appointment.cancelCta")}
              onPress={() => {
                if (!cancellationReason.trim()) {
                  Alert.alert(
                    t("common.error"),
                    t("vet.appointment.cancelReasonRequired")
                  );
                  return;
                }
                Alert.alert(
                  t("vet.appointment.cancelConfirmTitle"),
                  isPaidConfirmed
                    ? t("vet.appointment.cancelConfirmBodyPaid")
                    : t("vet.appointment.cancelConfirmBody"),
                  [
                    { text: t("common.cancel"), style: "cancel" },
                    {
                      text: t("vet.appointment.cancelCta"),
                      style: "destructive",
                      onPress: () => cancelMut.mutate()
                    }
                  ]
                );
              }}
              loading={cancelMut.isPending}
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
              {RATING_TAG_KEYS.map((tagKey) => {
                const on = selectedTags.includes(tagKey);
                return (
                  <Pressable
                    key={tagKey}
                    style={[styles.tag, on && styles.tagOn]}
                    onPress={() =>
                      setSelectedTags((prev) =>
                        on
                          ? prev.filter((x) => x !== tagKey)
                          : [...prev, tagKey]
                      )
                    }
                  >
                    <Text style={[styles.tagTx, on && styles.tagTxOn]}>
                      {t(`vet.appointment.ratingTags.${tagKey}`)}
                    </Text>
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
      <VetProfileModal
        visible={vetProfileOpen}
        vetId={appt.vetProfileId}
        farmId={appt.farmId}
        farmName={appt.farmName ?? "—"}
        accessToken={accessToken!}
        activeProfileId={activeProfileId}
        onClose={() => setVetProfileOpen(false)}
        onPlanVisit={() => setVetProfileOpen(false)}
        onOpenChat={(roomId, headline, peerUserId) => {
          setVetProfileOpen(false);
          navigation.navigate("ChatRoom", {
            roomId,
            headline,
            peerUserId
          });
        }}
      />
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
  badgeTx: { fontSize: mobileFontSize.sm, fontWeight: "700" },
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
  vetLink: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.accent,
    textDecorationLine: "underline"
  },
  freeBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: mobileRadius.sm,
    backgroundColor: mobileStatusSurfaces.successBg
  },
  freeBadgeTx: { fontSize: mobileFontSize.sm, fontWeight: "700", color: producerColors.successDeep },
  section: { gap: mobileSpacing.sm },
  sectionTitle: { ...mobileTypography.title, fontSize: mobileFontSize.lg },
  hint: { ...mobileTypography.body, color: mobileColors.textSecondary, lineHeight: 22 },
  deadline: { ...mobileTypography.meta, fontWeight: "700", color: producerColors.warningDeep },
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
  star: { fontSize: mobileFontSize.xxl, color: mobileColors.border },
  starOn: { color: producerColors.warning },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: mobileRadius.sm,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  tagOn: { backgroundColor: mobileColors.accent, borderColor: mobileColors.accent },
  tagTx: { fontSize: mobileFontSize.sm, color: mobileColors.textSecondary },
  tagTxOn: { color: mobileColors.onAccent, fontWeight: "600" }
});
