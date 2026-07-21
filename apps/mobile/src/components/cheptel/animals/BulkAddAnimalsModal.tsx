import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import { BaseModal } from "../../modals/BaseModal";
import { useModal } from "../../modals/useModal";
import {
  createBulkAnimals,
  fetchTaxonomy,
  type AnimalOriginDto,
  type BulkCreateAnimalsPayload
} from "../../../lib/api";
import { useCheptelPens } from "../../../lib/cheptelPensQuery";
import { mobileColors, mobileRadius, mobileTypography, mobileFontSize } from "../../../theme/mobileTheme";
import { defaultSexForCategory, type CreateAnimalCategoryKey } from "./animalUtils";
import { BulkAddStep1 } from "./BulkAddStep1";
import { BulkAddStep2Preview } from "./BulkAddStep2Preview";

export type BulkAddFormState = {
  penId: string | null;
  category: CreateAnimalCategoryKey;
  count: number;
  sex: "male" | "female" | "unknown";
  breedId: string | null;
  entryWeight: string;
  ageWeeks: string;
  entryDate: string;
  origin: AnimalOriginDto;
  supplier: string;
};

export type BulkAddTargetPen = {
  penId: string;
  penName: string;
  barnName: string;
};

type Props = {
  visible: boolean;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  targetPen?: BulkAddTargetPen | null;
  onClose: () => void;
  onCreated: () => void;
  /** Après succès — ouvrir la loge (ex. depuis écran détail). */
  onViewPen?: (penId: string) => void;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const defaultForm = (penId: string | null): BulkAddFormState => ({
  penId,
  category: "fattening",
  count: 2,
  sex: "unknown",
  breedId: null,
  entryWeight: "",
  ageWeeks: "",
  entryDate: todayIso(),
  origin: "farm_born",
  supplier: ""
});

export function BulkAddAnimalsModal({
  visible,
  farmId,
  accessToken,
  activeProfileId,
  targetPen,
  onClose,
  onCreated,
  onViewPen
}: Props) {
  const { t } = useTranslation();
  const { open } = useModal();
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<BulkAddFormState>(() =>
    defaultForm(targetPen?.penId ?? null)
  );

  useEffect(() => {
    if (!visible) {
      return;
    }
    setStep(1);
    setForm(defaultForm(targetPen?.penId ?? null));
  }, [visible, targetPen?.penId]);

  const pensQ = useCheptelPens({
    farmId,
    accessToken,
    activeProfileId,
    enabled: visible
  });

  const taxonomyQ = useQuery({
    queryKey: ["taxonomy", activeProfileId],
    queryFn: () => fetchTaxonomy(accessToken, activeProfileId),
    enabled: visible
  });

  const patchForm = (patch: Partial<BulkAddFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const selectedPen = useMemo(() => {
    const id = targetPen?.penId ?? form.penId;
    if (!id) {
      return null;
    }
    return pensQ.data?.pens.find((p) => p.id === id) ?? null;
  }, [targetPen?.penId, form.penId, pensQ.data]);

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

  const breedName = useMemo(() => {
    if (!form.breedId) {
      return null;
    }
    for (const sp of taxonomyQ.data ?? []) {
      const b = sp.breeds.find((x) => x.id === form.breedId);
      if (b) {
        return b.name;
      }
    }
    return null;
  }, [form.breedId, taxonomyQ.data]);

  const penLabel = targetPen
    ? `${targetPen.barnName} · ${targetPen.penName}`
    : selectedPen
      ? `${selectedPen.barnName} · ${selectedPen.name}`
      : null;

  const buildPayload = (): BulkCreateAnimalsPayload => {
    const forced = defaultSexForCategory(form.category);
    const sex =
      forced === "male" || forced === "female" ? forced : form.sex;
    const w = form.entryWeight.trim()
      ? Number.parseFloat(form.entryWeight.replace(",", "."))
      : undefined;
    const age = form.ageWeeks.trim()
      ? Number.parseInt(form.ageWeeks, 10)
      : undefined;
    return {
      penId: (targetPen?.penId ?? form.penId) || undefined,
      productionCategory: form.category,
      count: form.count,
      sex,
      breedId: form.breedId ?? undefined,
      entryWeightKg:
        w != null && Number.isFinite(w) && w > 0 ? w : undefined,
      ageWeeksAtEntry:
        age != null && Number.isFinite(age) && age >= 0 ? age : undefined,
      entryDate: form.entryDate || todayIso(),
      origin: form.origin,
      supplier:
        form.origin === "purchased" ? form.supplier.trim() || undefined : undefined
    };
  };

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: ["farmAnimals", farmId] });
    void qc.invalidateQueries({ queryKey: ["farmCheptel", farmId] });
    void qc.invalidateQueries({ queryKey: ["cheptelPens", farmId] });
    void qc.invalidateQueries({ queryKey: ["cheptelHistory", farmId] });
    void qc.invalidateQueries({ queryKey: ["nextAnimalNumber", farmId] });
    if (targetPen?.penId ?? form.penId) {
      void qc.invalidateQueries({
        queryKey: ["penContents", farmId, targetPen?.penId ?? form.penId]
      });
    }
  };

  const createMut = useMutation({
    mutationFn: () => createBulkAnimals(accessToken, farmId, buildPayload(), activeProfileId),
    onSuccess: (result) => {
      invalidateAll();
      onCreated();
      onClose();
      const penId = targetPen?.penId ?? form.penId;
      open("success", {
        title: t("cheptel.animals.bulk.successTitle"),
        message: t("cheptel.animals.bulk.successMessage", {
          count: result.count,
          first: result.firstNumber,
          last: result.lastNumber
        }),
        autoDismissMs: 4000
      });
    },
    onError: (e: Error) => {
      Alert.alert(t("cheptel.animals.bulk.errorTitle"), e.message);
    }
  });

  const goNext = () => {
    if (form.count < 2 || form.count > 200) {
      Alert.alert(
        t("cheptel.animals.bulk.errorTitle"),
        t("cheptel.animals.bulk.countInvalid")
      );
      return;
    }
    setStep(2);
  };

  const footerPrimary =
    step === 1 ? (
      <Pressable style={styles.primaryBtn} onPress={goNext}>
        <Text style={styles.primaryBtnTx}>{t("cheptel.animals.bulk.next")}</Text>
      </Pressable>
    ) : null;

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("cheptel.animals.bulk.title")}
      footerPrimary={footerPrimary}
    >
      {step === 1 ? (
        <BulkAddStep1
          farmId={farmId}
          accessToken={accessToken}
          activeProfileId={activeProfileId}
          form={form}
          onChange={patchForm}
          fixedPen={targetPen ?? null}
        />
      ) : (
        <BulkAddStep2Preview
          farmId={farmId}
          accessToken={accessToken}
          activeProfileId={activeProfileId}
          form={form}
          penLabel={penLabel}
          freeSlots={freeSlots}
          breedName={breedName}
          isSubmitting={createMut.isPending}
          onBack={() => setStep(1)}
          onConfirm={() => createMut.mutate()}
        />
      )}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  primaryBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  primaryBtnTx: { color: mobileColors.onAccent, fontWeight: "700", fontSize: mobileFontSize.lg }
});
