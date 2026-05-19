import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { BaseModal } from "../../modals/BaseModal";
import { useModal } from "../../modals/useModal";
import type { AnimalListItem } from "../../../lib/api";
import {
  createAnimal,
  fetchTaxonomy,
  postAnimalWeight
} from "../../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import { suggestNextTagCode } from "./animalUtils";

type Props = {
  visible: boolean;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  animals: AnimalListItem[];
  onClose: () => void;
  onCreated: () => void;
};

export function CreateAnimalModal({
  visible,
  farmId,
  accessToken,
  activeProfileId,
  animals,
  onClose,
  onCreated
}: Props) {
  const { t } = useTranslation();
  const { open } = useModal();

  const [tagCode, setTagCode] = useState("");
  const [breedId, setBreedId] = useState<string | null>(null);
  const [sex, setSex] = useState<"male" | "female">("female");
  const [birthDate, setBirthDate] = useState("");
  const [entryWeight, setEntryWeight] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (visible) {
      setTagCode(suggestNextTagCode(animals));
      setBreedId(null);
      setSex("female");
      setBirthDate("");
      setEntryWeight("");
      setNotes("");
    }
  }, [visible, animals]);

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

  const saveMut = useMutation({
    mutationFn: async () => {
      const tag = tagCode.trim();
      if (!tag) {
        throw new Error(t("cheptel.animals.create.tagRequired"));
      }
      const created = await createAnimal(
        accessToken,
        farmId,
        {
          tagCode: tag,
          breedId: breedId ?? undefined,
          sex,
          birthDate: birthDate.trim() || undefined,
          notes: notes.trim() || undefined,
          speciesId: porcSpecies?.id
        },
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
    onSuccess: () => {
      onCreated();
      onClose();
      open("success", {
        message: t("cheptel.animals.create.success"),
        autoDismissMs: 2200
      });
    },
    onError: (e: Error) => {
      Alert.alert(t("cheptel.animals.create.errorTitle"), e.message);
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
          disabled={saveMut.isPending}
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
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.form}
      >
        <Text style={styles.label}>{t("cheptel.animals.create.tag")} *</Text>
        <TextInput
          style={styles.input}
          value={tagCode}
          onChangeText={setTagCode}
          autoCapitalize="characters"
        />

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

        <Text style={styles.label}>{t("cheptel.animals.create.birthDate")}</Text>
        <TextInput
          style={styles.input}
          value={birthDate}
          onChangeText={setBirthDate}
          placeholder="AAAA-MM-JJ"
          placeholderTextColor={mobileColors.textSecondary}
        />

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
      </ScrollView>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  form: { gap: mobileSpacing.sm, paddingBottom: mobileSpacing.lg },
  label: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm
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
