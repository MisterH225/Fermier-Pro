import { useMutation, useQuery } from "@tanstack/react-query";
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
import { BaseModal } from "../../modals/BaseModal";
import { ModalSection } from "../../modals/ModalSection";
import { useModal } from "../../modals/useModal";
import type { AnimalListItem, BarnDetailDto } from "../../../lib/api";
import { fetchFarmBarn, fetchFarmBarns, postPenMove } from "../../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import { animalDisplayTag } from "./animalUtils";

type Props = {
  visible: boolean;
  animals: AnimalListItem[];
  initialAnimalId?: string | null;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  onClose: () => void;
  onTransferred: () => void;
};

type PenOption = {
  penId: string;
  penName: string;
  barnName: string;
  capacity: number;
  occupancy: number;
};

function penOccupancy(pen: BarnDetailDto["pens"][0]): number {
  return pen._count?.placements ?? 0;
}

export function TransferModal({
  visible,
  animals,
  initialAnimalId,
  farmId,
  accessToken,
  activeProfileId,
  onClose,
  onTransferred
}: Props) {
  const { t } = useTranslation();
  const { open } = useModal();
  const [animalId, setAnimalId] = useState<string | null>(null);
  const [toPenId, setToPenId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const barnsQuery = useQuery({
    queryKey: ["farmBarns", farmId, activeProfileId],
    queryFn: () => fetchFarmBarns(accessToken, farmId, activeProfileId),
    enabled: visible
  });

  const barnIds = useMemo(
    () => (barnsQuery.data ?? []).map((b) => b.id),
    [barnsQuery.data]
  );

  const barnDetailsQuery = useQuery({
    queryKey: ["farmBarnDetails", farmId, barnIds, activeProfileId],
    enabled: visible && barnIds.length > 0,
    queryFn: async () => {
      const details = await Promise.all(
        barnIds.map((id) =>
          fetchFarmBarn(accessToken, farmId, id, activeProfileId)
        )
      );
      return details;
    }
  });

  const penOptions: PenOption[] = useMemo(() => {
    const out: PenOption[] = [];
    for (const barn of barnDetailsQuery.data ?? []) {
      for (const pen of barn.pens) {
        out.push({
          penId: pen.id,
          penName: pen.name,
          barnName: barn.name,
          capacity: pen.capacity ?? 0,
          occupancy: penOccupancy(pen)
        });
      }
    }
    return out;
  }, [barnDetailsQuery.data]);

  useEffect(() => {
    if (visible) {
      setAnimalId(initialAnimalId ?? animals[0]?.id ?? null);
      setToPenId(null);
      setNote("");
    }
  }, [visible, initialAnimalId, animals]);

  const selectedAnimal = animals.find((a) => a.id === animalId) ?? null;
  const fromPenId = selectedAnimal?.currentPen?.penId;

  const selectedPen = penOptions.find((p) => p.penId === toPenId);

  const capacityWarning = useMemo(() => {
    if (!selectedPen || selectedPen.capacity <= 0) {
      return null;
    }
    const nextOcc = selectedPen.occupancy + 1;
    const rate = nextOcc / selectedPen.capacity;
    if (nextOcc > selectedPen.capacity) {
      return "block" as const;
    }
    if (rate > 0.8) {
      return "warn" as const;
    }
    return null;
  }, [selectedPen]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!animalId || !toPenId) {
        throw new Error(t("cheptel.animals.transfer.missingFields"));
      }
      if (capacityWarning === "block") {
        throw new Error(t("cheptel.animals.transfer.penFull"));
      }
      return postPenMove(
        accessToken,
        farmId,
        {
          animalId,
          toPenId,
          fromPenId,
          note: note.trim() || undefined
        },
        activeProfileId
      );
    },
    onSuccess: () => {
      onTransferred();
      onClose();
      open("success", {
        message: t("cheptel.animals.transfer.success"),
        autoDismissMs: 2200
      });
    },
    onError: (e: Error) => {
      Alert.alert(t("cheptel.animals.transfer.errorTitle"), e.message);
    }
  });

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("cheptel.animals.transfer.title")}
      footerPrimary={
        <Pressable
          style={[
            styles.primaryBtn,
            (saveMut.isPending || capacityWarning === "block") && styles.btnDisabled
          ]}
          onPress={() => saveMut.mutate()}
          disabled={saveMut.isPending || capacityWarning === "block"}
        >
          {saveMut.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>
              {t("cheptel.animals.transfer.submit")}
            </Text>
          )}
        </Pressable>
      }
    >
      <ModalSection title={t("modals.sections.animal")}>
        <Text style={styles.label}>{t("cheptel.animals.transfer.animal")}</Text>
        <View style={styles.pillRow}>
          {animals
            .filter((a) => a.status === "active")
            .map((a) => (
              <Pressable
                key={a.id}
                style={[styles.pill, animalId === a.id && styles.pillOn]}
                onPress={() => setAnimalId(a.id)}
              >
                <Text
                  style={[
                    styles.pillText,
                    animalId === a.id && styles.pillTextOn
                  ]}
                >
                  {animalDisplayTag(a)}
                </Text>
              </Pressable>
            ))}
        </View>

        {selectedAnimal?.currentPen ? (
          <Text style={styles.meta}>
            {t("cheptel.animals.transfer.fromPen", {
              barn: selectedAnimal.currentPen.barnName,
              pen: selectedAnimal.currentPen.penName
            })}
          </Text>
        ) : (
          <Text style={styles.meta}>{t("cheptel.animals.transfer.noSourcePen")}</Text>
        )}
      </ModalSection>

      <ModalSection title={t("modals.sections.destination")}>
        <Text style={styles.label}>{t("cheptel.animals.transfer.destination")}</Text>
        {barnDetailsQuery.isPending ? (
          <ActivityIndicator color={mobileColors.accent} />
        ) : (
          <View style={styles.penGrid}>
            {penOptions.map((p) => {
              const full =
                p.capacity > 0 && p.occupancy >= p.capacity && p.penId !== fromPenId;
              const warn =
                p.capacity > 0 && (p.occupancy + 1) / p.capacity > 0.8;
              return (
                <Pressable
                  key={p.penId}
                  style={[
                    styles.penBloc,
                    toPenId === p.penId && styles.penBlocOn,
                    full && styles.penBlocDisabled
                  ]}
                  disabled={full}
                  onPress={() => setToPenId(p.penId)}
                >
                  <Text style={styles.penName}>{p.penName}</Text>
                  <Text style={styles.penMeta}>{p.barnName}</Text>
                  <Text style={styles.penMeta}>
                    {p.capacity > 0
                      ? `${p.occupancy}/${p.capacity}`
                      : t("cheptel.animals.transfer.noCapacity")}
                  </Text>
                  {warn && !full ? (
                    <Text style={styles.warnTag}>
                      {t("cheptel.animals.transfer.nearFull")}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}

        {capacityWarning === "warn" ? (
          <Text style={styles.warnText}>{t("cheptel.animals.transfer.warnCapacity")}</Text>
        ) : null}
      </ModalSection>

      <ModalSection title={t("modals.sections.note")}>
        <Text style={styles.label}>{t("cheptel.animals.transfer.note")}</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={note}
          onChangeText={setNote}
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
    color: mobileColors.textSecondary
  },
  meta: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  pillOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  pillText: { ...mobileTypography.meta },
  pillTextOn: { color: mobileColors.accent, fontWeight: "700" },
  penGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  penBloc: {
    width: "47%",
    padding: 10,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.background,
    borderLeftWidth: 4,
    borderLeftColor: mobileColors.success
  },
  penBlocOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  penBlocDisabled: { opacity: 0.45, borderLeftColor: mobileColors.error },
  penName: { fontWeight: "700", color: mobileColors.textPrimary },
  penMeta: { ...mobileTypography.meta, marginTop: 2 },
  warnTag: {
    marginTop: 4,
    fontSize: 11,
    color: "#C2410C",
    fontWeight: "600"
  },
  warnText: {
    ...mobileTypography.meta,
    color: "#C2410C",
    fontWeight: "600"
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 10,
    ...mobileTypography.body,
    backgroundColor: mobileColors.background
  },
  multiline: { minHeight: 64, textAlignVertical: "top" },
  primaryBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 }
});
