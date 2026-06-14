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
  estimatedWeightKg?: number | null;
  blockedAmount?: number | null;
  onClose: () => void;
  onConfirm: (payload: {
    receivedAt: string;
    condition: ReceiptCondition;
    receivedAnimalIds: string[];
    realWeightKg?: number;
    animalWeights?: { animalId: string; weightKg: number }[];
    receivedHeadcount?: number;
    notes?: string;
  }) => void;
};

const CONDITIONS: ReceiptCondition[] = ["conform", "minor_issue", "major_issue"];

function parseKg(raw: string): number | null {
  const kg = Number.parseFloat(raw.replace(",", "."));
  return Number.isFinite(kg) && kg > 0 ? kg : null;
}

export function ConfirmReceiptModal({
  visible,
  submitting,
  animalIds,
  priceType,
  currency = "XOF",
  agreedPricePerKg,
  agreedFlatPrice,
  estimatedWeightKg,
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
  const [totalWeight, setTotalWeight] = useState("");
  const [headcount, setHeadcount] = useState(
    animalIds.length > 0 ? String(animalIds.length) : "1"
  );
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(animalIds.map((id) => [id, true]))
  );
  const [weightsByAnimal, setWeightsByAnimal] = useState<Record<string, string>>(
    () => Object.fromEntries(animalIds.map((id) => [id, ""]))
  );

  useEffect(() => {
    if (!visible) {
      return;
    }
    setReceivedAt(new Date().toISOString().slice(0, 10));
    setCondition("conform");
    setNotes("");
    setTotalWeight("");
    setHeadcount(animalIds.length > 0 ? String(animalIds.length) : "1");
    setChecked(Object.fromEntries(animalIds.map((id) => [id, true])));
    setWeightsByAnimal(Object.fromEntries(animalIds.map((id) => [id, ""])));
  }, [visible, animalIds]);

  const receivedIds = useMemo(
    () => animalIds.filter((id) => checked[id]),
    [animalIds, checked]
  );

  const animalWeights = useMemo(() => {
    if (animalIds.length === 0) {
      return [] as { animalId: string; weightKg: number }[];
    }
    return receivedIds
      .map((id) => {
        const kg = parseKg(weightsByAnimal[id] ?? "");
        return kg != null ? { animalId: id, weightKg: kg } : null;
      })
      .filter((row): row is { animalId: string; weightKg: number } => row != null);
  }, [animalIds.length, receivedIds, weightsByAnimal]);

  const summedWeight = useMemo(() => {
    if (animalWeights.length > 0) {
      return animalWeights.reduce((acc, row) => acc + row.weightKg, 0);
    }
    return parseKg(totalWeight);
  }, [animalWeights, totalWeight]);

  const parsedHeadcount = Number.parseInt(headcount, 10);
  const validHeadcount =
    Number.isFinite(parsedHeadcount) && parsedHeadcount >= 1
      ? parsedHeadcount
      : null;

  const allAnimalsWeighed =
    animalIds.length === 0 ||
    (receivedIds.length > 0 &&
      receivedIds.every((id) => parseKg(weightsByAnimal[id] ?? "") != null));

  const canConfirm =
    condition === "conform" &&
    (animalIds.length === 0 ? validHeadcount != null : receivedIds.length > 0) &&
    allAnimalsWeighed &&
    (!isPerKg || (summedWeight != null && summedWeight > 0));

  const projectedFinal = useMemo(() => {
    if (!isPerKg || summedWeight == null) {
      return agreedFlatPrice ?? null;
    }
    return projectMarketplaceFinalAmount({
      priceType,
      agreedPricePerKg: agreedPricePerKg ?? null,
      agreedFlatPrice: agreedFlatPrice ?? null,
      realWeightKg: summedWeight,
      draftWeightKg: summedWeight
    });
  }, [
    isPerKg,
    summedWeight,
    priceType,
    agreedPricePerKg,
    agreedFlatPrice
  ]);

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
                realWeightKg: summedWeight ?? undefined,
                animalWeights:
                  animalWeights.length > 0 ? animalWeights : undefined,
                receivedHeadcount:
                  animalIds.length === 0 ? validHeadcount ?? undefined : receivedIds.length,
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
            {t("marketScreen.receiptModal.animalsWeigh")}
          </Text>
          {animalIds.map((id) => (
            <View key={id} style={styles.animalRow}>
              <Pressable
                style={styles.checkRow}
                onPress={() =>
                  setChecked((prev) => ({ ...prev, [id]: !prev[id] }))
                }
              >
                <Text style={styles.checkMark}>{checked[id] ? "☑" : "☐"}</Text>
                <Text style={styles.checkLabel}>{id.slice(0, 8)}…</Text>
              </Pressable>
              {checked[id] ? (
                <TextInput
                  style={styles.weightInput}
                  value={weightsByAnimal[id] ?? ""}
                  onChangeText={(v) =>
                    setWeightsByAnimal((prev) => ({ ...prev, [id]: v }))
                  }
                  keyboardType="decimal-pad"
                  placeholder={t("marketScreen.receiptModal.weightKgPh")}
                  placeholderTextColor={mobileColors.textSecondary}
                />
              ) : null}
            </View>
          ))}
          {summedWeight != null && summedWeight > 0 ? (
            <Text style={styles.totalLine}>
              {t("marketScreen.receiptModal.totalWeight", {
                weight: summedWeight.toLocaleString("fr-FR", {
                  maximumFractionDigits: 1
                })
              })}
            </Text>
          ) : null}
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
          <Text style={styles.label}>
            {t("marketScreen.transaction.realWeight")}
          </Text>
          <TextInput
            style={styles.weightInput}
            value={totalWeight}
            onChangeText={setTotalWeight}
            keyboardType="decimal-pad"
            placeholder={t("marketScreen.receiptModal.weightKgPh")}
            placeholderTextColor={mobileColors.textSecondary}
          />
        </>
      )}

      {isPerKg && estimatedWeightKg != null ? (
        <Text style={styles.meta}>
          {t("marketScreen.receiptModal.estimatedWeight", {
            weight: estimatedWeightKg.toLocaleString("fr-FR", {
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
        label={t("marketScreen.receiptModal.date")}
        mode="date"
        presentation="inline"
        isoValue={receivedAt}
        onIsoChange={setReceivedAt}
      />
      <Text style={styles.label}>{t("marketScreen.receiptModal.condition")}</Text>
      <View style={styles.methodRow}>
        {CONDITIONS.map((c) => (
          <Text
            key={c}
            style={[styles.methodChip, condition === c && styles.methodChipOn]}
            onPress={() => setCondition(c)}
          >
            {t(`marketScreen.receiptModal.conditions.${c}`)}
          </Text>
        ))}
      </View>
      <Text style={styles.label}>{t("marketScreen.receiptModal.comment")}</Text>
      <TextInput
        style={styles.inputMulti}
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder={t("marketScreen.receiptModal.commentPh")}
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
    marginTop: mobileSpacing.sm,
    marginBottom: 4
  },
  meta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    fontWeight: "600"
  },
  projected: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  weightInput: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    minHeight: 44,
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    backgroundColor: mobileColors.surfaceMuted,
    flex: 1
  },
  inputMulti: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: 8,
    padding: mobileSpacing.md,
    minHeight: 72,
    textAlignVertical: "top",
    ...mobileTypography.body,
    color: mobileColors.textPrimary
  },
  checklist: { marginBottom: mobileSpacing.sm, gap: mobileSpacing.sm },
  animalRow: { gap: mobileSpacing.xs },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkMark: { fontSize: 18 },
  checkLabel: { ...mobileTypography.body, color: mobileColors.textPrimary },
  totalLine: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.accent
  },
  methodRow: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.sm },
  methodChip: {
    ...mobileTypography.meta,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: mobileColors.border,
    color: mobileColors.textSecondary
  },
  methodChipOn: {
    borderColor: mobileColors.accent,
    color: mobileColors.accent,
    backgroundColor: mobileColors.surfaceMuted
  }
});
