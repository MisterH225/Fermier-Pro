import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ModalSection } from "../../modals/ModalSection";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import type { BulkAddFormState } from "./BulkAddAnimalsModal";
import { tagPrefixForCategory } from "./animalUtils";
import { useQuery } from "@tanstack/react-query";
import { fetchTagCodePreview } from "../../../lib/api";

type Props = {
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  form: BulkAddFormState;
  penLabel: string | null;
  freeSlots: number | null;
  breedName: string | null;
  isSubmitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
};

export function BulkAddStep2Preview({
  farmId,
  accessToken,
  activeProfileId,
  form,
  penLabel,
  freeSlots,
  breedName,
  isSubmitting,
  onBack,
  onConfirm
}: Props) {
  const { t } = useTranslation();
  const prefix = tagPrefixForCategory(form.category);

  const previewQ = useQuery({
    queryKey: ["nextAnimalNumber", farmId, prefix, form.count, activeProfileId],
    queryFn: () =>
      fetchTagCodePreview(
        accessToken,
        farmId,
        prefix,
        form.count,
        activeProfileId
      )
  });

  const categoryLabel = (): string => {
    switch (form.category) {
      case "breeding_female":
        return t("cheptel.animals.bulk.categoryTrui");
      case "breeding_male":
        return t("cheptel.animals.bulk.categoryVer");
      case "fattening":
        return t("cheptel.animals.bulk.categoryEng");
      case "starter":
        return t("cheptel.animals.bulk.categoryDem");
    }
  };

  const weightNum = form.entryWeight.trim()
    ? Number.parseFloat(form.entryWeight.replace(",", "."))
    : null;
  const ageNum = form.ageWeeks.trim()
    ? Number.parseInt(form.ageWeeks, 10)
    : null;

  const rows: Array<{ label: string; value: string }> = [
    {
      label: t("cheptel.animals.bulk.summaryCategory"),
      value: categoryLabel()
    },
    {
      label: t("cheptel.animals.bulk.summaryCount"),
      value: t("cheptel.animals.bulk.summaryCountValue", { count: form.count })
    }
  ];

  if (penLabel) {
    const penValue =
      freeSlots != null
        ? t("cheptel.animals.bulk.summaryPenWithSlots", {
            pen: penLabel,
            free: freeSlots
          })
        : penLabel;
    rows.push({
      label: t("cheptel.animals.bulk.summaryPen"),
      value: penValue
    });
  }

  if (breedName) {
    rows.push({
      label: t("cheptel.animals.bulk.summaryBreed"),
      value: breedName
    });
  }
  if (weightNum != null && Number.isFinite(weightNum)) {
    rows.push({
      label: t("cheptel.animals.bulk.summaryWeight"),
      value: `${weightNum} kg`
    });
  }
  if (ageNum != null && Number.isFinite(ageNum)) {
    rows.push({
      label: t("cheptel.animals.bulk.summaryAge"),
      value: t("cheptel.animals.bulk.summaryAgeValue", { weeks: ageNum })
    });
  }
  if (previewQ.data) {
    rows.push({
      label: t("cheptel.animals.bulk.summaryNumbers"),
      value: `${previewQ.data.firstTagCode} → ${previewQ.data.lastTagCode}`
    });
  }
  rows.push({
    label: t("cheptel.animals.bulk.summaryEntryDate"),
    value: form.entryDate
  });

  return (
    <>
      <ModalSection title={t("cheptel.animals.bulk.step2Title")}>
        <Text style={styles.intro}>{t("cheptel.animals.bulk.step2Intro")}</Text>
        <View style={styles.card}>
          {rows.map((row) => (
            <View key={row.label} style={styles.row}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue}>{row.value}</Text>
            </View>
          ))}
        </View>
        {isSubmitting ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={mobileColors.accent} />
            <Text style={styles.loadingTx}>
              {t("cheptel.animals.bulk.creating", { count: form.count })}
            </Text>
          </View>
        ) : null}
      </ModalSection>

      <View style={styles.actions}>
        <Pressable
          style={styles.outlineBtn}
          onPress={onBack}
          disabled={isSubmitting}
        >
          <Text style={styles.outlineBtnTx}>{t("cheptel.animals.bulk.back")}</Text>
        </Pressable>
        <Pressable
          style={[styles.primaryBtn, isSubmitting && styles.btnDisabled]}
          onPress={onConfirm}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={mobileColors.onAccent} />
          ) : (
            <Text style={styles.primaryBtnTx}>
              {t("cheptel.animals.bulk.confirm", { count: form.count })}
            </Text>
          )}
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  intro: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: 8
  },
  card: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    gap: 10,
    backgroundColor: mobileColors.background
  },
  row: { gap: 2 },
  rowLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontWeight: "600"
  },
  rowValue: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontWeight: "600"
  },
  loadingBox: {
    marginTop: 16,
    alignItems: "center",
    gap: 8
  },
  loadingTx: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  actions: { gap: 10, marginTop: 8 },
  outlineBtn: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.pill,
    paddingVertical: 12,
    alignItems: "center"
  },
  outlineBtnTx: {
    color: mobileColors.textPrimary,
    fontWeight: "700"
  },
  primaryBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnTx: { color: mobileColors.onAccent, fontWeight: "700", fontSize: 16 }
});
