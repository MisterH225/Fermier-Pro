import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppDatePicker } from "../common/AppDatePicker";
import { formatMarketMoney } from "./MarketplaceListingCard";
import { projectMarketplaceFinalAmount } from "../../lib/marketplaceLabels";
import { BaseModal } from "../modals/BaseModal";
import { PrimaryButton } from "../ui/PrimaryButton";
import { SecondaryButton } from "../ui/SecondaryButton";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type ReceiptCondition = "conform" | "minor_issue" | "major_issue";

type Props = {
  visible: boolean;
  submitting?: boolean;
  animalIds: string[];
  priceType: string;
  currency?: string;
  agreedPricePerKg?: number | null;
  agreedFlatPrice?: number | null;
  declaredWeightKg?: number | null;
  blockedAmount?: number | null;
  onClose: () => void;
  onConfirm: (payload: {
    receivedAt: string;
    condition: ReceiptCondition;
    receivedAnimalIds: string[];
    receivedHeadcount?: number;
    notes?: string;
  }) => void;
};

const CONDITIONS: ReceiptCondition[] = ["conform", "minor_issue", "major_issue"];

export function ConfirmReceiptModal({
  visible,
  submitting,
  animalIds,
  priceType,
  currency = "XOF",
  agreedPricePerKg,
  agreedFlatPrice,
  declaredWeightKg,
  blockedAmount,
  onClose,
  onConfirm
}: Props) {
  const { t } = useTranslation();
  const isPerKg = priceType !== "flat";
  const [receivedAt, setReceivedAt] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [condition, setCondition] = useState<ReceiptCondition>("conform");
  const [notes, setNotes] = useState("");
  const [headcount, setHeadcount] = useState(
    animalIds.length > 0 ? String(animalIds.length) : "1"
  );
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(animalIds.map((id) => [id, true]))
  );

  useEffect(() => {
    if (!visible) {
      return;
    }
    setReceivedAt(new Date().toISOString().slice(0, 10));
    setCondition("conform");
    setNotes("");
    setHeadcount(animalIds.length > 0 ? String(animalIds.length) : "1");
    setChecked(Object.fromEntries(animalIds.map((id) => [id, true])));
  }, [visible, animalIds]);

  const receivedIds = useMemo(
    () => animalIds.filter((id) => checked[id]),
    [animalIds, checked]
  );

  const parsedHeadcount = Number.parseInt(headcount, 10);
  const validHeadcount =
    Number.isFinite(parsedHeadcount) && parsedHeadcount >= 1
      ? parsedHeadcount
      : null;

  const canConfirm =
    condition === "conform" &&
    (animalIds.length === 0 ? validHeadcount != null : receivedIds.length > 0);

  const projectedFinal = useMemo(() => {
    if (!isPerKg || declaredWeightKg == null) {
      return agreedFlatPrice ?? null;
    }
    return projectMarketplaceFinalAmount({
      priceType,
      agreedPricePerKg: agreedPricePerKg ?? null,
      agreedFlatPrice: agreedFlatPrice ?? null,
      realWeightKg: declaredWeightKg,
      draftWeightKg: declaredWeightKg
    });
  }, [isPerKg, declaredWeightKg, priceType, agreedPricePerKg, agreedFlatPrice]);

  const settlementHint = useMemo(() => {
    if (!isPerKg || projectedFinal == null || blockedAmount == null) {
      return null;
    }
    const delta = blockedAmount - projectedFinal;
    if (delta > 0) {
      return t("marketScreen.receiptModal.refundHint", {
        amount: formatMarketMoney(Math.round(delta), currency)
      });
    }
    if (delta < 0) {
      return t("marketScreen.receiptModal.extraHint", {
        amount: formatMarketMoney(Math.round(Math.abs(delta)), currency)
      });
    }
    return t("marketScreen.receiptModal.exactHint");
  }, [isPerKg, projectedFinal, blockedAmount, currency, t]);

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("marketScreen.receiptModal.title")}
      footerPrimary={
        <View style={{ gap: mobileSpacing.sm }}>
          <PrimaryButton
            label={t("marketScreen.receiptModal.confirm")}
            onPress={() => {
              onConfirm({
                receivedAt,
                condition,
                receivedAnimalIds: receivedIds,
                receivedHeadcount:
                  animalIds.length === 0
                    ? validHeadcount ?? undefined
                    : receivedIds.length,
                notes: notes.trim() || undefined
              });
            }}
            loading={submitting}
            disabled={!canConfirm}
          />
          {condition !== "conform" ? (
            <SecondaryButton
              label={t("marketScreen.receiptModal.reportProblem")}
              onPress={() =>
                onConfirm({
                  receivedAt,
                  condition,
                  receivedAnimalIds: receivedIds,
                  notes: notes.trim() || undefined
                })
              }
              loading={submitting}
            />
          ) : null}
        </View>
      }
    >
      <Text style={styles.info}>{t("marketScreen.receiptModal.info")}</Text>

      {animalIds.length > 0 ? (
        <View style={styles.checklist}>
          <Text style={styles.label}>
            {t("marketScreen.receiptModal.animalsReceived")}
          </Text>
          {animalIds.map((id) => (
            <Pressable
              key={id}
              style={styles.checkRow}
              onPress={() =>
                setChecked((prev) => ({ ...prev, [id]: !prev[id] }))
              }
            >
              <Text style={styles.checkMark}>{checked[id] ? "☑" : "☐"}</Text>
              <Text style={styles.checkLabel}>{id.slice(0, 8)}…</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <>
          <Text style={styles.label}>
            {t("marketScreen.receiptModal.headcount")}
          </Text>
          <TextInput
            style={styles.weightInput}
            value={headcount}
            onChangeText={setHeadcount}
            keyboardType="number-pad"
            placeholder="1"
            placeholderTextColor={mobileColors.textSecondary}
          />
        </>
      )}

      {isPerKg && declaredWeightKg != null ? (
        <Text style={styles.meta}>
          {t("marketScreen.receiptModal.declaredWeightReminder", {
            weight: declaredWeightKg.toLocaleString("fr-FR", {
              maximumFractionDigits: 1
            })
          })}
        </Text>
      ) : null}

      {projectedFinal != null && isPerKg ? (
        <Text style={styles.projected}>
          {t("marketScreen.transaction.projectedFinalCost", {
            amount: formatMarketMoney(Math.round(projectedFinal), currency)
          })}
        </Text>
      ) : null}
      {settlementHint ? <Text style={styles.hint}>{settlementHint}</Text> : null}

      <AppDatePicker
        label={t("marketScreen.receiptModal.receivedAt")}
        mode="date"
        isoValue={receivedAt}
        onIsoChange={setReceivedAt}
      />

      <Text style={styles.label}>{t("marketScreen.receiptModal.condition")}</Text>
      <View style={styles.conditions}>
        {CONDITIONS.map((c) => (
          <Pressable
            key={c}
            style={[styles.condBtn, condition === c && styles.condBtnActive]}
            onPress={() => setCondition(c)}
          >
            <Text
              style={[
                styles.condText,
                condition === c && styles.condTextActive
              ]}
            >
              {t(`marketScreen.receiptModal.conditions.${c}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>{t("marketScreen.receiptModal.notes")}</Text>
      <TextInput
        style={styles.notesInput}
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder={t("marketScreen.receiptModal.notesPh")}
        placeholderTextColor={mobileColors.textSecondary}
      />
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  info: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.md
  },
  label: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.xs,
    marginTop: mobileSpacing.sm
  },
  checklist: { gap: mobileSpacing.xs, marginBottom: mobileSpacing.sm },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    paddingVertical: mobileSpacing.xs
  },
  checkMark: { fontSize: 18 },
  checkLabel: { ...mobileTypography.body, color: mobileColors.textPrimary },
  weightInput: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    ...mobileTypography.body,
    color: mobileColors.textPrimary
  },
  meta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm
  },
  projected: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontWeight: "600",
    marginTop: mobileSpacing.sm
  },
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    marginTop: mobileSpacing.xs
  },
  conditions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.xs
  },
  condBtn: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: mobileSpacing.xs
  },
  condBtnActive: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  condText: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  condTextActive: {
    color: mobileColors.accent,
    fontWeight: "600"
  },
  notesInput: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    minHeight: 72,
    textAlignVertical: "top",
    ...mobileTypography.body,
    color: mobileColors.textPrimary
  }
});
