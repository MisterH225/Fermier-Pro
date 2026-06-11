import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useMemo, useState } from "react";
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
import { AnimalActionModal } from "../components/cheptel/animals/AnimalActionModal";
import { AnimalDetailModal } from "../components/cheptel/animals/AnimalDetailModal";
import { penAnimalToListItem } from "../components/cheptel/animals/animalUtils";
import { ChangeStatusModal } from "../components/cheptel/animals/ChangeStatusModal";
import { SaleModal, type SaleResult } from "../components/cheptel/animals/SaleModal";
import { DiseaseModal } from "../components/shared/DiseaseModal";
import { TransferModal } from "../components/cheptel/animals/TransferModal";
import { CreateAnimalModal } from "../components/cheptel/animals/CreateAnimalModal";
import { BulkAddAnimalsModal } from "../components/cheptel/animals/BulkAddAnimalsModal";
import { EditPenCapacityModal } from "../components/cheptel/pens/EditPenCapacityModal";
import { AddWeightModal } from "../components/cheptel/weight/AddWeightModal";
import { CreateGestationModal } from "../components/shared/CreateGestationModal";
import { useModal } from "../components/modals/useModal";
import { EventList, type EventItem } from "../components/lists";
import { useSession } from "../context/SessionContext";
import {
  fetchCheptelPens,
  fetchFarmAnimals,
  fetchPenContents,
  patchPenAverages,
  type AnimalListItem,
  type PenAnimalRowDto,
  type PenBatchRowDto
} from "../lib/api";
import {
  getPenVisualForPen,
  penVisualI18nKey,
  resolvePenVisualKey
} from "../components/cheptel/pens/penUsageVisual";
import { useScreenTitle } from "../hooks/useScreenTitle";
import type { RootStackParamList } from "../types/navigation";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileStatusSurfaces,
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
      a.healthStatus === "sick" ? "🤒" : null,
      a.activeGestation ? "🤱" : null
    ]
      .filter(Boolean)
      .join(" · "),
    value:
      a.currentWeightKg != null ? `${a.currentWeightKg} kg` : undefined,
    valueType:
      a.healthStatus === "sick" || a.vaccineOverdue ? "negative" : "neutral",
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
  const [capacityEditOpen, setCapacityEditOpen] = useState(false);
  const [actionAnimal, setActionAnimal] = useState<PenAnimalRowDto | null>(null);
  const [statusAnimal, setStatusAnimal] = useState<AnimalListItem | null>(null);
  const [saleAnimal, setSaleAnimal] = useState<AnimalListItem | null>(null);
  const [diseaseAnimal, setDiseaseAnimal] = useState<AnimalListItem | null>(null);
  const [transferAnimal, setTransferAnimal] = useState<AnimalListItem | null>(null);
  const [weightAnimal, setWeightAnimal] = useState<AnimalListItem | null>(null);
  const [detailAnimal, setDetailAnimal] = useState<AnimalListItem | null>(null);
  const [isCreateAnimalVisible, setIsCreateAnimalVisible] = useState(false);
  const [isBulkAnimalVisible, setIsBulkAnimalVisible] = useState(false);
  const [gestationSow, setGestationSow] = useState<PenAnimalRowDto | null>(null);
  const modal = useModal();

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

  const gestationFemales = useMemo(
    () =>
      (allAnimalsQ.data ?? []).filter(
        (a) => a.sex === "female" && a.status === "active"
      ),
    [allAnimalsQ.data]
  );
  const gestationMales = useMemo(
    () =>
      (allAnimalsQ.data ?? []).filter(
        (a) => a.sex === "male" && a.status === "active"
      ),
    [allAnimalsQ.data]
  );

  const invalidateCheptel = () => {
    void qc.invalidateQueries({ queryKey: ["penContents", farmId, penId] });
    void qc.invalidateQueries({ queryKey: ["cheptelPens", farmId] });
    void qc.invalidateQueries({ queryKey: ["gestation", farmId] });
    void qc.invalidateQueries({ queryKey: ["farmAnimals", farmId] });
  };

  const penAgeData = penMeta?.ageData ?? contentsQ.data?.ageData;

  useLayoutEffect(() => {
    if (penMeta?.averageWeightKg != null) {
      setAvgWeight(String(penMeta.averageWeightKg));
    }
    const manual = penAgeData?.averageAgeWeeksManual;
    if (manual != null) {
      setAvgAge(String(manual));
    } else if (penAgeData?.isManual !== true) {
      setAvgAge("");
    }
  }, [penMeta?.averageWeightKg, penAgeData?.averageAgeWeeksManual, penAgeData?.isManual]);

  const saveAveragesMut = useMutation({
    mutationFn: () => {
      const ageRaw = avgAge.trim()
        ? Number.parseInt(avgAge, 10)
        : null;
      const ageWeeks =
        ageRaw == null || !Number.isFinite(ageRaw)
          ? null
          : Math.min(104, Math.max(0, ageRaw));
      return patchPenAverages(
        accessToken!,
        farmId,
        penId,
        {
          averageWeightKg: avgWeight.trim()
            ? Number.parseFloat(avgWeight)
            : null,
          averageAgeWeeksManual: ageWeeks
        },
        activeProfileId
      );
    },
    onSuccess: () => {
      void pensQ.refetch();
      void contentsQ.refetch();
    }
  });

  const penVisual = penMeta ? getPenVisualForPen(penMeta) : null;
  const penVisualKey = penMeta ? resolvePenVisualKey(penMeta) : "empty";
  const usageLabel = t(`cheptel.pens.visual.${penVisualI18nKey(penVisualKey)}`);

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
        <View
          style={[
            styles.infoCard,
            penVisual
              ? {
                  backgroundColor: penVisual.bg,
                  borderColor: penVisual.border,
                  borderLeftWidth: 4,
                  borderLeftColor: penVisual.accent
                }
              : null
          ]}
        >
          <Text style={styles.infoLab}>{t("cheptel.pens.categoryLabel")}</Text>
          <View
            style={[
              styles.categoryBadge,
              penVisual ? { backgroundColor: penVisual.iconBg } : null
            ]}
          >
            <Text
              style={[
                styles.infoVal,
                penVisual ? { color: penVisual.accent, fontWeight: "700" } : null
              ]}
            >
              {usageLabel}
            </Text>
          </View>
          <Text style={styles.infoLab}>{t("cheptel.pens.occupancy")}</Text>
          <Text style={styles.infoVal}>
            {penMeta.occupancy} / {penMeta.capacity || "—"}
          </Text>
          <Text style={styles.infoLab}>{t("cheptel.pens.capacity")}</Text>
          <View style={styles.capacityRow}>
            <Text style={styles.infoVal}>
              {penMeta.capacity > 0 ? penMeta.capacity : "—"}
            </Text>
            <Pressable
              style={styles.editCapBtn}
              onPress={() => setCapacityEditOpen(true)}
            >
              <Text style={styles.editCapBtnText}>
                {t("cheptel.pens.editCapacityAction")}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.infoLab}>{t("cheptel.pens.avgWeightField")}</Text>
          <TextInput
            style={styles.input}
            value={avgWeight}
            onChangeText={setAvgWeight}
            keyboardType="decimal-pad"
            onBlur={() => saveAveragesMut.mutate()}
          />
          <Text style={styles.sectionTitle}>{t("cheptel.pens.avgAgeSection")}</Text>
          {penAgeData?.displayAgeWeeks != null && !penAgeData.isManual ? (
            <>
              <Text style={styles.ageValue}>
                {t("cheptel.pens.avgAgeCalculated", {
                  weeks: penAgeData.displayAgeWeeks
                })}
              </Text>
              <Text style={styles.ageSub}>
                {penAgeData.animalsWithoutAgeCount > 0
                  ? t("cheptel.pens.avgAgePartial", {
                      with: penAgeData.animalsWithAgeCount,
                      total:
                        penAgeData.animalsWithAgeCount +
                        penAgeData.animalsWithoutAgeCount,
                      without: penAgeData.animalsWithoutAgeCount
                    })
                  : t("cheptel.pens.avgAgeFromAnimals", {
                      count: penAgeData.animalsWithAgeCount
                    })}
              </Text>
              <View style={styles.autoBadge}>
                <Text style={styles.autoBadgeTx}>
                  {t("cheptel.pens.avgAgeAutoBadge")}
                </Text>
              </View>
            </>
          ) : penAgeData?.isManual && penAgeData.displayAgeWeeks != null ? (
            <>
              <Text style={styles.ageValue}>
                {t("cheptel.pens.avgAgeCalculated", {
                  weeks: penAgeData.displayAgeWeeks
                })}
              </Text>
              <View style={styles.manualBadge}>
                <Text style={styles.manualBadgeTx}>
                  {t("cheptel.pens.avgAgeManualBadge")}
                </Text>
              </View>
              <Text style={styles.infoLab}>
                {t("cheptel.pens.avgAgeManualEdit")}
              </Text>
              <TextInput
                style={styles.input}
                value={avgAge}
                onChangeText={setAvgAge}
                keyboardType="number-pad"
                onBlur={() => saveAveragesMut.mutate()}
              />
            </>
          ) : (
            <>
              <Text style={styles.ageMuted}>{t("cheptel.pens.avgAgeWeeksEmpty")}</Text>
              <Text style={styles.infoLab}>
                {t("cheptel.pens.avgAgeManualEdit")}
              </Text>
              <TextInput
                style={styles.input}
                value={avgAge}
                onChangeText={setAvgAge}
                keyboardType="number-pad"
                placeholder={t("cheptel.pens.avgAgeManualPlaceholder")}
                onBlur={() => saveAveragesMut.mutate()}
              />
            </>
          )}
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
            onLongPress={() => setIsBulkAnimalVisible(true)}
            delayLongPress={400}
          >
            <Text style={styles.quickTx}>➕ {t("cheptel.pens.addAnimal")}</Text>
          </Pressable>
          <Pressable
            style={styles.quickBtn}
            onPress={() => setIsBulkAnimalVisible(true)}
          >
            <Text style={styles.quickTx}>
              ➕➕ {t("cheptel.pens.addSeveral")}
            </Text>
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
          const a = actionAnimal;
          if (!a) {
            return;
          }
          if (a.activeGestation) {
            Alert.alert("", t("cheptel.actions.gestationAlreadyActive"));
            return;
          }
          setGestationSow(a);
          setActionAnimal(null);
        }}
        onListForSale={() => {
          const full = actionAnimal ? toListItem(actionAnimal) : null;
          setActionAnimal(null);
          if (full) {
            setSaleAnimal(full);
          }
        }}
      />

      <CreateGestationModal
        visible={Boolean(gestationSow)}
        farmId={farmId}
        accessToken={accessToken!}
        activeProfileId={activeProfileId}
        females={gestationFemales}
        males={gestationMales}
        presetSowId={gestationSow?.id}
        presetSowLabel={
          gestationSow?.tagCode?.trim() ||
          (gestationSow
            ? `FP-${gestationSow.publicId.slice(-6)}`
            : undefined)
        }
        penId={penId}
        onClose={() => setGestationSow(null)}
        onCreated={invalidateCheptel}
        onSuccess={(gestation) => {
          setGestationSow(null);
          invalidateCheptel();
          const date = gestation.expectedBirthDate?.slice(0, 10) ?? "—";
          modal.open("success", {
            title: t("gestationScreen.createSuccessTitle"),
            message: t("gestationScreen.createSuccessWithDate", { date }),
            autoDismissMs: 4000
          });
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
        onRequestSale={(a) => setSaleAnimal(a)}
        onRequestDisease={(a) => setDiseaseAnimal(a)}
      />

      <DiseaseModal
        visible={Boolean(diseaseAnimal)}
        presetAnimal={diseaseAnimal}
        farmId={farmId}
        accessToken={accessToken!}
        activeProfileId={activeProfileId}
        onClose={() => setDiseaseAnimal(null)}
        onSuccess={invalidate}
      />

      <SaleModal
        visible={Boolean(saleAnimal)}
        animal={saleAnimal}
        farmId={farmId}
        accessToken={accessToken!}
        activeProfileId={activeProfileId}
        onCancel={() => setSaleAnimal(null)}
        onSuccess={(sale: SaleResult) => {
          setSaleAnimal(null);
          invalidate();
          const tag =
            sale.animal.tagCode?.trim() ||
            sale.animal.publicId?.slice(0, 8) ||
            "—";
          const amount = Number(sale.transaction.amount);
          modal.open("success", {
            title: t("cheptel.animals.sale.successTitle"),
            message: t("cheptel.animals.sale.successMessage", {
              tag,
              amount: amount.toLocaleString("fr-FR"),
              currency: sale.transaction.currency
            }),
            autoDismissMs: 3500
          });
        }}
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
        onCreated={invalidateCheptel}
      />

      <BulkAddAnimalsModal
        visible={isBulkAnimalVisible}
        farmId={farmId}
        accessToken={accessToken!}
        activeProfileId={activeProfileId}
        targetPen={
          penMeta
            ? {
                penId,
                penName: penMeta.name,
                barnName: penMeta.barnName
              }
            : null
        }
        onClose={() => setIsBulkAnimalVisible(false)}
        onCreated={invalidateCheptel}
      />

      <EditPenCapacityModal
        visible={capacityEditOpen && penMeta != null}
        pen={penMeta ?? null}
        farmId={farmId}
        accessToken={accessToken!}
        activeProfileId={activeProfileId}
        onClose={() => setCapacityEditOpen(false)}
        onSaved={invalidateCheptel}
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
        onListForSale={(a) => {
          setDetailAnimal(null);
          setSaleAnimal(a);
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
  categoryBadge: {
    alignSelf: "flex-start",
    borderRadius: mobileRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 2,
    marginBottom: 4
  },
  capacityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing.sm
  },
  editCapBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.accentSoft
  },
  editCapBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: mobileColors.accent
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: 10,
    marginTop: 4,
    backgroundColor: mobileColors.background
  },
  sectionTitle: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    marginTop: 12
  },
  ageValue: {
    ...mobileTypography.title,
    fontSize: 20,
    color: mobileColors.textPrimary,
    marginTop: 4
  },
  ageSub: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 4
  },
  ageMuted: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    opacity: 0.75,
    marginTop: 4
  },
  autoBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileStatusSurfaces.successBg
  },
  autoBadgeTx: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileStatusSurfaces.successText
  },
  manualBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.accentSoft
  },
  manualBadgeTx: { fontSize: 12, fontWeight: "600", color: mobileColors.accent },
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
