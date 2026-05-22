import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { BaseModal } from "../../modals/BaseModal";
import { useModal } from "../../modals/useModal";
import type { AnimalListItem, AnimalOriginDto } from "../../../lib/api";
import {
  fetchFarmAnimal,
  fetchFarmAnimals,
  fetchTaxonomy,
  updateAnimal
} from "../../../lib/api";
import { getSupabase } from "../../../lib/supabase";
import { uploadAnimalPhotoToSupabase } from "../../../lib/uploadAnimalPhotoToSupabase";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import {
  animalDisplayTag,
  breederCategoryForSex,
  formatAnimalKg,
  sexDisplayLabel,
  sexIconColor,
  sexIconName,
  shouldSuggestBreederReclass
} from "./animalUtils";

type Props = {
  visible: boolean;
  animal: AnimalListItem | null;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  onClose: () => void;
  onUpdated?: () => void;
  onTransfer: (animal: AnimalListItem) => void;
  onChangeStatus: (animal: AnimalListItem) => void;
  onAddWeight: (animal: AnimalListItem) => void;
  onOpenHealth?: (animal: AnimalListItem) => void;
  onOpenFullRecord?: (animal: AnimalListItem) => void;
};

const ORIGIN_OPTIONS: AnimalOriginDto[] = ["farm_born", "purchased"];

function formatBirthInput(iso: string | null | undefined): string {
  if (!iso) {
    return "";
  }
  return iso.slice(0, 10);
}

