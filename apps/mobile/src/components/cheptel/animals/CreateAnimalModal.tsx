import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getUserFacingError } from "../../../lib/userFacingError";
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
import { useModal } from "../../modals/useModal";
import {
  createAnimal,
  fetchNextAnimalNumber,
  fetchTaxonomy,
  postAnimalWeight,
  type AnimalDetail,
  type CreateAnimalPayload
} from "../../../lib/api";
import {
  offlineQueuedMessage,
  useOfflineMutation
} from "../../../hooks/useOfflineMutation";
import { optimisticCreateAnimal } from "../../../lib/offline/optimistic";
import { isOfflineQueuedResult } from "../../../lib/offline/types";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import {
  defaultSexForCategory,
  tagPrefixForCategory,
  type CreateAnimalCategoryKey
} from "./animalUtils";

export type CreateAnimalTargetPen = {
  penId: string;
  penName: string;
  barnId: string;
  barnName: string;
};

type Props = {
  visible: boolean;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  /** Loge de destination : placement automatique après création. */
  targetPen?: CreateAnimalTargetPen | null;
  onClose: () => void;
  onCreated: () => void;
};

const CATEGORY_OPTIONS: CreateAnimalCategoryKey[] = [
  "breeding_female",
  "breeding_male",
  "fattening",
  "starter"
];

