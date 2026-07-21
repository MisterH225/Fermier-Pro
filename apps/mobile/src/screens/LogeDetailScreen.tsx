import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useMemo, useState, useCallback, type ReactNode } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { AnimalDetailModal } from "../components/cheptel/animals/AnimalDetailModal";
import { AnimalActionModal } from "../components/cheptel/animals/AnimalActionModal";
import { CheptelAnimalActionModals } from "../components/cheptel/animals/CheptelAnimalActionModals";
import { CreateAnimalModal } from "../components/cheptel/animals/CreateAnimalModal";
import { BulkAddAnimalsModal } from "../components/cheptel/animals/BulkAddAnimalsModal";
import {
  penAnimalDisplayTag,
  penAnimalToEventItem,
  penBatchToEventItem,
  resolvePenAnimalListItem
} from "../components/cheptel/animals/penDisplayUtils";
import {
  animalStatusForExitKind,
  type LivestockExitKind
} from "../components/cheptel/exits/livestockExitKind";
import { EditPenCapacityModal } from "../components/cheptel/pens/EditPenCapacityModal";
import { CreateGestationModal } from "../components/shared/CreateGestationModal";
import { useModal } from "../components/modals/useModal";
import { EventList, type EventItem } from "../components/lists";
import { useSession } from "../context/SessionContext";
import { useCheptelAnimalActions } from "../hooks/useCheptelAnimalActions";
import {
  fetchFarmAnimals,
  fetchPenContents,
  patchPenAverages,
  type AnimalListItem,
  type PenAnimalRowDto,
  type PenBatchRowDto
} from "../lib/api";
import {
  CHEPTEL_ANIMAL_MUTATION_ROOTS,
  invalidateCheptelCaches
} from "../lib/cheptelQueries";
import { useCheptelPens } from "../lib/cheptelPensQuery";
import {
  getPenVisualForPen,
  penVisualI18nKey,
  resolvePenVisualKey
} from "../components/cheptel/pens/penUsageVisual";
import { useDeleteFarmBatch } from "../hooks/useDeleteFarmBatch";
import { useScreenTitle } from "../hooks/useScreenTitle";
import type { RootStackParamList } from "../types/navigation";
import { mobileColors, mobileRadius, mobileSpacing, mobileStatusSurfaces, mobileTypography, mobileFontSize } from "../theme/mobileTheme";

type Props = NativeStackScreenProps<RootStackParamList, "LogeDetail">;
type AnimalFilter = "all" | "male" | "female" | "vaccine_late";

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
  const [detailAnimal, setDetailAnimal] = useState<AnimalListItem | null>(null);
  const [isCreateAnimalVisible, setIsCreateAnimalVisible] = useState(false);
  const [isBulkAnimalVisible, setIsBulkAnimalVisible] = useState(false);
  const [gestationSow, setGestationSow] = useState<PenAnimalRowDto | null>(null);
  const animalActions = useCheptelAnimalActions();
  const modal = useModal();

  const pensQ = useCheptelPens({
    farmId,
    accessToken,
    activeProfileId
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

  const penContext = penMeta
    ? {
        id: penMeta.id,
        name: penMeta.name,
        barnId: penMeta.barnId,
        barnName: penMeta.barnName
      }
    : null;

  const toListItem = (a: PenAnimalRowDto): AnimalListItem | null =>
    resolvePenAnimalListItem(a, allAnimalsQ.data, penContext);

  const openFromAction = (
    opener: (animal: AnimalListItem) => void
  ) => {
    const full = actionAnimal ? toListItem(actionAnimal) : null;
    setActionAnimal(null);
    if (full) {
      opener(full);
    }
  };

  const animalEventItems: EventItem[] = useMemo(
    () => filteredAnimals.map((a) => penAnimalToEventItem(a, t)),
    [filteredAnimals, t]
  );

  const batchEventItems: EventItem[] = useMemo(
    () => batches.map((b) => penBatchToEventItem(b, t)),
    [batches, t]
  );

  const { confirmDelete: confirmDeleteBatch } = useDeleteFarmBatch({
    farmId,
    accessToken: accessToken!,
    activeProfileId,
    onDeleted: () => {
      void qc.invalidateQueries({ queryKey: ["penContents", farmId, penId] });
      invalidateCheptelCaches(qc, farmId, CHEPTEL_ANIMAL_MUTATION_ROOTS);
    }
  });

  const renderBatchSwipeDelete = useCallback(
    (item: EventItem) => {
      const batch = item.meta as PenBatchRowDto;
      if (batch.headcount > 0) {
        return null;
      }
      return (
        <Pressable
          style={styles.swipeDelete}
          onPress={() => confirmDeleteBatch(batch)}
          accessibilityRole="button"
          accessibilityLabel={t("cheptel.batches.deleteA11y")}
        >
          <Ionicons name="trash-outline" size={20} color={mobileColors.background} />
          <Text style={styles.swipeDeleteTx}>
            {t("cheptel.batches.deleteConfirm")}
          </Text>
        </Pressable>
      );
    },
    [confirmDeleteBatch, t]
  );

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["penContents", farmId, penId] });
    invalidateCheptelCaches(qc, farmId, CHEPTEL_ANIMAL_MUTATION_ROOTS);
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
            renderSwipeRight={renderBatchSwipeDelete}
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
        onTransfer={() => openFromAction(animalActions.openTransfer)}
        onExitVerb={(kind: LivestockExitKind) => {
          const full = actionAnimal ? toListItem(actionAnimal) : null;
          setActionAnimal(null);
          if (!full) {
            return;
          }
          if (kind === "sale") {
            animalActions.openSellChooser(full);
            return;
          }
          animalActions.openStatus(full, animalStatusForExitKind(kind));
        }}
        onAddWeight={() => openFromAction(animalActions.openWeight)}
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
          gestationSow ? penAnimalDisplayTag(gestationSow) : undefined
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

      <CheptelAnimalActionModals
        farmId={farmId}
        accessToken={accessToken!}
        activeProfileId={activeProfileId}
        animals={allAnimalsQ.data ?? []}
        actions={animalActions}
        onInvalidate={invalidate}
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
          animalActions.openTransfer(a);
        }}
        onExitVerb={(a, kind) => {
          setDetailAnimal(null);
          if (kind === "sale") {
            animalActions.openSellChooser(a);
            return;
          }
          animalActions.openStatus(a, animalStatusForExitKind(kind));
        }}
        onAddWeight={(a) => {
          setDetailAnimal(null);
          animalActions.openWeight(a);
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
    fontSize: mobileFontSize.sm,
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
    fontSize: mobileFontSize.xl,
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
    fontSize: mobileFontSize.sm,
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
  manualBadgeTx: { fontSize: mobileFontSize.sm, fontWeight: "600", color: mobileColors.accent },
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
  filterPillTx: { fontSize: mobileFontSize.sm, color: mobileColors.textSecondary },
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
  quickTx: { fontSize: mobileFontSize.sm, fontWeight: "700", color: mobileColors.accent },
  swipeDelete: {
    backgroundColor: mobileColors.error,
    justifyContent: "center",
    alignItems: "center",
    width: 96,
    marginVertical: 4,
    borderTopRightRadius: mobileRadius.md,
    borderBottomRightRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.sm,
    gap: 4
  },
  swipeDeleteTx: {
    color: mobileColors.background,
    fontSize: mobileFontSize.xs,
    fontWeight: "700",
    textAlign: "center"
  }
});
