import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
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
import { mobileColors, mobileSpacing, mobileTypography, mobileRadius, mobileFontSize } from "../../theme/mobileTheme";

const REASONS: VetVisitReason[] = [
  "routine",
  "urgency",
  "followup",
  "vaccination",
  "other"
];

type PricingChoice = "paid" | "free" | null;

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
  const [pricingChoice, setPricingChoice] = useState<PricingChoice>(null);
  const [error, setError] = useState<string | null>(null);

  const vetFeeBreakdown = useMemo(() => {
    if (pricingChoice !== "paid") {
      return null;
    }
    const parsed = parsePriceInput(price);
    if (parsed == null) {
      return null;
    }
    return computeVetFeeBreakdown(parsed, platformFees.vetCommissionRate);
  }, [price, pricingChoice, platformFees.vetCommissionRate]);

  const farmsQ = useQuery({
    queryKey: ["farms", activeProfileId, "scheduleVisit"],
    queryFn: () => fetchFarms(accessToken!, activeProfileId),
    enabled: Boolean(visible && accessToken)
  });

  const farms = farmsQ.data ?? [];

  const scheduleMut = useMutation({
    mutationFn: async () => {
      if (!farmId || !selectedSlot || pricingChoice == null) {
        throw new Error(t("vet.schedule.missingFields"));
      }
      if (pricingChoice === "paid") {
        const amount = parsePriceInput(price);
        if (amount == null || amount <= 0) {
          throw new Error(t("vet.schedule.priceRequired"));
        }
        return scheduleVetVisit(accessToken!, activeProfileId, {
          farmId,
          scheduledAt: combineDayAndSlot(selectedDay, selectedSlot),
          reason,
          notes: notes.trim() || undefined,
          consultationPrice: amount,
          isFree: false
        });
      }
      return scheduleVetVisit(accessToken!, activeProfileId, {
        farmId,
        scheduledAt: combineDayAndSlot(selectedDay, selectedSlot),
        reason,
        notes: notes.trim() || undefined,
        isFree: true
      });
    },
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["vetDashboard"] });
      await qc.invalidateQueries({ queryKey: ["vetAppointments"] });
      onClose();
      setPricingChoice(null);
      setPrice("");
      modal.open("success", {
        title: t("vet.schedule.successTitle"),
        message: t("vet.schedule.successBodyProposed", {
          farm: res.farmName ?? "—",
          date: new Date(res.scheduledAt).toLocaleString()
        }),
        autoDismissMs: 3200
      });
    },
    onError: (e) => setError(formatApiError(e))
  });

  const paidAmountValid =
    pricingChoice === "paid" &&
    parsePriceInput(price) != null &&
    (parsePriceInput(price) ?? 0) > 0;

  const canSubmit = Boolean(
    farmId &&
      selectedSlot &&
      pricingChoice != null &&
      (pricingChoice === "free" || paidAmountValid) &&
      !scheduleMut.isPending
  );

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
            <ActivityIndicator color={mobileColors.background} />
          ) : (
            <Text style={styles.submitTx}>{t("vet.schedule.confirm")}</Text>
          )}
        </Pressable>
      }
    >
      {/* Contenu sans scroll interne : BaseModal gère déjà scroll + clavier.
          Un scroll imbriqué (maxHeight 420) coupait le champ montant sous le label. */}
      <View>
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
          style={[styles.input, styles.notesInput]}
          multiline
          placeholder={t("vet.schedule.notesPlaceholder")}
          placeholderTextColor={vetColors.textSecondary}
          value={notes}
          onChangeText={setNotes}
        />

        <Text style={styles.label}>{t("vet.schedule.pricingChoice")}</Text>
        <View style={styles.reasonRow}>
          <Pressable
            style={[
              styles.reasonChip,
              pricingChoice === "paid" && styles.reasonChipOn
            ]}
            onPress={() => setPricingChoice("paid")}
            accessibilityRole="button"
            accessibilityState={{ selected: pricingChoice === "paid" }}
          >
            <Text
              style={[
                styles.reasonTx,
                pricingChoice === "paid" && styles.reasonTxOn
              ]}
            >
              {t("vet.schedule.pricingPaid")}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.reasonChip,
              pricingChoice === "free" && styles.reasonChipOn
            ]}
            onPress={() => {
              setPricingChoice("free");
              setPrice("");
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: pricingChoice === "free" }}
          >
            <Text
              style={[
                styles.reasonTx,
                pricingChoice === "free" && styles.reasonTxOn
              ]}
            >
              {t("vet.schedule.pricingFree")}
            </Text>
          </Pressable>
        </View>

        {pricingChoice === "paid" ? (
          <View style={styles.priceBlock} testID="schedule-visit-price-block">
            <Text style={styles.label}>{t("vet.schedule.price")}</Text>
            <TextInput
              style={styles.priceInput}
              keyboardType="decimal-pad"
              placeholder={t("vet.schedule.pricePlaceholder")}
              placeholderTextColor={vetColors.textSecondary}
              value={price}
              onChangeText={setPrice}
              accessibilityLabel={t("vet.schedule.price")}
              testID="schedule-visit-price-input"
            />
            <PlatformFeePreview
              breakdown={vetFeeBreakdown}
              currency="XOF"
              unitLabelKey="platformFees.unitPerService"
              compact
            />
          </View>
        ) : null}

        {pricingChoice === "free" ? (
          <Text style={styles.freeHint}>{t("vet.schedule.freeHint")}</Text>
        ) : null}

        {pricingChoice == null ? (
          <Text style={styles.warn}>{t("vet.schedule.pricingRequired")}</Text>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
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
  freeHint: {
    ...mobileTypography.meta,
    color: vetColors.textSecondary,
    marginTop: mobileSpacing.sm,
    marginBottom: mobileSpacing.sm
  },
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
  farmChipTxOn: { color: mobileColors.background },
  reasonRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reasonChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: vetColors.border
  },
  reasonChipOn: {
    backgroundColor: vetColors.primaryLight,
    borderColor: vetColors.primary
  },
  reasonTx: { fontSize: mobileFontSize.sm, color: vetColors.textSecondary, fontWeight: "600" },
  reasonTxOn: { color: vetColors.primary },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: vetRadius.button,
    padding: mobileSpacing.md,
    minHeight: 44,
    color: vetColors.textPrimary,
    backgroundColor: vetColors.cardBg
  },
  notesInput: {
    minHeight: 72,
    textAlignVertical: "top"
  },
  priceBlock: {
    marginBottom: mobileSpacing.sm
  },
  priceInput: {
    borderWidth: 1.5,
    borderColor: vetColors.primaryMuted,
    borderRadius: vetRadius.button,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.md,
    minHeight: 52,
    fontSize: mobileFontSize.lg,
    fontWeight: "600",
    color: vetColors.textPrimary,
    backgroundColor: vetColors.primaryLight
  },
  submit: {
    backgroundColor: vetColors.primary,
    borderRadius: vetRadius.button,
    paddingVertical: 14,
    alignItems: "center",
    width: "100%"
  },
  submitDisabled: { opacity: 0.5 },
  submitTx: { color: mobileColors.background, fontWeight: "700", fontSize: mobileFontSize.lg },
  error: { color: vetColors.danger, marginTop: mobileSpacing.md }
});
