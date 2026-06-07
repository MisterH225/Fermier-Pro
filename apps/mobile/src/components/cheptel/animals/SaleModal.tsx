import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { AppDatePicker } from "../../common/AppDatePicker";
import { BaseModal } from "../../modals/BaseModal";
import { ModalSection } from "../../modals/ModalSection";
import type { AnimalListItem, AnimalSaleResultDto } from "../../../lib/api";
import {
  fetchFarmFinanceSettings,
  sellCheptelAnimal
} from "../../../lib/api";
import { formatAuthError } from "../../../lib/authErrors";
import {
  offlineQueuedMessage,
  useOfflineMutation
} from "../../../hooks/useOfflineMutation";
import { optimisticSellAnimal } from "../../../lib/offline/optimistic";
import { isOfflineQueuedResult } from "../../../lib/offline/types";
import {
  animalDisplayTag,
  formatAnimalKg
} from "./animalUtils";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";

export type SaleResult = AnimalSaleResultDto;

type Props = {
  visible: boolean;
  animal: AnimalListItem | null;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  onCancel: () => void;
  onSuccess: (sale: SaleResult) => void;
};

function parseDecimalInput(raw: string): number | null {
  const n = Number.parseFloat(raw.replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function categoryLabel(
  t: (key: string) => string,
  category: AnimalListItem["productionCategory"]
): string {
  switch (category) {
    case "breeding_female":
      return t("cheptel.animals.create.categoryTrui");
    case "breeding_male":
      return t("cheptel.animals.create.categoryVer");
    case "fattening":
      return t("cheptel.animals.create.categoryEng");
    case "starter":
      return t("cheptel.animals.create.categoryDem");
    default:
      return "—";
  }
}

export function SaleModal({
  visible,
  animal,
  farmId,
  accessToken,
  activeProfileId,
  onCancel,
  onSuccess
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [soldWeightKg, setSoldWeightKg] = useState("");
  const [pricePerKg, setPricePerKg] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [totalManual, setTotalManual] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [soldAt, setSoldAt] = useState(todayIsoDate());
  const [notes, setNotes] = useState("");

  const settingsQ = useQuery({
    queryKey: ["farmFinanceSettings", farmId, activeProfileId],
    queryFn: () =>
      fetchFarmFinanceSettings(accessToken, farmId, activeProfileId),
    enabled: visible && Boolean(accessToken)
  });

  const currencySymbol =
    settingsQ.data?.currencySymbol ?? settingsQ.data?.currencyCode ?? "FCFA";

  useEffect(() => {
    if (!visible || !animal) {
      return;
    }
    const lastWeight = animal.weights[0]?.weightKg;
    const w =
      lastWeight != null
        ? typeof lastWeight === "string"
          ? lastWeight
          : String(lastWeight)
        : "";
    setSoldWeightKg(w);
    setPricePerKg("");
    setTotalPrice("");
    setTotalManual(false);
    setBuyerName("");
    setSoldAt(todayIsoDate());
    setNotes("");
  }, [visible, animal]);

  useEffect(() => {
    if (totalManual) {
      return;
    }
    const w = parseDecimalInput(soldWeightKg);
    const p = parseDecimalInput(pricePerKg);
    if (w != null && p != null && w > 0 && p > 0) {
      setTotalPrice(String(Math.round(w * p * 100) / 100));
    }
  }, [soldWeightKg, pricePerKg, totalManual]);

  const totalNum = parseDecimalInput(totalPrice);
  const weightNum = parseDecimalInput(soldWeightKg);
  const canSubmit =
    weightNum != null &&
    weightNum > 0 &&
    totalNum != null &&
    totalNum > 0 &&
    soldAt.trim().length >= 8;

  const subtitle = useMemo(() => {
    if (!animal) {
      return "";
    }
    const tag = animalDisplayTag(animal);
    const breed = animal.breed?.name ?? "—";
    const cat = categoryLabel(t, animal.productionCategory);
    return `${tag} · ${breed} · ${cat}`;
  }, [animal, t]);

  const buildSaleBody = () => {
    if (!animal || !canSubmit || totalNum == null || weightNum == null) {
      throw new Error(t("cheptel.animals.sale.validation"));
    }
    return {
      animalId: animal.id,
      body: {
        soldWeightKg: weightNum,
        pricePerKg: parseDecimalInput(pricePerKg) ?? undefined,
        totalPrice: totalNum,
        buyerName: buyerName.trim() || undefined,
        soldAt: `${soldAt.trim()}T12:00:00.000Z`,
        notes: notes.trim() || undefined
      }
    };
  };

  const saveMut = useOfflineMutation({
    farmId,
    type: "cheptel.sellAnimal",
    label: animal ? animalDisplayTag(animal) : "—",
    mutationFn: async () => {
      const { animalId, body } = buildSaleBody();
      return sellCheptelAnimal(
        accessToken,
        farmId,
        animalId,
        body,
        activeProfileId
      );
    },
    buildOfflineItem: () => {
      const { animalId, body } = buildSaleBody();
      return {
        calls: [
          {
            method: "PATCH",
            path: `/farms/${farmId}/cheptel/animals/${animalId}/sell`,
            body
          }
        ],
        invalidateRoots: [
          "farmAnimals",
          "farmCheptel",
          "financeOverview",
          "financeTransactions"
        ]
      };
    },
    applyOptimistic: () => {
      const { animalId } = buildSaleBody();
      optimisticSellAnimal(qc, farmId, activeProfileId, animalId);
    },
    onSuccess: (result) => {
      if (isOfflineQueuedResult(result)) {
        onSuccess({} as SaleResult);
        return;
      }
      onSuccess(result as SaleResult);
    },
    onQueued: () => {
      onSuccess({} as SaleResult);
    },
    onError: (e: unknown) => {
      Alert.alert(t("cheptel.animals.sale.errorTitle"), formatAuthError(e));
    }
  });

  if (!animal) {
    return null;
  }

  return (
    <BaseModal
      visible={visible}
      onClose={onCancel}
      dismissible={false}
      title={t("cheptel.animals.sale.title")}
      headerAmount={
        totalNum != null && totalNum > 0
          ? `${totalNum.toLocaleString("fr-FR")} ${currencySymbol}`
          : undefined
      }
      footerPrimary={
        <View style={styles.footer}>
          <Pressable style={styles.outlineBtn} onPress={onCancel}>
            <Text style={styles.outlineBtnText}>{t("cheptel.cancel")}</Text>
          </Pressable>
          <Pressable
            style={[
              styles.primaryBtn,
              (!canSubmit || saveMut.isPending) && styles.btnDisabled
            ]}
            disabled={!canSubmit || saveMut.isPending}
            onPress={() => saveMut.mutate()}
          >
            {saveMut.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {t("cheptel.animals.sale.confirm")}
              </Text>
            )}
          </Pressable>
        </View>
      }
    >
      <Text style={styles.subtitle}>{subtitle}</Text>

      <ModalSection title={t("cheptel.animals.sale.sectionDetails")}>
        <Field
          label={t("cheptel.animals.sale.soldWeight")}
          hint={t("cheptel.animals.sale.soldWeightHint")}
          value={soldWeightKg}
          onChange={setSoldWeightKg}
          keyboardType="decimal-pad"
        />
        <Field
          label={t("cheptel.animals.sale.pricePerKg")}
          hint={t("cheptel.animals.sale.pricePerKgHint")}
          value={pricePerKg}
          onChange={setPricePerKg}
          keyboardType="decimal-pad"
        />
        <Field
          label={t("cheptel.animals.sale.totalPrice")}
          hint={t("cheptel.animals.sale.totalPriceHint")}
          value={totalPrice}
          onChange={(v) => {
            setTotalManual(true);
            setTotalPrice(v);
          }}
          keyboardType="decimal-pad"
        />
        <Field
          label={t("cheptel.animals.sale.buyer")}
          value={buyerName}
          onChange={setBuyerName}
          placeholder={t("cheptel.animals.sale.buyerPlaceholder")}
        />
        <AppDatePicker
          label={t("cheptel.animals.sale.soldAt")}
          isoValue={soldAt}
          onIsoChange={setSoldAt}
          farmId={farmId}
          maxDate={new Date()}
        />
        <Field
          label={t("cheptel.animals.sale.notes")}
          value={notes}
          onChange={setNotes}
          multiline
        />
      </ModalSection>

      <View style={styles.preview}>
        <Text style={styles.previewTitle}>
          {t("cheptel.animals.sale.previewTitle")}
        </Text>
        <Text style={styles.previewLine}>
          {t("cheptel.animals.sale.previewAnimal", {
            tag: animalDisplayTag(animal),
            breed: animal.breed?.name ?? "—"
          })}
        </Text>
        <Text style={styles.previewLine}>
          {t("cheptel.animals.sale.previewWeight", {
            weight: weightNum != null ? formatAnimalKg(weightNum) : "—"
          })}
        </Text>
        <Text style={styles.previewLineBold}>
          {t("cheptel.animals.sale.previewTotal", {
            amount:
              totalNum != null && totalNum > 0
                ? `${totalNum.toLocaleString("fr-FR")} ${currencySymbol}`
                : "—"
          })}
        </Text>
        <Text style={styles.previewHint}>
          {t("cheptel.animals.sale.previewFinance")}
        </Text>
      </View>
    </BaseModal>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  multiline,
  keyboardType
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "decimal-pad";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        multiline={multiline}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.md
  },
  field: { marginBottom: mobileSpacing.sm },
  label: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: mobileColors.textSecondary
  },
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2,
    marginBottom: 4
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 10,
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    backgroundColor: mobileColors.background
  },
  inputMulti: { minHeight: 72, textAlignVertical: "top" },
  preview: {
    marginTop: mobileSpacing.md,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.accentSoft,
    gap: 4
  },
  previewTitle: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    marginBottom: mobileSpacing.xs
  },
  previewLine: { ...mobileTypography.body, color: mobileColors.textSecondary },
  previewLineBold: {
    ...mobileTypography.body,
    fontWeight: "800",
    color: mobileColors.textPrimary,
    marginTop: mobileSpacing.xs
  },
  previewHint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.xs,
    fontStyle: "italic"
  },
  footer: { flexDirection: "row", gap: mobileSpacing.sm },
  outlineBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  outlineBtnText: { fontWeight: "600", color: mobileColors.textPrimary },
  primaryBtn: {
    flex: 1.4,
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 }
});