export function AnimalDetailModal({
  visible,
  animal,
  farmId,
  accessToken,
  activeProfileId,
  onClose,
  onUpdated,
  onTransfer,
  onChangeStatus,
  onAddWeight,
  onOpenHealth,
  onOpenFullRecord
}: Props) {
  const { t } = useTranslation();
  const { open } = useModal();
  const queryClient = useQueryClient();

  const [breedId, setBreedId] = useState<string | null>(null);
  const [birthDate, setBirthDate] = useState("");
  const [origin, setOrigin] = useState<AnimalOriginDto | null>(null);
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [damId, setDamId] = useState<string | null>(null);
  const [sireId, setSireId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [sexEditOpen, setSexEditOpen] = useState(false);
  const [pendingSex, setPendingSex] = useState<"male" | "female">("female");

  const detailQuery = useQuery({
    queryKey: ["farmAnimal", farmId, animal?.id, activeProfileId],
    queryFn: () =>
      fetchFarmAnimal(accessToken, farmId, animal!.id, activeProfileId),
    enabled: visible && Boolean(animal?.id)
  });

  const taxonomyQuery = useQuery({
    queryKey: ["taxonomy", activeProfileId],
    queryFn: () => fetchTaxonomy(accessToken, activeProfileId),
    enabled: visible
  });

  const herdQuery = useQuery({
    queryKey: ["farmAnimals", farmId, activeProfileId],
    queryFn: () => fetchFarmAnimals(accessToken, farmId, activeProfileId),
    enabled: visible
  });

  const syncFormFromDetail = useCallback(() => {
    const d = detailQuery.data;
    if (!d) {
      return;
    }
    setBreedId(d.breed?.id ?? null);
    setBirthDate(formatBirthInput(d.birthDate));
    setOrigin(d.origin ?? null);
    setSupplier(d.supplier ?? "");
    setNotes(d.notes ?? "");
    setDamId(d.damId ?? d.dam?.id ?? null);
    setSireId(d.sireId ?? d.sire?.id ?? null);
    setPhotoUrl(d.photoUrl ?? null);
    setPendingPhotoUri(null);
    setSexEditOpen(false);
    if (d.sex === "male" || d.sex === "female") {
      setPendingSex(d.sex);
    }
  }, [detailQuery.data]);

  useEffect(() => {
    if (visible && detailQuery.isSuccess) {
      syncFormFromDetail();
    }
  }, [visible, detailQuery.isSuccess, syncFormFromDetail]);

  useEffect(() => {
    if (!visible) {
      setPendingPhotoUri(null);
      setSexEditOpen(false);
    }
  }, [visible]);

  const porcSpecies = useMemo(() => {
    const list = taxonomyQuery.data ?? [];
    return list.find((s) => s.code === "porcin") ?? list[0];
  }, [taxonomyQuery.data]);

  const breeds = porcSpecies?.breeds ?? [];

  const damCandidates = useMemo(() => {
    const list = herdQuery.data ?? [];
    return list.filter(
      (a) =>
        a.id !== animal?.id &&
        a.status === "active" &&
        (a.sex === "female" ||
          a.productionCategory === "breeding_female" ||
          /^Trui-/i.test(a.tagCode ?? ""))
    );
  }, [herdQuery.data, animal?.id]);

  const sireCandidates = useMemo(() => {
    const list = herdQuery.data ?? [];
    return list.filter(
      (a) =>
        a.id !== animal?.id &&
        a.status === "active" &&
        (a.sex === "male" ||
          a.productionCategory === "breeding_male" ||
          /^Ver-/i.test(a.tagCode ?? ""))
    );
  }, [herdQuery.data, animal?.id]);

  const resolvedSex = detailQuery.data?.sex ?? animal?.sex ?? "unknown";
  const productionCategory =
    detailQuery.data?.productionCategory ?? animal?.productionCategory;
  const showSexEditor = resolvedSex === "unknown" || sexEditOpen;
  const displayPhoto = pendingPhotoUri ?? photoUrl;

  const pickPhoto = async (source: "library" | "camera") => {
    const perm =
      source === "library"
        ? await ImagePicker.requestMediaLibraryPermissionsAsync()
        : await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      return;
    }
    const result =
      source === "library"
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85
          })
        : await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85
          });
    if (!result.canceled && result.assets[0]?.uri) {
      setPendingPhotoUri(result.assets[0].uri);
    }
  };

  const openPhotoMenu = () => {
    Alert.alert(
      t("cheptel.animals.detail.photoTitle"),
      t("cheptel.animals.detail.photoMessage"),
      [
        {
          text: t("cheptel.animals.detail.photoGallery"),
          onPress: () => void pickPhoto("library")
        },
        {
          text: t("cheptel.animals.detail.photoCamera"),
          onPress: () => void pickPhoto("camera")
        },
        { text: t("producer.cancelPhoto"), style: "cancel" }
      ]
    );
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!animal) {
        throw new Error("Animal manquant");
      }
      let nextPhotoUrl = photoUrl;
      if (pendingPhotoUri) {
        const supabase = getSupabase();
        if (!supabase) {
          throw new Error(t("cheptel.animals.detail.photoUploadUnavailable"));
        }
        try {
          nextPhotoUrl = await uploadAnimalPhotoToSupabase(
            supabase,
            farmId,
            animal.id,
            pendingPhotoUri,
            "image/jpeg"
          );
        } catch {
          throw new Error(t("cheptel.animals.detail.photoUploadError"));
        }
      }

      const sexPayload: "male" | "female" | "unknown" | undefined =
        resolvedSex === "unknown" && sexEditOpen
          ? pendingSex
          : resolvedSex === "unknown" && !sexEditOpen
            ? undefined
            : resolvedSex === "male" || resolvedSex === "female"
              ? resolvedSex
              : undefined;

      if (resolvedSex === "unknown" && !sexEditOpen) {
        throw new Error(t("cheptel.animals.detail.sexRequired"));
      }

      return updateAnimal(
        accessToken,
        farmId,
        animal.id,
        {
          breedId,
          birthDate: birthDate.trim() || null,
          origin,
          supplier: origin === "purchased" ? supplier.trim() || null : null,
          photoUrl: nextPhotoUrl,
          damId: origin === "farm_born" ? damId : null,
          sireId: origin === "farm_born" ? sireId : null,
          notes: notes.trim() || null,
          ...(sexPayload ? { sex: sexPayload } : {})
        },
        activeProfileId
      );
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: ["farmAnimal", farmId, animal?.id]
      });
      onUpdated?.();
      setPhotoUrl(data.photoUrl ?? null);
      setPendingPhotoUri(null);
      setSexEditOpen(false);
      open("success", {
        message: t("cheptel.animals.detail.saved"),
        autoDismissMs: 2200
      });

      const newSex = data.sex;
      if (
        (newSex === "male" || newSex === "female") &&
        shouldSuggestBreederReclass(productionCategory, newSex)
      ) {
        Alert.alert(
          t("cheptel.animals.detail.reclassifyTitle"),
          t("cheptel.animals.detail.reclassifyMessage"),
          [
            {
              text: t("cheptel.animals.detail.reclassifyNo"),
              style: "cancel"
            },
            {
              text: t("cheptel.animals.detail.reclassifyYes"),
              onPress: () => {
                void updateAnimal(
                  accessToken,
                  farmId,
                  animal!.id,
                  { productionCategory: breederCategoryForSex(newSex) },
                  activeProfileId
                ).then(() => {
                  onUpdated?.();
                  void queryClient.invalidateQueries({
                    queryKey: ["farmAnimal", farmId, animal?.id]
                  });
                });
              }
            }
          ]
        );
      }
    },
    onError: (e: Error) => {
      Alert.alert(t("cheptel.animals.detail.saveErrorTitle"), e.message);
    }
  });

  if (!animal) {
    return null;
  }

  const tag = animalDisplayTag(animal);
  const detail = detailQuery.data;
  const latest = detail?.weights[0] ?? animal.weights[0];
  const entry = detail?.weights[detail.weights.length - 1];

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={tag}
      statusBadge={{
        label: t(`cheptel.animals.status.${animal.status}`),
        tone: animal.status === "active" ? "neutral" : "warning"
      }}
      footerPrimary={
        <Pressable
          style={[styles.primaryBtn, saveMut.isPending && styles.btnDisabled]}
          onPress={() => saveMut.mutate()}
          disabled={saveMut.isPending || detailQuery.isPending}
        >
          {saveMut.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>
              {t("cheptel.animals.detail.save")}
            </Text>
          )}
        </Pressable>
      }
    >
      {detailQuery.isPending ? (
        <ActivityIndicator color={mobileColors.accent} style={{ marginVertical: 24 }} />
      ) : (
        <View style={styles.body}>
          <Text style={styles.sectionTitle}>
            {t("cheptel.animals.detail.identity")}
          </Text>

          <View style={styles.photoRow}>
            <Pressable
              style={styles.photoCircle}
              onPress={openPhotoMenu}
              accessibilityRole="button"
              accessibilityLabel={t("cheptel.animals.detail.photoA11y")}
            >
              {displayPhoto ? (
                <Image source={{ uri: displayPhoto }} style={styles.photoImage} />
              ) : (
                <Ionicons
                  name={sexIconName(resolvedSex)}
                  size={36}
                  color={sexIconColor(resolvedSex)}
                />
              )}
              <View style={styles.photoBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{t("cheptel.animals.detail.pen")}</Text>
              <Text style={styles.rowValue}>
                {animal.currentPen
                  ? `${animal.currentPen.barnName} · ${animal.currentPen.penName}`
                  : t("cheptel.animals.noPen")}
              </Text>
            </View>
          </View>

          <Text style={styles.label}>{t("cheptel.animals.detail.breed")}</Text>
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
                    style={[styles.pillText, breedId === b.id && styles.pillTextOn]}
                  >
                    {b.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <Text style={styles.label}>{t("cheptel.animals.create.birthDate")}</Text>
          <TextInput
            style={styles.input}
            value={birthDate}
            onChangeText={setBirthDate}
            placeholder="AAAA-MM-JJ"
            placeholderTextColor={mobileColors.textSecondary}
          />

          <Text style={styles.label}>{t("cheptel.animals.detail.origin")}</Text>
          <View style={styles.pillRow}>
            {ORIGIN_OPTIONS.map((o) => (
              <Pressable
                key={o}
                style={[styles.pill, origin === o && styles.pillOn]}
                onPress={() => {
                  setOrigin(o);
                  if (o === "purchased") {
                    setDamId(null);
                    setSireId(null);
                  }
                }}
              >
                <Text style={[styles.pillText, origin === o && styles.pillTextOn]}>
                  {t(`cheptel.animals.detail.origin_${o}`)}
                </Text>
              </Pressable>
            ))}
          </View>

          {origin === "purchased" ? (
            <>
              <Text style={styles.label}>{t("cheptel.animals.detail.supplier")}</Text>
              <TextInput
                style={styles.input}
                value={supplier}
                onChangeText={setSupplier}
                placeholder={t("cheptel.animals.detail.supplierPlaceholder")}
                placeholderTextColor={mobileColors.textSecondary}
              />
            </>
          ) : null}

          {origin === "farm_born" ? (
            <>
              <Text style={styles.label}>{t("cheptel.animals.detail.pedigree")}</Text>
              <Text style={styles.hint}>{t("cheptel.animals.detail.pedigreeHint")}</Text>
              <Text style={styles.subLabel}>{t("cheptel.animals.detail.dam")}</Text>
              <View style={styles.pillRow}>
                <Pressable
                  style={[styles.pill, damId === null && styles.pillOn]}
                  onPress={() => setDamId(null)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      damId === null && styles.pillTextOn
                    ]}
                  >
                    {t("cheptel.animals.detail.pedigreeNone")}
                  </Text>
                </Pressable>
                {damCandidates.map((d) => (
                  <Pressable
                    key={d.id}
                    style={[styles.pill, damId === d.id && styles.pillOn]}
                    onPress={() => setDamId(d.id)}
                  >
                    <Text
                      style={[styles.pillText, damId === d.id && styles.pillTextOn]}
                    >
                      {animalDisplayTag(d)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.subLabel}>{t("cheptel.animals.detail.sire")}</Text>
              <View style={styles.pillRow}>
                <Pressable
                  style={[styles.pill, sireId === null && styles.pillOn]}
                  onPress={() => setSireId(null)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      sireId === null && styles.pillTextOn
                    ]}
                  >
                    {t("cheptel.animals.detail.pedigreeNone")}
                  </Text>
                </Pressable>
                {sireCandidates.map((s) => (
                  <Pressable
                    key={s.id}
                    style={[styles.pill, sireId === s.id && styles.pillOn]}
                    onPress={() => setSireId(s.id)}
                  >
                    <Text
                      style={[styles.pillText, sireId === s.id && styles.pillTextOn]}
                    >
                      {animalDisplayTag(s)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          <Text style={styles.label}>{t("cheptel.animals.detail.sex")}</Text>
          {showSexEditor ? (
            <View style={styles.sexEditBlock}>
              {resolvedSex === "unknown" && !sexEditOpen ? (
                <Pressable
                  style={styles.sexUnknownBadge}
                  onPress={() => {
                    setPendingSex("female");
                    setSexEditOpen(true);
                  }}
                >
                  <Text style={styles.sexUnknownDash}>—</Text>
                  <Text style={styles.sexUnknownText}>{t("cheptel.unknownSex")}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={mobileColors.textSecondary}
                  />
                </Pressable>
              ) : (
                <View style={styles.pillRow}>
                  {(["female", "male"] as const).map((s) => (
                    <Pressable
                      key={s}
                      style={[styles.pill, pendingSex === s && styles.pillOn]}
                      onPress={() => setPendingSex(s)}
                    >
                      <Ionicons
                        name={s === "male" ? "male" : "female"}
                        size={16}
                        color={
                          pendingSex === s
                            ? mobileColors.accent
                            : mobileColors.textSecondary
                        }
                      />
                      <Text
                        style={[styles.pillText, pendingSex === s && styles.pillTextOn]}
                      >
                        {s === "male"
                          ? t("cheptel.animals.sexMale")
                          : t("cheptel.animals.sexFemale")}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.meta}>
              {sexDisplayLabel(resolvedSex, {
                male: t("cheptel.animals.sexMale"),
                female: t("cheptel.animals.sexFemale"),
                unknown: t("cheptel.unknownSex")
              })}
            </Text>
          )}

          <Text style={styles.label}>{t("cheptel.animals.create.notes")}</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder={t("cheptel.animals.detail.notesPlaceholder")}
            placeholderTextColor={mobileColors.textSecondary}
          />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("cheptel.animals.detail.weight")}</Text>
            <Text style={styles.meta}>
              {t("cheptel.animals.detail.entryWeight")}: {formatAnimalKg(entry?.weightKg)}
            </Text>
            <Text style={styles.meta}>
              {t("cheptel.animals.detail.currentWeight")}: {formatAnimalKg(latest?.weightKg)}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("cheptel.animals.detail.health")}</Text>
            <Text style={styles.meta}>{t("cheptel.animals.detail.healthSoon")}</Text>
            {onOpenHealth ? (
              <Pressable style={styles.linkBtn} onPress={() => onOpenHealth(animal)}>
                <Text style={styles.linkBtnText}>
                  {t("cheptel.animals.detail.openHealth")}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.actions}>
            {onOpenFullRecord ? (
              <ActionChip
                icon="document-text-outline"
                label={t("cheptel.actions.fullRecord")}
                onPress={() => onOpenFullRecord(animal)}
              />
            ) : null}
            <ActionChip
              icon="swap-horizontal"
              label={t("cheptel.animals.detail.transfer")}
              onPress={() => onTransfer(animal)}
            />
            <ActionChip
              icon="scale-outline"
              label={t("cheptel.animals.detail.addWeight")}
              onPress={() => onAddWeight(animal)}
            />
            <ActionChip
              icon="refresh"
              label={t("cheptel.animals.detail.changeStatus")}
              onPress={() => onChangeStatus(animal)}
            />
          </View>
        </View>
      )}
    </BaseModal>
  );
}

function ActionChip({
  icon,
  label,
  onPress
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.actionChip} onPress={onPress}>
      <Ionicons name={icon} size={18} color={mobileColors.accent} />
      <Text style={styles.actionChipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { gap: mobileSpacing.sm, paddingBottom: mobileSpacing.lg },
  section: { gap: 4, marginTop: mobileSpacing.md },
  sectionTitle: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    marginBottom: 4
  },
  label: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm
  },
  subLabel: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: mobileColors.textSecondary,
    marginTop: 6
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
  photoRow: { flexDirection: "row", gap: mobileSpacing.md, alignItems: "center" },
  photoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: mobileColors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  photoImage: { width: 88, height: 88 },
  photoBadge: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: mobileColors.accent,
    alignItems: "center",
    justifyContent: "center"
  },
  rowLabel: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  rowValue: { ...mobileTypography.body, fontWeight: "600" },
  meta: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  sexEditBlock: { gap: mobileSpacing.sm },
  sexUnknownBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.surfaceMuted
  },
  sexUnknownDash: {
    fontSize: 18,
    fontWeight: "700",
    color: mobileColors.textSecondary
  },
  sexUnknownText: {
    ...mobileTypography.body,
    fontWeight: "600",
    color: mobileColors.textSecondary,
    flex: 1
  },
  primaryBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  linkBtn: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.accentSoft
  },
  linkBtnText: { color: mobileColors.accent, fontWeight: "600" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: mobileSpacing.sm },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.background
  },
  actionChipText: { ...mobileTypography.meta, fontWeight: "600", color: mobileColors.accent }
});
