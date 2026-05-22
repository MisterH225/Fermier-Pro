import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { AnimalActionModal } from "../components/cheptel/animals/AnimalActionModal";
import { AnimalDetailModal } from "../components/cheptel/animals/AnimalDetailModal";
import { penAnimalToListItem } from "../components/cheptel/animals/animalUtils";
import { ChangeStatusModal } from "../components/cheptel/animals/ChangeStatusModal";
import { TransferModal } from "../components/cheptel/animals/TransferModal";
import { CreateAnimalModal } from "../components/cheptel/animals/CreateAnimalModal";
import { AddWeightModal } from "../components/cheptel/weight/AddWeightModal";
import { EventList, type EventItem } from "../components/lists";
import { useSession } from "../context/SessionContext";
import {
  fetchCheptelPens,
  fetchFarmAnimals,
  fetchPenContents,
  patchPenAverages,
  type AnimalListItem,
  type PenAnimalRowDto,
  type PenBatchRowDto,
  type PenUsageTag
} from "../lib/api";
import { useScreenTitle } from "../hooks/useScreenTitle";
import type { RootStackParamList } from "../types/navigation";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";

type Props = NativeStackScreenProps<RootStackParamList, "LogeDetail">;
type AnimalFilter = "all" | "male" | "female" | "vaccine_late";

function batchCategoryLabel(
  categoryKey: string | null | undefined,
  t: (key: string) => string
): string {
  const k = (categoryKey ?? "").toLowerCase();
  if (
    k === "nursery" ||
    k.includes("starter") ||
    k.includes("demarrage") ||
    k.includes("porcelet")
  ) {
    return t("cheptel.pens.batchCategoryNursery");
  }
  if (k.includes("finish") || k.includes("engrais") || k === "finisher") {
    return t("cheptel.pens.batchCategoryFinisher");
  }
  return t("cheptel.pens.batchCategoryOther");
}

function penBatchToEventItem(
  b: PenBatchRowDto,
  t: (key: string, opts?: { count: number }) => string
): EventItem {
  return {
    id: `batch-${b.id}`,
    title: b.name,
    subtitle: batchCategoryLabel(b.categoryKey, t),
    value: t("cheptel.pens.batchHeadcount", { count: b.headcount }),
    valueType: "neutral",
    date: b.breed?.name ?? b.species.name,
    iconType: "custom",
    customIcon: "layers-outline",
    meta: b
  };
}

function penAnimalToEventItem(
  a: PenAnimalRowDto,
  t: (key: string) => string
): EventItem {
  const lastMeasure = a.weights[0]?.measuredAt;
  return {
    id: a.id,
    title: a.tagCode?.trim() || `FP-${a.publicId.slice(-6)}`,
    subtitle: [
      a.breed?.name,
      t(`cheptel.animals.sex.${a.sex}`),
      a.activeGestation ? "🤱" : null
    ]
      .filter(Boolean)
      .join(" · "),
    value:
      a.currentWeightKg != null ? `${a.currentWeightKg} kg` : undefined,
    valueType: a.vaccineOverdue ? "negative" : "neutral",
    date: lastMeasure?.slice(0, 10) ?? "—",
    iconType: "custom",
    customIcon: a.sex === "male" ? "male-outline" : "female-outline",
    meta: a
  };
}