export function CreateAnimalModal({
  visible,
  farmId,
  accessToken,
  activeProfileId,
  targetPen,
  onClose,
  onCreated
}: Props) {
  const { t } = useTranslation();
  const { open } = useModal();
  const qc = useQueryClient();

  const [category, setCategory] =
    useState<CreateAnimalCategoryKey>("breeding_female");
  const [tagCode, setTagCode] = useState("");
  const [breedId, setBreedId] = useState<string | null>(null);
  const [sex, setSex] = useState<"male" | "female">("female");
  const [birthDate, setBirthDate] = useState("");
  const [ageAtEntry, setAgeAtEntry] = useState("");
  const [entryWeight, setEntryWeight] = useState("");
  const [notes, setNotes] = useState("");

  const tagPrefix = tagPrefixForCategory(category);
  const isBreeder =
    category === "breeding_female" || category === "breeding_male";

  const nextTagQuery = useQuery({
    queryKey: ["nextAnimalNumber", farmId, tagPrefix, activeProfileId],
    queryFn: () =>
      fetchNextAnimalNumber(accessToken, farmId, tagPrefix, activeProfileId),
    enabled: visible
  });

  useEffect(() => {
    if (!visible) {
      return;
    }
    setCategory("breeding_female");
    setBreedId(null);
    setBirthDate("");
    setAgeAtEntry("");
    setEntryWeight("");
    setNotes("");
    setSex("female");
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const d = defaultSexForCategory(category);
    if (d === "female" || d === "male") {
      setSex(d);
    }
  }, [category, visible]);

  useEffect(() => {
    if (nextTagQuery.data?.tagCode) {
      setTagCode(nextTagQuery.data.tagCode);
    }
  }, [nextTagQuery.data?.tagCode]);

  const taxonomyQuery = useQuery({
    queryKey: ["taxonomy", activeProfileId],
    queryFn: () => fetchTaxonomy(accessToken, activeProfileId),
    enabled: visible
  });

  const porcSpecies = useMemo(() => {
    const list = taxonomyQuery.data ?? [];
    return list.find((s) => s.code === "porcin") ?? list[0];
  }, [taxonomyQuery.data]);

  const breeds = porcSpecies?.breeds ?? [];

  const categoryLabel = (key: CreateAnimalCategoryKey): string => {
    switch (key) {
      case "breeding_female":
        return t("cheptel.animals.create.categoryTrui");
      case "breeding_male":
        return t("cheptel.animals.create.categoryVer");
      case "fattening":
        return t("cheptel.animals.create.categoryEng");
      case "starter":
        return t("cheptel.animals.create.categoryDem");
    }
  };

  const buildPayload = (): CreateAnimalPayload => {
    const tag = tagCode.trim();
    if (!tag) {
      throw new Error(t("cheptel.animals.create.tagRequired"));
    }
    const payloadSex = isBreeder ? sex : ("unknown" as const);
    const ageRaw = ageAtEntry.trim()
      ? Number.parseInt(ageAtEntry, 10)
      : null;
    const ageWeeksAtEntry =
      birthDate.trim() || ageRaw == null || !Number.isFinite(ageRaw)
        ? undefined
        : Math.max(0, ageRaw);
    return {
      tagCode: tag,
      breedId: breedId ?? undefined,
      sex: payloadSex,
      productionCategory: category,
      birthDate: birthDate.trim() || undefined,
      ageWeeksAtEntry,
      notes: notes.trim() || undefined,
      speciesId: porcSpecies?.id
    };
  };

  const saveMut = useOfflineMutation({
    farmId,
    type: "cheptel.createAnimal",
    label: tagCode.trim() || t("cheptel.animals.create.title"),
    assignLocalEntityId: true,
    mutationFn: async () => {
      const payload = buildPayload();
      const created = await createAnimal(
        accessToken,
        farmId,
        payload,
        activeProfileId
      );
      const w = Number.parseFloat(entryWeight.replace(",", "."));
      if (Number.isFinite(w) && w > 0) {
        await postAnimalWeight(
          accessToken,
          farmId,
          created.id,
          { weightKg: w },
          activeProfileId
        );
      }
      return created;
    },
    buildOfflineItem: () => {
      const payload = buildPayload();
      const w = Number.parseFloat(entryWeight.replace(",", "."));
      const calls: Array<{
        method: "POST";
        path: string;
        body: unknown;
      }> = [
        {
          method: "POST",
          path: `/farms/${farmId}/animals`,
          body: payload
        }
      ];
      if (Number.isFinite(w) && w > 0) {
        calls.push({
          method: "POST",
          path: `/farms/${farmId}/animals/{{0.id}}/weights`,
          body: { weightKg: w }
        });
      }
      return {
        calls,
        invalidateRoots: [
          "farmAnimals",
          "farmCheptel",
          "cheptelPens",
          "cheptelHistory"
        ]
      };
    },
    applyOptimistic: (_v, queueItemId) => {
      optimisticCreateAnimal(
        qc,
        farmId,
        activeProfileId,
        queueItemId,
        buildPayload(),
        porcSpecies?.name
      );
    },
    onSuccess: (data) => {
      onCreated();
      onClose();
      open("success", {
        message: isOfflineQueuedResult(data)
          ? offlineQueuedMessage(t)
          : t("cheptel.animals.create.success"),
        autoDismissMs: 2200
      });
    },
    onQueued: () => {
      onCreated();
      onClose();
      open("success", {
        message: offlineQueuedMessage(t),
        autoDismissMs: 2600
      });
    },
    onError: (e: Error) => {
      Alert.alert(t("cheptel.animals.create.errorTitle"), getUserFacingError(e, t));
    }
  });

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("cheptel.animals.create.title")}
      footerPrimary={
        <Pressable
          style={[styles.primaryBtn, saveMut.isPending && styles.btnDisabled]}
          onPress={() => saveMut.mutate()}
          disabled={saveMut.isPending || nextTagQuery.isPending}
        >
          {saveMut.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>
              {t("cheptel.animals.create.submit")}
            </Text>
          )}
        </Pressable>
      }
    >
      {targetPen ? (
        <ModalSection title={t("modals.sections.destination")}>
          <Text style={styles.placementHint}>
            {t("cheptel.animals.create.targetPen", {
              barn: targetPen.barnName,
              pen: targetPen.penName
            })}
          </Text>
        </ModalSection>
      ) : null}

      <ModalSection title={t("modals.sections.identification")}>
        <Text style={styles.label}>{t("cheptel.animals.create.category")} *</Text>
        <View style={styles.pillRow}>
          {CATEGORY_OPTIONS.map((key) => (
            <Pressable
              key={key}
              style={[styles.pill, category === key && styles.pillOn]}
              onPress={() => setCategory(key)}
            >
              <Text
                style={[
                  styles.pillText,
                  category === key && styles.pillTextOn
                ]}
              >
                {categoryLabel(key)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>{t("cheptel.animals.create.tag")} *</Text>
        {nextTagQuery.isPending ? (
          <ActivityIndicator color={mobileColors.accent} />
        ) : (
          <TextInput
            style={styles.input}
            value={tagCode}
            onChangeText={setTagCode}
            autoCapitalize="characters"
          />
        )}

        <Text style={styles.label}>{t("cheptel.animals.create.breed")} *</Text>
        {taxonomyQuery.isPending ? (
          <ActivityIndicator color={mobileColors.accent} />
        ) : (
          <View style={styles.pillRow}>
            {breeds.map((b) => (
              <Pressable
                key={b.id}
                style={[styles.pill, breedId === b.id && styles.pillOn]}
                onPress={() => setBreedId(b.id)}
              >
                <Text
                  style={[
                    styles.pillText,
                    breedId === b.id && styles.pillTextOn
                  ]}
                >
                  {b.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {isBreeder ? (
          <>
            <Text style={styles.label}>{t("cheptel.animals.create.sex")} *</Text>
            <View style={styles.pillRow}>
              {(["female", "male"] as const).map((s) => (
                <Pressable
                  key={s}
                  style={[styles.pill, sex === s && styles.pillOn]}
                  onPress={() => setSex(s)}
                >
                  <Text style={[styles.pillText, sex === s && styles.pillTextOn]}>
                    {s === "male"
                      ? t("cheptel.animals.sexMale")
                      : t("cheptel.animals.sexFemale")}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.hint}>{t("cheptel.unknownSex")}</Text>
        )}
      </ModalSection>

      <ModalSection title={t("modals.sections.details")}>
        <AppDatePicker
          label={t("cheptel.animals.create.birthDate")}
          helper={t("cheptel.animals.create.birthDateHelper")}
          isoValue={birthDate}
          onIsoChange={setBirthDate}
          farmId={farmId}
          maxDate={new Date()}
        />

        {!birthDate.trim() ? (
          <>
            <Text style={styles.label}>
              {t("cheptel.animals.create.ageAtEntry")}
            </Text>
            <Text style={styles.hint}>
              {t("cheptel.animals.create.ageAtEntryHelper")}
            </Text>
            <TextInput
              style={styles.input}
              value={ageAtEntry}
              onChangeText={setAgeAtEntry}
              keyboardType="number-pad"
              placeholder="8"
              placeholderTextColor={mobileColors.textSecondary}
            />
          </>
        ) : null}

        <Text style={styles.label}>{t("cheptel.animals.create.entryWeight")}</Text>
        <TextInput
          style={styles.input}
          value={entryWeight}
          onChangeText={setEntryWeight}
          keyboardType="decimal-pad"
          placeholder="kg"
          placeholderTextColor={mobileColors.textSecondary}
        />

        <Text style={styles.label}>{t("cheptel.animals.create.notes")}</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </ModalSection>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  placementHint: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontWeight: "600"
  },
  label: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: mobileColors.textSecondary
  },
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontStyle: "italic"
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
  multiline: { minHeight: 72, textAlignVertical: "top" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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
  primaryBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 }
});
