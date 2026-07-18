import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { PlatformFeePreview } from "../common/PlatformFeePreview";
import { BaseModal } from "../modals/BaseModal";
import { useModal } from "../modals/useModal";
import { useSession } from "../../context/SessionContext";
import {
  fetchFarms,
  scheduleVetVisit,
  type VetVisitReason
} from "../../lib/api";
import { combineDayAndSlot } from "../../lib/visitSlots";
import { formatApiError } from "../../lib/apiErrors";
import {
  computeVetFeeBreakdown,
  parsePriceInput
} from "../../lib/platformFees";
import { vetColors, vetRadius } from "../../theme/vetTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

const REASONS: VetVisitReason[] = [
  "routine",
  "urgency",
  "followup",
  "vaccination",
  "other"
];

type ScheduleVisitModalProps = {
  visible: boolean;
  onClose: () => void;
  selectedDay: Date;
  selectedSlot: string | null;
};

export function ScheduleVisitModal({
  visible,
  onClose,
  selectedDay,
  selectedSlot
}: ScheduleVisitModalProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const modal = useModal();
  const { accessToken, activeProfileId, platformFees } = useSession();
  const [farmId, setFarmId] = useState<string | null>(null);
  const [reason, setReason] = useState<VetVisitReason>("routine");
  const [notes, setNotes] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  const vetFeeBreakdown = useMemo(() => {
    const parsed = parsePriceInput(price);
    if (parsed == null) {
      return null;
    }
    return computeVetFeeBreakdown(parsed, platformFees.vetCommissionRate);
  }, [price, platformFees.vetCommissionRate]);

  const farmsQ = useQuery({
    queryKey: ["farms", activeProfileId, "scheduleVisit"],
    queryFn: () => fetchFarms(accessToken!, activeProfileId),
    enabled: Boolean(visible && accessToken)
  });

  const farms = farmsQ.data ?? [];

  const scheduleMut = useMutation({
    mutationFn: async () => {
      if (!farmId || !selectedSlot) {
        throw new Error(t("vet.schedule.missingFields"));
      }
      return scheduleVetVisit(accessToken!, activeProfileId, {
        farmId,
        scheduledAt: combineDayAndSlot(selectedDay, selectedSlot),
        reason,
        notes: notes.trim() || undefined,
        consultationPrice: price.trim()
          ? Number.parseFloat(price.replace(",", "."))
          : undefined
      });
    },
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["vetDashboard"] });
      await qc.invalidateQueries({ queryKey: ["vetAppointments"] });
      onClose();
      const needsPayment = res.status === "AWAITING_PAYMENT";
      modal.open("success", {
        title: t("vet.schedule.successTitle"),
        message: needsPayment
          ? t("vet.schedule.successBodyPayment", {
              farm: res.farmName ?? "—",
              date: new Date(res.scheduledAt).toLocaleString()
            })
          : t("vet.schedule.successBody", {
              farm: res.farmName ?? "—",
              date: new Date(res.scheduledAt).toLocaleString()
            }),
        autoDismissMs: 3200
      });
    },
    onError: (e) => setError(formatApiError(e))
  });

  const canSubmit = Boolean(farmId && selectedSlot && !scheduleMut.isPending);

  const dayLabel = useMemo(
    () =>
      selectedDay.toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long"
      }),
    [selectedDay]
  );

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("vet.schedule.title")}
      footerPrimary={
        <Pressable
          style={[styles.submit, !canSubmit && styles.submitDisabled]}
          disabled={!canSubmit}
          onPress={() => {
            setError(null);
            scheduleMut.mutate();
          }}
        >
          {scheduleMut.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitTx}>{t("vet.schedule.confirm")}</Text>
          )}
        </Pressable>
      }
    >
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.meta}>
          {dayLabel}
          {selectedSlot ? ` · ${selectedSlot}` : ""}
        </Text>
        {!selectedSlot ? (
          <Text style={styles.warn}>{t("vet.schedule.pickSlot")}</Text>
        ) : null}

        <Text style={styles.label}>{t("vet.schedule.farm")}</Text>
        {farmsQ.isPending ? (
          <ActivityIndicator color={vetColors.primary} />
        ) : farms.length === 0 ? (
          <Text style={styles.hint}>{t("vet.schedule.noFarms")}</Text>
        ) : (
          <View style={styles.farmList}>
            {farms.map((f) => (
              <Pressable
                key={f.id}
                style={[styles.farmChip, farmId === f.id && styles.farmChipOn]}
                onPress={() => setFarmId(f.id)}
              >
                <Text
                  style={[styles.farmChipTx, farmId === f.id && styles.farmChipTxOn]}
                  numberOfLines={1}
                >
                  {f.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.label}>{t("vet.schedule.reason")}</Text>
        <View style={styles.reasonRow}>
          {REASONS.map((r) => (
            <Pressable
              key={r}
              style={[styles.reasonChip, reason === r && styles.reasonChipOn]}
              onPress={() => setReason(r)}
            >
              <Text style={[styles.reasonTx, reason === r && styles.reasonTxOn]}>
                {t(`vet.schedule.reasons.${r}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>{t("vet.schedule.notes")}</Text>
        <TextInput
          style={styles.input}
          multiline
          placeholder={t("vet.schedule.notesPlaceholder")}
          placeholderTextColor={vetColors.textSecondary}
          value={notes}
          onChangeText={setNotes}
        />

        <Text style={styles.label}>{t("vet.schedule.price")}</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          placeholder={t("vet.schedule.pricePlaceholder")}
          placeholderTextColor={vetColors.textSecondary}
          value={price}
          onChangeText={setPrice}
        />
        <PlatformFeePreview
          breakdown={vetFeeBreakdown}
          currency="XOF"
          unitLabelKey="platformFees.unitPerService"
          compact
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 420 },
  meta: {
    ...mobileTypography.body,
    color: vetColors.textSecondary,
    marginBottom: mobileSpacing.md
  },
  warn: { color: vetColors.warning, marginBottom: mobileSpacing.sm },
  label: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: vetColors.textPrimary,
    marginTop: mobileSpacing.md,
    marginBottom: mobileSpacing.sm
  },
  hint: { color: vetColors.textSecondary, marginBottom: mobileSpacing.sm },
  farmList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  farmChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: vetRadius.button,
    borderWidth: 1,
    borderColor: vetColors.border,
    backgroundColor: vetColors.cardBg,
    maxWidth: "100%"
  },
  farmChipOn: {
    backgroundColor: vetColors.primary,
    borderColor: vetColors.primary
  },
  farmChipTx: { fontWeight: "600", color: vetColors.textPrimary },
  farmChipTxOn: { color: "#fff" },
  reasonRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reasonChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: vetColors.border
  },
  reasonChipOn: {
    backgroundColor: vetColors.primaryLight,
    borderColor: vetColors.primary
  },
  reasonTx: { fontSize: 13, color: vetColors.textSecondary, fontWeight: "600" },
  reasonTxOn: { color: vetColors.primary },
  input: {
    borderWidth: 1,
    borderColor: vetColors.border,
    borderRadius: vetRadius.button,
    padding: mobileSpacing.md,
    minHeight: 44,
    color: vetColors.textPrimary,
    backgroundColor: vetColors.cardBg
  },
  submit: {
    backgroundColor: vetColors.primary,
    borderRadius: vetRadius.button,
    paddingVertical: 14,
    alignItems: "center",
    width: "100%"
  },
  submitDisabled: { opacity: 0.5 },
  submitTx: { color: "#fff", fontWeight: "700", fontSize: 16 },
  error: { color: vetColors.danger, marginTop: mobileSpacing.md }
});
