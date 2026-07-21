import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { HighlightWrapper } from "../common/HighlightWrapper";
import { useTranslation } from "react-i18next";
import { getUserFacingError } from "../../lib/userFacingError";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import {
  createFarmCustomVaccine,
  fetchFarmVaccineCoverage,
  fetchFarmVaccineSubjects,
  type VaccineCatalogItemDto,
  type VaccineCatalogType,
  type VaccineSubjectRowDto
} from "../../lib/api";
import { invalidateAIInsights } from "../../services/ai/AIRecommendationService";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { BaseModal } from "../modals/BaseModal";
import { useModal } from "../modals/useModal";
import { BulkVaccineModal } from "./BulkVaccineModal";
import { VaccineCard } from "./VaccineCard";

type Props = {
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  livestockMode: "individual" | "batch" | "hybrid";
  highlightVaccineName?: string;
};

const VACCINE_TYPES: VaccineCatalogType[] = [
  "viral",
  "bacterial",
  "antiparasitic",
  "other"
];

const TARGET_OPTIONS = [
  { key: "all", labelKey: "health.vaccines.targetAll" },
  { key: "breeding_female", labelKey: "health.vaccines.targetBreedingFemale" },
  { key: "breeding_male", labelKey: "health.vaccines.targetBreedingMale" },
  { key: "starter", labelKey: "health.vaccines.targetStarter" },
  { key: "fattening", labelKey: "health.vaccines.targetFattening" }
] as const;

