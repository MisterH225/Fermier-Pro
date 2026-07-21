import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getUserFacingError } from "../../../lib/userFacingError";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { AppDatePicker } from "../../common/AppDatePicker";
import { BaseModal } from "../../modals/BaseModal";
import { ModalSection } from "../../modals/ModalSection";
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
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../../theme/mobileTheme";
import { ExitVerbActions } from "../exits/ExitVerbActions";
import type { LivestockExitKind } from "../exits/livestockExitKind";
import {
  animalDisplayTag,
  breederCategoryForSex,
  formatAnimalKg,
  normalizeAnimalStatusKey,
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
  /** modal = feuille ; page = écran stack (AnimalDetail) */
  presentation?: "modal" | "page";
  onClose: () => void;
  onUpdated?: () => void;
  onTransfer: (animal: AnimalListItem) => void;
  /** Sorties en verbes (LivestockExitKind) — remplace « Changement de statut ». */
  onExitVerb: (animal: AnimalListItem, kind: LivestockExitKind) => void;
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
  presentation = "modal",
  onClose,
  onUpdated,
  onTransfer,
  onExitVerb,
  onAddWeight,
  onOpenHealth,
  onOpenFullRecord
}: Props) {
  const isOpen = presentation === "page" ? Boolean(animal) : visible;
  const { t } = useTranslation();
  const { open } = useModal();
  const queryClient = useQueryClient();

  const [breedId, setBreedId] = useState<string | null>(null);
  const [birthDate, setBirthDate] = useState("");
  const [ageAtEntry, setAgeAtEntry] = useState("");
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
    enabled: isOpen && Boolean(animal?.id)
  });

  const taxonomyQuery = useQuery({
    queryKey: ["taxonomy", activeProfileId],
    queryFn: () => fetchTaxonomy(accessToken, activeProfileId),
    enabled: isOpen
  });

  const herdQuery = useQuery({
    queryKey: ["farmAnimals", farmId, activeProfileId],
    queryFn: () => fetchFarmAnimals(accessToken, farmId, activeProfileId),
    enabled: isOpen
  });

  const syncFormFromDetail = useCallback(() => {
    const d = detailQuery.data;
    if (!d) {
      return;
    }
    setBreedId(d.breed?.id ?? null);
    setBirthDate(formatBirthInput(d.birthDate));
    setAgeAtEntry(
      d.ageWeeksAtEntry != null ? String(d.ageWeeksAtEntry) : ""
    );
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
    if (isOpen && detailQuery.isSuccess) {
      syncFormFromDetail();
    }
  }, [isOpen, detailQuery.isSuccess, syncFormFromDetail]);

  useEffect(() => {
    if (!isOpen) {
      setPendingPhotoUri(null);
      setSexEditOpen(false);
    }
  }, [isOpen]);

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
  const effectiveSex: "male" | "female" | "unknown" =
    sexEditOpen && (pendingSex === "male" || pendingSex === "female")
      ? pendingSex
      : resolvedSex;
  const productionCategory =
    detailQuery.data?.productionCategory ?? animal?.productionCategory;
  const showSexEditor = effectiveSex === "unknown" || sexEditOpen;
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

      const sexPayload: "male" | "female" | undefined =
        effectiveSex === "male" || effectiveSex === "female"
          ? effectiveSex
          : undefined;

      if (effectiveSex === "unknown") {
        throw new Error(t("cheptel.animals.detail.sexRequired"));
      }

      const ageRaw = ageAtEntry.trim()
        ? Number.parseInt(ageAtEntry, 10)
        : null;
      const ageWeeksAtEntry =
        birthDate.trim() || ageRaw == null || !Number.isFinite(ageRaw)
          ? birthDate.trim()
            ? null
            : ageRaw != null
              ? Math.max(0, ageRaw)
              : null
          : Math.max(0, ageRaw);

      const sexWasSetOnThisSave =
        resolvedSex === "unknown" || resolvedSex !== effectiveSex;

      const updated = await updateAnimal(
        accessToken,
        farmId,
        animal.id,
        {
          breedId,
          birthDate: birthDate.trim() || null,
          ageWeeksAtEntry,
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
      return { updated, sexWasSetOnThisSave };
    },
    onSuccess: ({ updated: data, sexWasSetOnThisSave }) => {
      queryClient.setQueryData(
        ["farmAnimal", farmId, animal?.id, activeProfileId],
        data
      );
      void queryClient.invalidateQueries({
        queryKey: ["farmAnimal", farmId, animal?.id]
      });
      void queryClient.invalidateQueries({
        queryKey: ["farmAnimals", farmId]
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
      const categoryForSuggest =
        data.productionCategory ?? productionCategory;
      if (
        sexWasSetOnThisSave &&
        (newSex === "male" || newSex === "female") &&
        shouldSuggestBreederReclass(categoryForSuggest, newSex)
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
                ).then((updated) => {
                  queryClient.setQueryData(
                    ["farmAnimal", farmId, animal!.id, activeProfileId],
                    updated
                  );
                  onUpdated?.();
                });
              }
            }
          ]
        );
      }
    },
    onError: (e: Error) => {
      Alert.alert(t("cheptel.animals.detail.saveErrorTitle"), getUserFacingError(e, t));
    }
  });

  if (!animal) {
    return null;
  }

  const tag = animalDisplayTag(animal);
  const detail = detailQuery.data;
  const latest = detail?.weights[0] ?? animal.weights[0];
  const entry = detail?.weights[detail.weights.length - 1];
  const showFullRecordLink =
    presentation === "modal" && Boolean(onOpenFullRecord);

  const saveFooter = (
    <Pressable
      style={[styles.primaryBtn, saveMut.isPending && styles.btnDisabled]}
      onPress={() => saveMut.mutate()}
      disabled={saveMut.isPending || detailQuery.isPending}
    >
      {saveMut.isPending ? (
        <ActivityIndicator color={mobileColors.onAccent} />
      ) : (
        <>
          <Ionicons
            name="checkmark-circle-outline"
            size={18}
            color={mobileColors.onAccent}
          />
          <Text style={styles.primaryBtnText}>
            {t("cheptel.animals.detail.save")}
          </Text>
        </>
      )}
    </Pressable>
  );

  const renderFormBody = () => {
    if (detailQuery.isPending) {
      return (
        <ActivityIndicator
          color={mobileColors.accent}
          style={{ marginVertical: 24 }}
        />
      );
    }

    return (
      <>
          <ModalSection title={t("cheptel.animals.detail.identity")}>
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
                <Ionicons name="camera" size={14} color={mobileColors.onAccent} />
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

          <Text style={styles.sectionTitle}>
            {t("cheptel.animals.detail.ageSection")}
          </Text>
          <AppDatePicker
            label={t("cheptel.animals.detail.birthDate")}
            isoValue={birthDate}
            onIsoChange={setBirthDate}
            farmId={farmId}
            maxDate={new Date()}
          />
          {birthDate.trim() && detailQuery.data?.currentAgeWeeks != null ? (
            <Text style={styles.hint}>
              {t("cheptel.animals.detail.bornOn", {
                date: birthDate.trim(),
                weeks: detailQuery.data.currentAgeWeeks
              })}
            </Text>
          ) : null}

          {!birthDate.trim() ? (
            <>
              <Text style={styles.label}>
                {t("cheptel.animals.detail.ageAtEntry")}
              </Text>
              <TextInput
                style={styles.input}
                value={ageAtEntry}
                onChangeText={setAgeAtEntry}
                keyboardType="number-pad"
                placeholder="8"
                placeholderTextColor={mobileColors.textSecondary}
              />
              {detailQuery.data?.entryDate &&
              detailQuery.data.currentAgeWeeks != null ? (
                <Text style={styles.hint}>
                  {t("cheptel.animals.detail.enteredAt", {
                    weeks: detailQuery.data.ageWeeksAtEntry ?? "—",
                    date: detailQuery.data.entryDate,
                    current: detailQuery.data.currentAgeWeeks
                  })}
                </Text>
              ) : null}
            </>
          ) : null}

          {detailQuery.data?.currentAgeWeeks != null ? (
            <View style={styles.ageReadonly}>
              <Text style={styles.subLabel}>
                {t("cheptel.animals.detail.currentAgeEstimated")}
              </Text>
              <Text style={styles.ageReadonlyVal}>
                {t("cheptel.animals.detail.currentAgeWeeks", {
                  weeks: detailQuery.data.currentAgeWeeks
                })}
              </Text>
              <Text style={styles.hint}>
                {t("cheptel.animals.detail.currentAgeAuto")}
              </Text>
            </View>
          ) : null}

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
              {sexDisplayLabel(effectiveSex, {
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
          </ModalSection>

          <ModalSection title={t("cheptel.animals.detail.weight")}>
            <Text style={styles.meta}>
              {t("cheptel.animals.detail.entryWeight")}: {formatAnimalKg(entry?.weightKg)}
            </Text>
            <Text style={styles.meta}>
              {t("cheptel.animals.detail.currentWeight")}: {formatAnimalKg(latest?.weightKg)}
            </Text>
          </ModalSection>

          <ModalSection title={t("cheptel.animals.detail.health")}>
            <Text style={styles.meta}>{t("cheptel.animals.detail.healthSoon")}</Text>
            {onOpenHealth ? (
              <Pressable style={styles.linkBtn} onPress={() => onOpenHealth(animal)}>
                <Text style={styles.linkBtnText}>
                  {t("cheptel.animals.detail.openHealth")}
                </Text>
              </Pressable>
            ) : null}
          </ModalSection>

          <ModalSection plain>
          <View style={styles.actions}>
            {showFullRecordLink && onOpenFullRecord ? (
              <ActionChip
                icon="document-text-outline"
                label={t("cheptel.actions.fullRecord")}
                onPress={() => onOpenFullRecord(animal)}
              />
            ) : null}
            <ActionChip
              icon="swap-horizontal"
              label={t("cheptel.animals.detail.movePen")}
              onPress={() => onTransfer(animal)}
            />
            <ActionChip
              icon="scale-outline"
              label={t("cheptel.animals.detail.addWeight")}
              onPress={() => onAddWeight(animal)}
            />
            <ExitVerbActions
              onSelect={(kind) => onExitVerb(animal, kind)}
            />
          </View>
          </ModalSection>
      </>
    );
  };

  if (presentation === "page") {
    return (
      <ScrollView
        style={styles.pageScroll}
        contentContainerStyle={styles.pageContent}
        keyboardShouldPersistTaps="handled"
      >
        {renderFormBody()}
        <View style={styles.pageFooter}>{saveFooter}</View>
      </ScrollView>
    );
  }

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={tag}
      statusBadge={{
        label: t(
          `cheptel.animals.status.${normalizeAnimalStatusKey(animal.status)}`
        ),
        tone: animal.status === "active" ? "neutral" : "warning"
      }}
      footerPrimary={saveFooter}
    >
      {renderFormBody()}
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
  pageScroll: { flex: 1, backgroundColor: mobileColors.canvas },
  pageContent: {
    padding: mobileSpacing.md,
    paddingBottom: mobileSpacing.xl,
    gap: mobileSpacing.md
  },
  pageFooter: { marginTop: mobileSpacing.md },
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
  sectionTitle: {
    ...mobileTypography.cardTitle,
    fontSize: mobileFontSize.lg,
    color: mobileColors.textPrimary,
    marginTop: mobileSpacing.md
  },
  ageReadonly: {
    marginTop: mobileSpacing.sm,
    padding: mobileSpacing.sm,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.canvas
  },
  ageReadonlyVal: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    marginTop: 4
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
    borderRadius: mobileRadius.xl,
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
    borderRadius: mobileRadius.lg,
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
    fontSize: mobileFontSize.lg,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: mobileColors.onAccent, fontWeight: "700", fontSize: mobileFontSize.lg },
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
