import { useQuery } from "@tanstack/react-query";
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
import { AppDatePicker } from "../../common/AppDatePicker";
import { ModalSection } from "../../modals/ModalSection";
import {
  fetchTaxonomy,
  type AnimalOriginDto,
  type CheptelPenRowDto
} from "../../../lib/api";
import { useCheptelPens } from "../../../lib/cheptelPensQuery";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../../theme/mobileTheme";
import {
  defaultSexForCategory,
  tagPrefixForCategory,
  type CreateAnimalCategoryKey
} from "./animalUtils";
import { NomenclaturePreview } from "./NomenclaturePreview";
import type { BulkAddFormState } from "./BulkAddAnimalsModal";
import { producerColors } from "../../../theme/producerTheme";
import { merchantColors } from "../../../theme/merchantTheme";

const CATEGORY_OPTIONS: CreateAnimalCategoryKey[] = [
  "fattening",
  "starter",
  "breeding_female",
  "breeding_male"
];

type Props = {
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  form: BulkAddFormState;
  onChange: (patch: Partial<BulkAddFormState>) => void;
  fixedPen?: { penId: string; penName: string; barnName: string } | null;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function BulkAddStep1({
  farmId,
  accessToken,
  activeProfileId,
  form,
  onChange,
  fixedPen
}: Props) {
  const { t } = useTranslation();
  const [breedFilter, setBreedFilter] = useState("");

  const pensQ = useCheptelPens({
    farmId,
    accessToken,
    activeProfileId,
    enabled: !fixedPen
  });

  const taxonomyQ = useQuery({
    queryKey: ["taxonomy", activeProfileId],
    queryFn: () => fetchTaxonomy(accessToken, activeProfileId)
  });

  const porcSpecies = useMemo(() => {
    const list = taxonomyQ.data ?? [];
    return list.find((s) => s.code === "porcin") ?? list[0];
  }, [taxonomyQ.data]);

  const breeds = porcSpecies?.breeds ?? [];
  const filteredBreeds = useMemo(() => {
    const q = breedFilter.trim().toLowerCase();
    if (!q) {
      return breeds;
    }
    return breeds.filter((b) => b.name.toLowerCase().includes(q));
  }, [breeds, breedFilter]);

  const selectedPen: CheptelPenRowDto | null = useMemo(() => {
    if (fixedPen) {
      const p = pensQ.data?.pens.find((x) => x.id === fixedPen.penId);
      if (p) {
        return p;
      }
      return {
        id: fixedPen.penId,
        name: fixedPen.penName,
        barnName: fixedPen.barnName,
        capacity: 0,
        occupancy: 0
      } as CheptelPenRowDto;
    }
    if (!form.penId) {
      return null;
    }
    return pensQ.data?.pens.find((p) => p.id === form.penId) ?? null;
  }, [fixedPen, form.penId, pensQ.data]);

  const freeSlots = useMemo(() => {
    if (!selectedPen) {
      return null;
    }
    const cap = selectedPen.capacity ?? 0;
    const occ = selectedPen.occupancy ?? 0;
    if (cap <= 0) {
      return null;
    }
    return Math.max(0, cap - occ);
  }, [selectedPen]);

  const isBreeder =
    form.category === "breeding_female" ||
    form.category === "breeding_male";
  const forcedSex = defaultSexForCategory(form.category);
  const tagPrefix = tagPrefixForCategory(form.category);

  const categoryLabel = (key: CreateAnimalCategoryKey): string => {
    switch (key) {
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

  const adjustCount = (delta: number) => {
    const next = Math.min(200, Math.max(2, form.count + delta));
    onChange({ count: next });
  };

  const showCapacityWarning =
    freeSlots != null && form.count > freeSlots && freeSlots >= 0;

  return (
    <>
      <ModalSection title={t("cheptel.animals.bulk.step1Title")}>
        {fixedPen ? (
          <Text style={styles.penLine}>
            {t("cheptel.animals.bulk.penFixed", {
              pen: fixedPen.penName,
              barn: fixedPen.barnName,
              free:
                freeSlots != null
                  ? t("cheptel.animals.bulk.freeSlots", { count: freeSlots })
                  : "—"
            })}
          </Text>
        ) : (
          <>
            <Text style={styles.label}>{t("cheptel.animals.bulk.pen")}</Text>
            {pensQ.isPending ? (
              <ActivityIndicator color={mobileColors.accent} />
            ) : (
              <View style={styles.pillRow}>
                {(pensQ.data?.pens ?? []).map((p) => {
                  const cap = p.capacity ?? 0;
                  const occ = p.occupancy ?? 0;
                  const free = cap > 0 ? Math.max(0, cap - occ) : null;
                  return (
                    <Pressable
                      key={p.id}
                      style={[styles.pill, form.penId === p.id && styles.pillOn]}
                      onPress={() => onChange({ penId: p.id })}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          form.penId === p.id && styles.pillTextOn
                        ]}
                      >
                        {p.name}
                        {free != null
                          ? ` (${t("cheptel.animals.bulk.freeSlotsShort", { count: free })})`
                          : ""}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        )}

        <Text style={styles.label}>{t("cheptel.animals.bulk.category")} *</Text>
        <View style={styles.pillRow}>
          {CATEGORY_OPTIONS.map((key) => (
            <Pressable
              key={key}
              style={[styles.pill, form.category === key && styles.pillOn]}
              onPress={() => {
                const sex = defaultSexForCategory(key);
                onChange({
                  category: key,
                  sex:
                    sex === "male" || sex === "female" ? sex : form.sex
                });
              }}
            >
              <Text
                style={[
                  styles.pillText,
                  form.category === key && styles.pillTextOn
                ]}
              >
                {categoryLabel(key)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>{t("cheptel.animals.bulk.count")} *</Text>
        <View style={styles.stepperRow}>
          <Pressable
            style={styles.stepBtn}
            onPress={() => adjustCount(-1)}
            accessibilityLabel={t("cheptel.animals.bulk.decrease")}
          >
            <Text style={styles.stepBtnTx}>−</Text>
          </Pressable>
          <TextInput
            style={styles.countInput}
            value={String(form.count)}
            onChangeText={(v) => {
              const n = Number.parseInt(v, 10);
              if (Number.isFinite(n)) {
                onChange({ count: Math.min(200, Math.max(2, n)) });
              }
            }}
            keyboardType="number-pad"
          />
          <Pressable
            style={styles.stepBtn}
            onPress={() => adjustCount(1)}
            accessibilityLabel={t("cheptel.animals.bulk.increase")}
          >
            <Text style={styles.stepBtnTx}>+</Text>
          </Pressable>
        </View>
        <NomenclaturePreview
          farmId={farmId}
          accessToken={accessToken}
          activeProfileId={activeProfileId}
          prefix={tagPrefix}
          count={form.count}
        />
        {showCapacityWarning ? (
          <View style={styles.warnBox}>
            <Text style={styles.warnTx}>
              {t("cheptel.animals.bulk.capacityWarning", {
                free: freeSlots,
                extra: form.count - (freeSlots ?? 0)
              })}
            </Text>
          </View>
        ) : null}

        <Text style={styles.label}>{t("cheptel.animals.bulk.sex")}</Text>
        {isBreeder ? (
          <Text style={styles.hint}>
            {forcedSex === "female"
              ? t("cheptel.animals.sexFemale")
              : t("cheptel.animals.sexMale")}
          </Text>
        ) : (
          <View style={styles.pillRow}>
            {(["unknown", "male", "female"] as const).map((s) => (
              <Pressable
                key={s}
                style={[styles.pill, form.sex === s && styles.pillOn]}
                onPress={() => onChange({ sex: s })}
              >
                <Text
                  style={[styles.pillText, form.sex === s && styles.pillTextOn]}
                >
                  {s === "male"
                    ? t("cheptel.animals.sexMale")
                    : s === "female"
                      ? t("cheptel.animals.sexFemale")
                      : t("cheptel.animals.bulk.sexUnknown")}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.label}>{t("cheptel.animals.bulk.breed")}</Text>
        <TextInput
          style={styles.input}
          value={breedFilter}
          onChangeText={setBreedFilter}
          placeholder={t("cheptel.animals.bulk.breedPlaceholder")}
          placeholderTextColor={mobileColors.textSecondary}
        />
        {taxonomyQ.isPending ? (
          <ActivityIndicator color={mobileColors.accent} />
        ) : (
          <View style={styles.pillRow}>
            {filteredBreeds.slice(0, 12).map((b) => (
              <Pressable
                key={b.id}
                style={[styles.pill, form.breedId === b.id && styles.pillOn]}
                onPress={() => onChange({ breedId: b.id })}
              >
                <Text
                  style={[
                    styles.pillText,
                    form.breedId === b.id && styles.pillTextOn
                  ]}
                >
                  {b.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.label}>{t("cheptel.animals.bulk.entryWeight")}</Text>
        <TextInput
          style={styles.input}
          value={form.entryWeight}
          onChangeText={(v) => onChange({ entryWeight: v })}
          keyboardType="decimal-pad"
          placeholder="kg"
          placeholderTextColor={mobileColors.textSecondary}
        />

        <Text style={styles.label}>{t("cheptel.animals.bulk.entryAge")}</Text>
        <TextInput
          style={styles.input}
          value={form.ageWeeks}
          onChangeText={(v) => onChange({ ageWeeks: v })}
          keyboardType="number-pad"
          placeholder={t("cheptel.animals.bulk.entryAgePlaceholder")}
          placeholderTextColor={mobileColors.textSecondary}
        />

        <AppDatePicker
          label={t("cheptel.animals.bulk.entryDate")}
          isoValue={form.entryDate || todayIso()}
          onIsoChange={(iso) => onChange({ entryDate: iso })}
          farmId={farmId}
          maxDate={new Date()}
        />

        <Text style={styles.label}>{t("cheptel.animals.bulk.origin")} *</Text>
        <View style={styles.pillRow}>
          {(
            [
              ["farm_born", t("cheptel.animals.bulk.originFarm")],
              ["purchased", t("cheptel.animals.bulk.originPurchased")]
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              style={[styles.pill, form.origin === value && styles.pillOn]}
              onPress={() =>
                onChange({
                  origin: value as AnimalOriginDto,
                  supplier: value === "farm_born" ? "" : form.supplier
                })
              }
            >
              <Text
                style={[
                  styles.pillText,
                  form.origin === value && styles.pillTextOn
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {form.origin === "purchased" ? (
          <>
            <Text style={styles.label}>{t("cheptel.animals.bulk.supplier")}</Text>
            <TextInput
              style={styles.input}
              value={form.supplier}
              onChangeText={(v) => onChange({ supplier: v })}
              placeholderTextColor={mobileColors.textSecondary}
            />
          </>
        ) : null}
      </ModalSection>
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: mobileColors.textSecondary,
    marginTop: 8
  },
  hint: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontWeight: "600"
  },
  penLine: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontWeight: "600"
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
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.background
  },
  pillOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  pillText: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  pillTextOn: { color: mobileColors.accent, fontWeight: "700" },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: mobileColors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobileColors.background
  },
  stepBtnTx: { fontSize: mobileFontSize.xl, fontWeight: "700", color: mobileColors.accent },
  countInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingVertical: 10,
    textAlign: "center",
    ...mobileTypography.title,
    fontSize: mobileFontSize.lg,
    color: mobileColors.textPrimary
  },
  warnBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: mobileRadius.md,
    backgroundColor: producerColors.kpiAmberSoft
  },
  warnTx: {
    ...mobileTypography.meta,
    color: merchantColors.amberText
  }
});