export function VaccinesTab({
  farmId,
  accessToken,
  activeProfileId,
  livestockMode,
  highlightVaccineName
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const modal = useModal();

  const coverageQ = useQuery({
    queryKey: ["farmVaccineCoverage", farmId, activeProfileId],
    queryFn: () =>
      fetchFarmVaccineCoverage(accessToken, farmId, activeProfileId),
    enabled: Boolean(accessToken && farmId)
  });

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkVaccine, setBulkVaccine] = useState<VaccineCatalogItemDto | null>(
    null
  );
  const [bulkSubjects, setBulkSubjects] = useState<VaccineSubjectRowDto[]>([]);

  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customType, setCustomType] = useState<VaccineCatalogType>("viral");
  const [customTarget, setCustomTarget] = useState<string[]>(["all"]);
  const [customFreq, setCustomFreq] = useState("");
  const [customTiming, setCustomTiming] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [highlightName, setHighlightName] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightVaccineName?.trim()) {
      setHighlightName(null);
      return;
    }
    setHighlightName(highlightVaccineName.trim().toLowerCase());
    const timer = setTimeout(() => setHighlightName(null), 2200);
    return () => clearTimeout(timer);
  }, [highlightVaccineName]);

  const openBulk = useCallback(
    async (vaccineId: string, subjects: VaccineSubjectRowDto[]) => {
      const item = coverageQ.data?.items.find((i) => i.vaccine.id === vaccineId);
      if (!item) {
        return;
      }
      let list = subjects;
      if (!list.length) {
        const res = await fetchFarmVaccineSubjects(
          accessToken,
          farmId,
          vaccineId,
          "unvaccinated",
          activeProfileId
        );
        list = res.subjects;
      }
      if (!list.length) {
        Alert.alert(t("health.errorTitle"), t("health.vaccines.noSubjects"));
        return;
      }
      setBulkVaccine(item.vaccine);
      setBulkSubjects(list);
      setBulkOpen(true);
    },
    [accessToken, activeProfileId, coverageQ.data?.items, farmId, t]
  );

  const onBulkSuccess = useCallback(
    (count: number) => {
      void qc.invalidateQueries({ queryKey: ["farmVaccineCoverage", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmVaccineSubjects", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmHealthOverview", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmHealthEvents", farmId] });
      void invalidateAIInsights(farmId, "sante");
      modal.open("success", {
        title: t("health.vaccines.successTitle"),
        message: t("health.vaccines.successMessage", { count })
      });
    },
    [farmId, modal, qc, t]
  );

  const customMut = useMutation({
    mutationFn: () => {
      const targetLabel =
        TARGET_OPTIONS.filter((o) => customTarget.includes(o.key))
          .map((o) => t(o.labelKey))
          .join(", ") || t("health.vaccines.targetAll");
      return createFarmCustomVaccine(
        accessToken,
        farmId,
        {
          name: customName.trim(),
          vaccineType: customType,
          targetCategories: customTarget,
          targetLabel,
          frequency: customFreq.trim() || "—",
          recommendedTiming: customTiming.trim() || "—",
          notes: customNotes.trim() || undefined
        },
        activeProfileId
      );
    },
    onSuccess: () => {
      setCustomOpen(false);
      setCustomName("");
      setCustomFreq("");
      setCustomTiming("");
      setCustomNotes("");
      void qc.invalidateQueries({ queryKey: ["farmVaccineCoverage", farmId] });
    },
    onError: (e: Error) => Alert.alert(t("health.errorTitle"), getUserFacingError(e, t))
  });

  const toggleTarget = (key: string) => {
    setCustomTarget((prev) => {
      if (key === "all") {
        return ["all"];
      }
      const withoutAll = prev.filter((k) => k !== "all");
      if (withoutAll.includes(key)) {
        const next = withoutAll.filter((k) => k !== key);
        return next.length ? next : ["all"];
      }
      return [...withoutAll, key];
    });
  };

  if (coverageQ.isPending) {
    return <ActivityIndicator color={mobileColors.accent} style={{ marginTop: 24 }} />;
  }
  if (coverageQ.error) {
    return (
      <Text style={styles.err}>{(coverageQ.error as Error).message}</Text>
    );
  }

  return (
    <View style={styles.wrap}>
      {(coverageQ.data?.items ?? []).map((item) => {
        const active =
          highlightName != null &&
          item.vaccine.name.trim().toLowerCase() === highlightName;
        return (
          <HighlightWrapper key={item.vaccine.id} active={active}>
            <VaccineCard
              item={item}
              farmId={farmId}
              accessToken={accessToken}
              activeProfileId={activeProfileId}
              livestockMode={livestockMode}
              onBulkVaccinate={(id, subs) => void openBulk(id, subs)}
            />
          </HighlightWrapper>
        );
      })}
      <Pressable style={styles.addCustom} onPress={() => setCustomOpen(true)}>
        <Text style={styles.addCustomTx}>➕ {t("health.vaccines.addCustom")}</Text>
      </Pressable>

      {bulkVaccine ? (
        <BulkVaccineModal
          visible={bulkOpen}
          onClose={() => setBulkOpen(false)}
          farmId={farmId}
          accessToken={accessToken}
          activeProfileId={activeProfileId}
          vaccine={bulkVaccine}
          initialSubjects={bulkSubjects}
          onSuccess={onBulkSuccess}
        />
      ) : null}

      <BaseModal
        visible={customOpen}
        onClose={() => setCustomOpen(false)}
        title={t("health.vaccines.addCustom")}
        footerPrimary={
          <Pressable
            style={[
              styles.saveBtn,
              (!customName.trim() || customMut.isPending) && styles.saveDisabled
            ]}
            disabled={!customName.trim() || customMut.isPending}
            onPress={() => customMut.mutate()}
          >
            <Text style={styles.saveTx}>{t("health.save")}</Text>
          </Pressable>
        }
      >
        <Text style={styles.lab}>{t("health.fieldVaccineName")}</Text>
        <TextInput style={styles.input} value={customName} onChangeText={setCustomName} />
        <Text style={styles.lab}>{t("health.fieldVaccineType")}</Text>
        <View style={styles.row}>
          {VACCINE_TYPES.map((vt) => (
            <Pressable
              key={vt}
              style={[styles.chip, customType === vt && styles.chipOn]}
              onPress={() => setCustomType(vt)}
            >
              <Text style={styles.chipTx}>
                {t(`health.vaccines.type.${vt}` as const)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.lab}>{t("health.vaccines.customTarget")}</Text>
        <View style={styles.row}>
          {TARGET_OPTIONS.map((o) => (
            <Pressable
              key={o.key}
              style={[styles.chip, customTarget.includes(o.key) && styles.chipOn]}
              onPress={() => toggleTarget(o.key)}
            >
              <Text style={styles.chipTx}>{t(o.labelKey)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.lab}>{t("health.vaccines.customFrequency")}</Text>
        <TextInput style={styles.input} value={customFreq} onChangeText={setCustomFreq} />
        <Text style={styles.lab}>{t("health.vaccines.customTiming")}</Text>
        <TextInput
          style={styles.input}
          value={customTiming}
          onChangeText={setCustomTiming}
        />
        <Text style={styles.lab}>{t("health.fieldNotes")}</Text>
        <TextInput
          style={[styles.input, styles.notes]}
          value={customNotes}
          onChangeText={setCustomNotes}
          multiline
        />
      </BaseModal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: mobileSpacing.sm },
  err: { color: mobileColors.error },
  addCustom: {
    alignItems: "center",
    paddingVertical: mobileSpacing.lg,
    marginBottom: mobileSpacing.xl
  },
  addCustomTx: {
    color: mobileColors.accent,
    fontWeight: "700",
    fontSize: mobileFontSize.md
  },
  lab: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: 4,
    marginTop: mobileSpacing.sm
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.sm,
    padding: mobileSpacing.sm,
    color: mobileColors.textPrimary
  },
  notes: { minHeight: 72, textAlignVertical: "top" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.xs },
  chip: {
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 6,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  chipOn: {
    borderColor: mobileColors.accent,
    backgroundColor: `${mobileColors.accent}14`
  },
  chipTx: { fontSize: mobileFontSize.sm, color: mobileColors.textPrimary },
  saveBtn: {
    backgroundColor: mobileColors.accent,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.sm,
    alignItems: "center"
  },
  saveDisabled: { opacity: 0.5 },
  saveTx: { color: mobileColors.onAccent, fontWeight: "700" }
});