export function LogeDetailScreen({ route, navigation }: Props) {
  const { farmId, farmName, penId, penLabel } = route.params;
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const qc = useQueryClient();

  const [filter, setFilter] = useState<AnimalFilter>("all");
  const [avgWeight, setAvgWeight] = useState("");
  const [avgAge, setAvgAge] = useState("");
  const [actionAnimal, setActionAnimal] = useState<PenAnimalRowDto | null>(null);
  const [statusAnimal, setStatusAnimal] = useState<AnimalListItem | null>(null);
  const [transferAnimal, setTransferAnimal] = useState<AnimalListItem | null>(null);
  const [weightAnimal, setWeightAnimal] = useState<AnimalListItem | null>(null);
  const [detailAnimal, setDetailAnimal] = useState<AnimalListItem | null>(null);
  const [isCreateAnimalVisible, setIsCreateAnimalVisible] = useState(false);

  const pensQ = useQuery({
    queryKey: ["cheptelPens", farmId, activeProfileId],
    queryFn: () => fetchCheptelPens(accessToken!, farmId, activeProfileId)
  });

  const penMeta = useMemo(
    () => pensQ.data?.pens.find((p) => p.id === penId),
    [pensQ.data, penId]
  );

  useScreenTitle(navigation, penMeta?.name ?? penLabel ?? t("cheptel.pens.penDetail"));

  const contentsQ = useQuery({
    queryKey: ["penContents", farmId, penId, activeProfileId],
    queryFn: () => fetchPenContents(accessToken!, farmId, penId, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const allAnimalsQ = useQuery({
    queryKey: ["farmAnimals", farmId, activeProfileId],
    queryFn: () => fetchFarmAnimals(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken)
  });

  useLayoutEffect(() => {
    if (penMeta?.averageWeightKg != null) {
      setAvgWeight(String(penMeta.averageWeightKg));
    }
    if (penMeta?.averageAgeDays != null) {
      setAvgAge(String(penMeta.averageAgeDays));
    }
  }, [penMeta?.averageWeightKg, penMeta?.averageAgeDays]);

  const saveAveragesMut = useMutation({
    mutationFn: () =>
      patchPenAverages(
        accessToken!,
        farmId,
        penId,
        {
          averageWeightKg: avgWeight.trim()
            ? Number.parseFloat(avgWeight)
            : null,
          averageAgeDays: avgAge.trim()
            ? Number.parseInt(avgAge, 10)
            : null
        },
        activeProfileId
      ),
    onSuccess: () => {
      void pensQ.refetch();
      void contentsQ.refetch();
    }
  });

  const penUsage: PenUsageTag =
    penMeta?.usageTag ??
    (penMeta?.category === "maternity"
      ? "sows"
      : penMeta?.category === "starter" ||
          penMeta?.category === "fattening" ||
          penMeta?.category === "empty"
        ? penMeta.category
        : "mixed");

  const usageLabel = t(`cheptel.pens.usage.${penUsage}`, {
    defaultValue: t(`cheptel.pens.category.${penMeta?.category ?? "mixed"}`)
  });

  const filteredAnimals = useMemo(() => {
    const rows = contentsQ.data?.animals ?? [];
    return rows.filter((a) => {
      if (filter === "male") {
        return a.sex === "male";
      }
      if (filter === "female") {
        return a.sex === "female";
      }
      if (filter === "vaccine_late") {
        return a.vaccineOverdue;
      }
      return true;
    });
  }, [contentsQ.data?.animals, filter]);

  const batches = contentsQ.data?.batches ?? [];

  const toListItem = (a: PenAnimalRowDto): AnimalListItem | null => {
    const full = (allAnimalsQ.data ?? []).find((x) => x.id === a.id);
    return full ?? null;
  };

  const animalEventItems: EventItem[] = useMemo(
    () => filteredAnimals.map((a) => penAnimalToEventItem(a, t)),
    [filteredAnimals, t]
  );

  const batchEventItems: EventItem[] = useMemo(
    () => batches.map((b) => penBatchToEventItem(b, t)),
    [batches, t]
  );

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["penContents", farmId, penId] });
    void qc.invalidateQueries({ queryKey: ["cheptelPens", farmId] });
    void qc.invalidateQueries({ queryKey: ["farmAnimals", farmId] });
  };

  if (contentsQ.isPending || !penMeta) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={mobileColors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.infoCard}>
          <Text style={styles.infoLab}>{t("cheptel.pens.categoryLabel")}</Text>
          <Text style={styles.infoVal}>{usageLabel}</Text>
          <Text style={styles.infoLab}>{t("cheptel.pens.occupancy")}</Text>
          <Text style={styles.infoVal}>
            {penMeta.occupancy} / {penMeta.capacity || "—"}
          </Text>
          <Text style={styles.infoLab}>{t("cheptel.pens.avgWeightField")}</Text>
          <TextInput
            style={styles.input}
            value={avgWeight}
            onChangeText={setAvgWeight}
            keyboardType="decimal-pad"
            onBlur={() => saveAveragesMut.mutate()}
          />
          <Text style={styles.infoLab}>{t("cheptel.pens.avgAgeField")}</Text>
          <TextInput
            style={styles.input}
            value={avgAge}
            onChangeText={setAvgAge}
            keyboardType="number-pad"
            onBlur={() => saveAveragesMut.mutate()}
          />
        </View>

        <View style={styles.quickBar}>
          <Pressable
            style={styles.quickBtn}
            onPress={() =>
              navigation.navigate("FarmHealth", { farmId, farmName })
            }
          >
            <Text style={styles.quickTx}>
              💉 {t("cheptel.pens.vaccinateLot")}
            </Text>
          </Pressable>
          <Pressable
            style={styles.quickBtn}
            onPress={() => setIsCreateAnimalVisible(true)}
          >
            <Text style={styles.quickTx}>➕ {t("cheptel.pens.addAnimal")}</Text>
          </Pressable>
        </View>

        {batchEventItems.length > 0 ? (
          <EventList
            layout="embedded"
            sectionTitle={t("cheptel.pens.batchesInPen")}
            data={batchEventItems}
            onItemPress={(item) => {
              const b = item.meta as PenBatchRowDto;
              navigation.navigate("BatchDetail", {
                farmId,
                farmName,
                batchId: b.id,
                batchName: b.name
              });
            }}
          />
        ) : null}

        <View style={styles.filterRow}>
          {(
            [
              ["all", t("cheptel.pens.filterAll")],
              ["male", t("cheptel.pens.filterMale")],
              ["female", t("cheptel.pens.filterFemale")],
              ["vaccine_late", t("cheptel.pens.filterVaccineLate")]
            ] as const
          ).map(([key, lab]) => (
            <Pressable
              key={key}
              style={[styles.filterPill, filter === key && styles.filterPillOn]}
              onPress={() => setFilter(key)}
            >
              <Text
                style={[
                  styles.filterPillTx,
                  filter === key && styles.filterPillTxOn
                ]}
              >
                {lab}
              </Text>
            </Pressable>
          ))}
        </View>

        <EventList
          layout="embedded"
          sectionTitle={t("cheptel.pens.animalsInPen")}
          data={animalEventItems}
          onItemPress={(item) =>
            setActionAnimal(item.meta as PenAnimalRowDto)
          }
          emptyMessage={
            batchEventItems.length > 0
              ? t("cheptel.pens.noAnimals")
              : t("cheptel.pens.noAnimalsInPen")
          }
        />
      </ScrollView>

      <AnimalActionModal
        visible={Boolean(actionAnimal)}
        animal={actionAnimal}
        onClose={() => setActionAnimal(null)}
        onTransfer={() => {
          const full = actionAnimal ? toListItem(actionAnimal) : null;
          setActionAnimal(null);
          if (full) {
            setTransferAnimal(full);
          }
        }}
        onChangeStatus={() => {
          const full = actionAnimal ? toListItem(actionAnimal) : null;
          setActionAnimal(null);
          if (full) {
            setStatusAnimal(full);
          }
        }}
        onAddWeight={() => {
          const full = actionAnimal ? toListItem(actionAnimal) : null;
          setActionAnimal(null);
          if (full) {
            setWeightAnimal(full);
          }
        }}
        onOpenHealth={() => {
          setActionAnimal(null);
          navigation.navigate("FarmHealth", { farmId, farmName });
        }}
        onOpenDetail={() => {
          const a = actionAnimal;
          setActionAnimal(null);
          if (a) {
            setDetailAnimal(toListItem(a));
          }
        }}
        onDeclareGestation={() => {
          setActionAnimal(null);
          navigation.navigate("FarmGestation", { farmId, farmName });
        }}
      />

      <ChangeStatusModal
        visible={Boolean(statusAnimal)}
        animal={statusAnimal}
        farmId={farmId}
        accessToken={accessToken!}
        activeProfileId={activeProfileId}
        onClose={() => setStatusAnimal(null)}
        onUpdated={invalidate}
      />

      <TransferModal
        visible={Boolean(transferAnimal)}
        initialAnimalId={transferAnimal?.id}
        farmId={farmId}
        accessToken={accessToken!}
        activeProfileId={activeProfileId}
        animals={allAnimalsQ.data ?? []}
        onClose={() => setTransferAnimal(null)}
        onTransferred={invalidate}
      />

      <AddWeightModal
        visible={Boolean(weightAnimal)}
        preselectedAnimalId={weightAnimal?.id}
        farmId={farmId}
        accessToken={accessToken!}
        activeProfileId={activeProfileId}
        onClose={() => setWeightAnimal(null)}
        onSaved={invalidate}
      />

      <CreateAnimalModal
        visible={isCreateAnimalVisible}
        farmId={farmId}
        accessToken={accessToken!}
        activeProfileId={activeProfileId}
        targetPen={
          penMeta
            ? {
                penId,
                penName: penMeta.name,
                barnId: penMeta.barnId,
                barnName: penMeta.barnName
              }
            : null
        }
        onClose={() => setIsCreateAnimalVisible(false)}
        onCreated={invalidate}
      />

      <AnimalDetailModal
        visible={Boolean(detailAnimal)}
        animal={detailAnimal}
        farmId={farmId}
        accessToken={accessToken!}
        activeProfileId={activeProfileId}
        onClose={() => setDetailAnimal(null)}
        onUpdated={invalidate}
        onTransfer={(a) => {
          setDetailAnimal(null);
          setTransferAnimal(a);
        }}
        onChangeStatus={(a) => {
          setDetailAnimal(null);
          setStatusAnimal(a);
        }}
        onAddWeight={(a) => {
          setDetailAnimal(null);
          setWeightAnimal(a);
        }}
        onOpenHealth={() => {
          setDetailAnimal(null);
          navigation.navigate("FarmHealth", { farmId, farmName });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mobileColors.canvas },
  scroll: { padding: mobileSpacing.md, paddingBottom: mobileSpacing.xl },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  infoCard: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  infoLab: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 8
  },
  infoVal: {
    ...mobileTypography.body,
    fontWeight: "600",
    color: mobileColors.textPrimary
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: 10,
    marginTop: 4,
    backgroundColor: mobileColors.background
  },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  filterPillOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  filterPillTx: { fontSize: 12, color: mobileColors.textSecondary },
  filterPillTxOn: { color: mobileColors.accent, fontWeight: "700" },
  quickBar: {
    flexDirection: "row",
    gap: 8,
    marginBottom: mobileSpacing.md
  },
  quickBtn: {
    flex: 1,
    backgroundColor: mobileColors.accentSoft,
    borderRadius: mobileRadius.md,
    paddingVertical: 12,
    alignItems: "center"
  },
  quickTx: { fontSize: 12, fontWeight: "700", color: mobileColors.accent }
});
