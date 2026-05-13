import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useSession } from "../context/SessionContext";
import { ProducerEventsFab } from "../components/producer/ProducerEventsFab";
import {
  type AnimalListItem,
  type BatchListItem,
  type CheptelStatusLogRow,
  fetchFarm,
  fetchFarmAnimals,
  fetchFarmBatches,
  fetchFarmCheptelOverview,
  fetchFarmCheptelStatusLogs,
  patchAnimalStatus
} from "../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "FarmLivestock">;

const ANCHORS = ["overview", "animals", "batches", "statuses"] as const;

type AnchorKey = (typeof ANCHORS)[number];

function formatKg(v: string | number | undefined): string {
  if (v === undefined || v === null) {
    return "—";
  }
  const n = typeof v === "string" ? Number.parseFloat(v) : Number(v);
  if (!Number.isFinite(n)) {
    return String(v);
  }
  return `${n.toFixed(1)} kg`;
}

export function FarmLivestockScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { t } = useTranslation();
  const { accessToken, activeProfileId, authMe } = useSession();
  const isProducer =
    authMe?.profiles.find((p) => p.id === activeProfileId)?.type === "producer";
  const qc = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Partial<Record<AnchorKey, number>>>({});

  const farmQuery = useQuery({
    queryKey: ["farm", farmId, activeProfileId],
    queryFn: () => fetchFarm(accessToken!, farmId, activeProfileId)
  });

  const cheptelQuery = useQuery({
    queryKey: ["farmCheptel", farmId, activeProfileId],
    queryFn: () => fetchFarmCheptelOverview(accessToken!, farmId, activeProfileId)
  });

  const animalsQuery = useQuery({
    queryKey: ["farmAnimals", farmId, activeProfileId],
    queryFn: () => fetchFarmAnimals(accessToken!, farmId, activeProfileId)
  });

  const batchesQuery = useQuery({
    queryKey: ["farmBatches", farmId, activeProfileId],
    queryFn: () => fetchFarmBatches(accessToken!, farmId, activeProfileId)
  });

  const [logEntityType, setLogEntityType] = useState<string | undefined>(
    undefined
  );

  const logsQuery = useQuery({
    queryKey: ["farmCheptelLogs", farmId, activeProfileId, logEntityType],
    queryFn: () =>
      fetchFarmCheptelStatusLogs(accessToken!, farmId, activeProfileId, {
        entityType: logEntityType,
        limit: 250
      })
  });

  const patchStatusMut = useMutation({
    mutationFn: (p: {
      animalId: string;
      status: "active" | "dead" | "sold" | "reformed" | "transferred";
    }) =>
      patchAnimalStatus(accessToken!, farmId, p.animalId, { status: p.status }, activeProfileId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["farmAnimals", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmCheptel", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmCheptelLogs", farmId] });
    }
  });

  const refreshing =
    farmQuery.isFetching ||
    cheptelQuery.isFetching ||
    animalsQuery.isFetching ||
    batchesQuery.isFetching ||
    logsQuery.isFetching;

  const onRefresh = useCallback(() => {
    void farmQuery.refetch();
    void cheptelQuery.refetch();
    void animalsQuery.refetch();
    void batchesQuery.refetch();
    void logsQuery.refetch();
  }, [farmQuery, cheptelQuery, animalsQuery, batchesQuery, logsQuery]);

  const loading =
    farmQuery.isPending ||
    cheptelQuery.isPending ||
    animalsQuery.isPending ||
    batchesQuery.isPending;

  const errMsg =
    (farmQuery.error as Error | undefined)?.message ||
    (cheptelQuery.error as Error | undefined)?.message ||
    (animalsQuery.error as Error | undefined)?.message ||
    (batchesQuery.error as Error | undefined)?.message;

  const livestockMode =
    (farmQuery.data?.livestockMode as "individual" | "batch" | "hybrid") ||
    (cheptelQuery.data?.farm.livestockMode as "individual" | "batch" | "hybrid") ||
    "individual";

  const showAnimals = livestockMode === "individual" || livestockMode === "hybrid";
  const showBatches = livestockMode === "batch" || livestockMode === "hybrid";

  const kpis = cheptelQuery.data?.kpis;

  const animals = animalsQuery.data ?? [];
  const batches = batchesQuery.data ?? [];
  const logs = logsQuery.data ?? [];

  const females = useMemo(
    () => animals.filter((a) => a.sex === "female"),
    [animals]
  );
  const males = useMemo(
    () => animals.filter((a) => a.sex === "male"),
    [animals]
  );

  const scrollToAnchor = (key: AnchorKey) => {
    const y = sectionY.current[key];
    if (y != null) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
    }
  };

  const promptAnimalStatus = (a: AnimalListItem) => {
    const tag = a.tagCode || a.publicId.slice(0, 8);
    const opts: {
      text: string;
      status: "active" | "dead" | "sold" | "reformed" | "transferred";
    }[] = [
      { text: "Actif", status: "active" },
      { text: "Mort", status: "dead" },
      { text: "Vendu", status: "sold" },
      { text: "Réformé", status: "reformed" },
      { text: "Transféré", status: "transferred" }
    ];
    Alert.alert(
      `${t("cheptel.changeStatus")} — ${tag}`,
      undefined,
      [
        ...opts.map((o) => ({
          text: o.text,
          onPress: () =>
            patchStatusMut.mutate({ animalId: a.id, status: o.status })
        })),
        { text: t("cheptel.cancel"), style: "cancel" }
      ]
    );
  };

  const exportLogsCsv = async () => {
    const rows = logs as CheptelStatusLogRow[];
    const header = "date,entityType,entityId,oldStatus,newStatus,note,recorder\n";
    const body = rows
      .map((r) =>
        [
          r.createdAt,
          r.entityType,
          r.entityId,
          r.oldStatus ?? "",
          r.newStatus,
          (r.note ?? "").replace(/"/g, '""'),
          r.recorder?.email ?? r.recorder?.id ?? ""
        ]
          .map((c) => `"${String(c)}"`)
          .join(",")
      )
      .join("\n");
    const csv = header + body;
    try {
      await Share.share({
        message: csv,
        title: `${farmName} — statuts`
      });
    } catch {
      /* ignore share cancel */
    }
  };

  const recordSectionLayout = (key: AnchorKey, y: number) => {
    sectionY.current[key] = y;
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={mobileColors.accent} />
        <Text style={styles.sub}>{farmName}</Text>
      </View>
    );
  }

  if (errMsg) {
    return (
      <ScrollView
        contentContainerStyle={styles.centered}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.error}>{errMsg}</Text>
        <Text style={styles.hint}>
          Accès refusé ? Vérifie ton rôle sur la ferme (scopes livestock) ou
          change de profil actif.
        </Text>
      </ScrollView>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.anchorBar}
        contentContainerStyle={styles.anchorBarInner}
      >
        {ANCHORS.map((k) => (
          <TouchableOpacity
            key={k}
            style={styles.anchorChip}
            onPress={() => scrollToAnchor(k)}
          >
            <Text style={styles.anchorChipText}>
              {t(`cheptel.nav${k.charAt(0).toUpperCase()}${k.slice(1)}` as const)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.farmTitle}>{farmName}</Text>

        <View
          onLayout={(e) =>
            recordSectionLayout("overview", e.nativeEvent.layout.y)
          }
        >
          <Text style={styles.sectionTitle}>{t("cheptel.sectionOverview")}</Text>
          {livestockMode === "hybrid" ? (
            <Text style={styles.modeHint}>{t("cheptel.hybridHint")}</Text>
          ) : null}
          {livestockMode === "batch" ? (
            <Text style={styles.modeHint}>{t("cheptel.batchOnlyHint")}</Text>
          ) : null}
          {livestockMode === "individual" ? (
            <Text style={styles.modeHint}>{t("cheptel.individualHint")}</Text>
          ) : null}

          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiVal}>{kpis?.totalAnimals ?? "—"}</Text>
              <Text style={styles.kpiLab}>{t("cheptel.totalAnimals")}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiVal}>{kpis?.maleAnimals ?? "—"}</Text>
              <Text style={styles.kpiLab}>{t("cheptel.males")}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiVal}>{kpis?.femaleAnimals ?? "—"}</Text>
              <Text style={styles.kpiLab}>{t("cheptel.females")}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiVal}>{kpis?.totalBatchHeadcount ?? "—"}</Text>
              <Text style={styles.kpiLab}>{t("cheptel.batchHead")}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiVal}>
                {kpis?.occupancyRate != null ? `${kpis.occupancyRate}%` : "—"}
              </Text>
              <Text style={styles.kpiLab}>{t("cheptel.occupancy")}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiVal}>{kpis?.penOccupancyHeadcount ?? "—"}</Text>
              <Text style={styles.kpiLab}>{t("cheptel.penOcc")}</Text>
            </View>
          </View>
        </View>

        {showAnimals ? (
          <View
            onLayout={(e) =>
              recordSectionLayout("animals", e.nativeEvent.layout.y)
            }
          >
            <Text style={[styles.sectionTitle, styles.sectionSpacer]}>
              {t("cheptel.sectionAnimals")}
            </Text>
            <Text style={styles.subSection}>{t("cheptel.reproductors")}</Text>
            <Text style={styles.metaLine}>
              {t("cheptel.males")} : {males.length} · {t("cheptel.females")} :{" "}
              {females.length}
            </Text>
            {livestockMode === "hybrid" ? (
              <Text style={styles.subSection}>{t("cheptel.growthBatches")}</Text>
            ) : null}
            {animals.length === 0 ? (
              <Text style={styles.empty}>{t("cheptel.emptyAnimals")}</Text>
            ) : (
              animals.map((a) => {
                const tag = a.tagCode || a.publicId.slice(0, 8);
                const w = a.weights[0];
                return (
                  <View key={a.id} style={styles.card}>
                    <TouchableOpacity
                      onPress={() =>
                        navigation.navigate("AnimalDetail", {
                          farmId,
                          farmName,
                          animalId: a.id,
                          headline: tag
                        })
                      }
                    >
                      <Text style={styles.cardTitle}>
                        {tag} · {a.species.name}
                      </Text>
                      <Text style={styles.cardSub}>
                        {a.sex}
                        {a.breed ? ` · ${a.breed.name}` : ""}
                      </Text>
                      <Text style={styles.cardMeta}>
                        {t("cheptel.lastWeight")} {formatKg(w?.weightKg)}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.statusBtn}
                      onPress={() => promptAnimalStatus(a)}
                      disabled={patchStatusMut.isPending}
                    >
                      <Text style={styles.statusBtnText}>
                        {t("cheptel.changeStatus")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        ) : null}

        {showBatches ? (
          <View
            onLayout={(e) =>
              recordSectionLayout("batches", e.nativeEvent.layout.y)
            }
          >
            <Text style={[styles.sectionTitle, styles.sectionSpacer]}>
              {t("cheptel.sectionBatches")}
            </Text>
            {batches.length === 0 ? (
              <Text style={styles.empty}>{t("cheptel.emptyBatches")}</Text>
            ) : (
              batches.map((b: BatchListItem) => {
                const w = b.weights?.[0];
                return (
                  <TouchableOpacity
                    key={b.id}
                    style={styles.card}
                    activeOpacity={0.75}
                    onPress={() =>
                      navigation.navigate("BatchDetail", {
                        farmId,
                        farmName,
                        batchId: b.id,
                        batchName: b.name
                      })
                    }
                  >
                    <Text style={styles.cardTitle}>
                      {b.name} · {b.headcount} tête{b.headcount > 1 ? "s" : ""}
                    </Text>
                    <Text style={styles.cardSub}>
                      {b.species.name}
                      {b.breed ? ` · ${b.breed.name}` : ""} · {b.status}
                    </Text>
                    {b.expectedExitAt ? (
                      <Text style={styles.cardMeta}>
                        {t("cheptel.expectedExit")} :{" "}
                        {new Date(b.expectedExitAt).toLocaleDateString("fr-FR")}
                      </Text>
                    ) : null}
                    {b.closedAt ? (
                      <Text style={styles.cardMeta}>
                        {t("cheptel.closedAt")} :{" "}
                        {new Date(b.closedAt).toLocaleDateString("fr-FR")}
                      </Text>
                    ) : null}
                    <Text style={styles.cardMeta}>
                      Poids moyen : {formatKg(w?.avgWeightKg)}
                    </Text>
                    <Text style={styles.cardHint}>{t("cheptel.openDetail")}</Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        ) : null}

        <View
          onLayout={(e) =>
            recordSectionLayout("statuses", e.nativeEvent.layout.y)
          }
        >
          <Text style={[styles.sectionTitle, styles.sectionSpacer]}>
            {t("cheptel.sectionStatuses")}
          </Text>
          <View style={styles.filterRow}>
            {(
              [
                [undefined, t("cheptel.filterAll")],
                ["animal", t("cheptel.filterAnimal")],
                ["batch", t("cheptel.filterBatch")]
              ] as const
            ).map(([val, lab]) => (
              <TouchableOpacity
                key={String(val)}
                style={[
                  styles.filterChip,
                  logEntityType === val && styles.filterChipOn
                ]}
                onPress={() => setLogEntityType(val)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    logEntityType === val && styles.filterChipTextOn
                  ]}
                >
                  {lab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.csvBtn} onPress={() => void exportLogsCsv()}>
            <Text style={styles.csvBtnText}>{t("cheptel.exportCsv")}</Text>
          </TouchableOpacity>
          {logs.length === 0 ? (
            <Text style={styles.empty}>{t("cheptel.noLogs")}</Text>
          ) : (
            logs.map((r: CheptelStatusLogRow) => (
              <View key={r.id} style={styles.logRow}>
                <Text style={styles.logDate}>
                  {new Date(r.createdAt).toLocaleString("fr-FR")}
                </Text>
                <Text style={styles.logBody}>
                  {r.entityType} {r.entityId.slice(0, 8)}… : {r.oldStatus ?? "—"}{" "}
                  → {r.newStatus}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
      {isProducer ? (
        <View style={styles.fabLayer} pointerEvents="box-none">
          <ProducerEventsFab
            onPress={() => navigation.navigate("FarmEventsFeed")}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: mobileColors.background
  },
  fabLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    alignItems: "flex-end",
    pointerEvents: "box-none"
  },
  anchorBar: {
    maxHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border,
    backgroundColor: mobileColors.surfaceMuted
  },
  anchorBarInner: {
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: mobileSpacing.xs,
    gap: 8,
    alignItems: "center"
  },
  anchorChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    marginRight: 8
  },
  anchorChipText: {
    ...mobileTypography.meta,
    fontSize: 12,
    fontWeight: "600",
    color: mobileColors.textPrimary
  },
  scroll: {
    flex: 1
  },
  content: {
    padding: mobileSpacing.lg,
    paddingBottom: 48
  },
  centered: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: mobileColors.background,
    minHeight: 400
  },
  sub: {
    marginTop: 12,
    color: mobileColors.textSecondary
  },
  farmTitle: {
    ...mobileTypography.title,
    fontSize: 20,
    marginBottom: mobileSpacing.md
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: mobileColors.accent
  },
  sectionSpacer: {
    marginTop: mobileSpacing.xl
  },
  subSection: {
    ...mobileTypography.body,
    fontWeight: "600",
    marginTop: mobileSpacing.md,
    color: mobileColors.textPrimary
  },
  metaLine: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.sm
  },
  modeHint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.md,
    lineHeight: 18
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  kpiCard: {
    width: "47%",
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.lg,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  kpiVal: {
    fontSize: 22,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  kpiLab: {
    ...mobileTypography.meta,
    marginTop: 4,
    color: mobileColors.textSecondary
  },
  empty: {
    color: mobileColors.textSecondary,
    fontSize: 14,
    fontStyle: "italic",
    marginBottom: 8
  },
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: mobileColors.textPrimary
  },
  cardSub: {
    marginTop: 4,
    fontSize: 13,
    color: mobileColors.textSecondary
  },
  cardMeta: {
    marginTop: 6,
    fontSize: 12,
    color: mobileColors.textSecondary
  },
  cardHint: {
    marginTop: 8,
    fontSize: 12,
    color: mobileColors.accent,
    fontWeight: "600"
  },
  statusBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  statusBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: mobileColors.accent
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: mobileSpacing.md
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: mobileRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  filterChipOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  filterChipText: {
    fontSize: 12,
    color: mobileColors.textSecondary
  },
  filterChipTextOn: {
    color: mobileColors.accent,
    fontWeight: "600"
  },
  csvBtn: {
    alignSelf: "flex-start",
    marginBottom: mobileSpacing.md
  },
  csvBtnText: {
    color: mobileColors.accent,
    fontWeight: "600"
  },
  logRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border
  },
  logDate: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  logBody: {
    ...mobileTypography.body,
    fontSize: 14,
    marginTop: 4,
    color: mobileColors.textPrimary
  },
  error: {
    color: mobileColors.error,
    textAlign: "center",
    marginBottom: 12
  },
  hint: {
    fontSize: 13,
    color: mobileColors.textSecondary,
    textAlign: "center",
    lineHeight: 18
  }
});
