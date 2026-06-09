import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
import { BaseModal } from "../../modals/BaseModal";
import { ModalSection } from "../../modals/ModalSection";
import { useModal } from "../../modals/useModal";
import {
  createPen,
  patchPen,
  type PenCategoryKey
} from "../../../lib/api";
import { getUserFacingError } from "../../../lib/userFacingError";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";

const CATEGORIES: PenCategoryKey[] = [
  "starter",
  "fattening",
  "maternity",
  "quarantine",
  "mixed"
];

type Props = {
  visible: boolean;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  barns: Array<{ id: string; name: string }>;
  /** Présélectionne le bâtiment à l’ouverture. */
  defaultBarnId?: string;
  /** Masque le sélecteur de bâtiment (ex. depuis un bâtiment). */
  lockBarn?: boolean;
  onClose: () => void;
  onCreated: () => void;
};

function resolveBarnId(
  barns: Array<{ id: string; name: string }>,
  preferred?: string
): string {
  if (preferred && barns.some((b) => b.id === preferred)) {
    return preferred;
  }
  return barns[0]?.id ?? "";
}

/** Modal unique de création de loge (cheptel, grille, bâtiment). */
export function CreateLogeModal({
  visible,
  farmId,
  accessToken,
  activeProfileId,
  barns,
  defaultBarnId,
  lockBarn = false,
  onClose,
  onCreated
}: Props) {
  const { t } = useTranslation();
  const { open } = useModal();
  const [barnId, setBarnId] = useState(() =>
    resolveBarnId(barns, defaultBarnId)
  );
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [capacity, setCapacity] = useState("12");
  const [category, setCategory] = useState<PenCategoryKey>("mixed");
  const [avgWeight, setAvgWeight] = useState("");
  const [avgAge, setAvgAge] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!visible) {
      return;
    }
    setBarnId(resolveBarnId(barns, defaultBarnId));
    setName("");
    setCode("");
    setCapacity("12");
    setCategory("mixed");
    setAvgWeight("");
    setAvgAge("");
    setNotes("");
  }, [visible, barns, defaultBarnId]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const cap = Number.parseInt(capacity, 10);
      if (!barnId || !name.trim()) {
        throw new Error(t("cheptel.pens.createMissing"));
      }
      const created = await createPen(
        accessToken,
        farmId,
        barnId,
        {
          name: name.trim(),
          capacity: Number.isFinite(cap) ? cap : undefined,
          ...(code.trim() ? { code: code.trim() } : {})
        },
        activeProfileId
      );
      const w = avgWeight.trim() ? Number.parseFloat(avgWeight) : null;
      const ageRaw = avgAge.trim() ? Number.parseInt(avgAge, 10) : null;
      const ageWeeks =
        ageRaw == null || !Number.isFinite(ageRaw)
          ? null
          : Math.min(104, Math.max(0, ageRaw));
      const hasPatch =
        category !== "mixed" ||
        Number.isFinite(w!) ||
        ageWeeks != null ||
        notes.trim().length > 0;
      if (!hasPatch) {
        return;
      }
      await patchPen(
        accessToken,
        farmId,
        created.id,
        {
          category,
          categoryForced: true,
          averageWeightKg: Number.isFinite(w!) ? w : null,
          averageAgeWeeksManual: ageWeeks,
          zoneLabel: notes.trim() || undefined
        },
        activeProfileId
      );
    },
    onSuccess: () => {
      onCreated();
      onClose();
      open("success", {
        message: t("cheptel.pens.createSuccess"),
        autoDismissMs: 2000
      });
    },
    onError: (e: Error) =>
      Alert.alert(t("common.error"), getUserFacingError(e, t))
  });

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("cheptel.pens.createTitle")}
      footerPrimary={
        <Pressable
          style={styles.primary}
          onPress={() => saveMut.mutate()}
          disabled={saveMut.isPending}
        >
          {saveMut.isPending ? (
            <ActivityIndicator color={mobileColors.onAccent} />
          ) : (
            <Text style={styles.primaryTx}>{t("cheptel.pens.createSubmit")}</Text>
          )}
        </Pressable>
      }
    >
      <ModalSection title={t("modals.sections.identification")}>
        {!lockBarn ? (
          <>
            <Text style={styles.label}>{t("cheptel.pens.barn")}</Text>
            <View style={styles.pillRow}>
              {barns.map((b) => (
                <Pressable
                  key={b.id}
                  style={[styles.pill, barnId === b.id && styles.pillOn]}
                  onPress={() => setBarnId(b.id)}
                >
                  <Text
                    style={[styles.pillTx, barnId === b.id && styles.pillTxOn]}
                  >
                    {b.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
        <Text style={styles.label}>{t("cheptel.pens.penName")}</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />
        <Text style={styles.label}>{t("cheptel.pens.penCodeOptional")}</Text>
        <TextInput style={styles.input} value={code} onChangeText={setCode} />
        <Text style={styles.label}>{t("cheptel.pens.capacity")}</Text>
        <TextInput
          style={styles.input}
          value={capacity}
          onChangeText={setCapacity}
          keyboardType="number-pad"
        />
        <Text style={styles.label}>{t("cheptel.pens.categoryLabel")}</Text>
        <View style={styles.pillRow}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              style={[styles.pill, category === c && styles.pillOn]}
              onPress={() => setCategory(c)}
            >
              <Text style={[styles.pillTx, category === c && styles.pillTxOn]}>
                {t(`cheptel.pens.category.${c}`)}
              </Text>
            </Pressable>
          ))}
        </View>
      </ModalSection>

      <ModalSection title={t("modals.sections.details")}>
        <Text style={styles.label}>{t("cheptel.pens.avgWeightInitial")}</Text>
        <TextInput
          style={styles.input}
          value={avgWeight}
          onChangeText={setAvgWeight}
          keyboardType="decimal-pad"
        />
        <Text style={styles.label}>{t("cheptel.pens.avgAgeInitial")}</Text>
        <TextInput
          style={styles.input}
          value={avgAge}
          onChangeText={setAvgAge}
          keyboardType="number-pad"
          placeholder="8"
        />
        <Text style={styles.helper}>{t("cheptel.pens.avgAgeHelper")}</Text>
        <Text style={styles.label}>{t("cheptel.pens.notes")}</Text>
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
  label: {
    ...mobileTypography.meta,
    fontWeight: "600",
    marginBottom: 4
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: 12,
    backgroundColor: mobileColors.background
  },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  helper: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 4,
    marginBottom: 4
  },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  pillOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  pillTx: { ...mobileTypography.meta },
  pillTxOn: { color: mobileColors.accent, fontWeight: "700" },
  primary: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  primaryTx: { color: mobileColors.onAccent, fontWeight: "700" }
});
