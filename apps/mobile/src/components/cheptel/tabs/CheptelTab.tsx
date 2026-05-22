import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useEffect, useMemo, useRef, useState } from "react";

import { useTranslation } from "react-i18next";

import {

  ActivityIndicator,

  Pressable,

  ScrollView,

  StyleSheet,

  Text,

  View

} from "react-native";

import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import {

  applyCheptelDefaultPenLayout,

  deleteCheptelPen,

  fetchCheptelPens,

  patchPenToggleActive,

  type CheptelPenRowDto

} from "../../../lib/api";

import { useSession } from "../../../context/SessionContext";

import type { RootStackParamList } from "../../../types/navigation";

import {

  mobileColors,

  mobileRadius,

  mobileSpacing,

  mobileTypography

} from "../../../theme/mobileTheme";

import { ScreenSection } from "../../layout/ScreenSection";

import { PenCard } from "../pens/PenCard";

import { CreateLogeModal } from "../pens/CreateLogeModal";



type Nav = NativeStackNavigationProp<RootStackParamList, "FarmLivestock">;



type Props = {

  farmId: string;

  farmName: string;

  navigation: Nav;

  onInvalidateOverview?: () => void;

};



function sortPensTopToBottom(a: CheptelPenRowDto, b: CheptelPenRowDto) {

  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "fr");

}



function penDisplayLabel(pen: CheptelPenRowDto): string {

  return pen.code?.trim() || pen.name;

}



function barnDisplayLabel(barn: { name: string; code?: string | null }): string {

  const code = barn.code?.trim();

  if (code && /^[A-Z]$/i.test(code)) {

    return `Bâtiment ${code.toUpperCase()}`;

  }

  const m = /^Bâtiment\s+([A-Z])$/i.exec(barn.name.trim());

  if (m) {

    return `Bâtiment ${m[1].toUpperCase()}`;

  }

  return barn.name;

}



/** Incrémenter après changement de logique de répartition côté API. */
const LAYOUT_REPAIR_VERSION = 4;



function pensNeedLayoutRepair(

  pens: CheptelPenRowDto[],

  barns: Array<{ name: string; code?: string | null }>

): boolean {

  const legacyPen = pens.some((p) => {

    const label = p.code?.trim() || p.name;

    return /^Loge\s*\d/i.test(label) || !/^[A-Z]-\d+$/i.test(label);

  });

  const legacyBarn = barns.some(

    (b) =>

      /^Bâtiment\s+\d+$/i.test(b.name) &&

      !(b.code && /^[A-Z]$/i.test(b.code.trim()))

  );

  const overcrowded = pens.some(

    (p) => p.capacity > 0 && p.occupancy > p.capacity

  );

  const sharedBoarPen = pens.some((p) => (p.maleCount ?? 0) > 1);

  const missingUsage = pens.some(

    (p) =>

      p.occupancy > 0 &&

      (!p.usageTag ||

        (p.usageTag === "mixed" &&

          (p.femaleCount > 0 || p.maleCount > 0) &&

          !p.batchTypeTag))

  );

  return legacyPen || legacyBarn || overcrowded || sharedBoarPen || missingUsage;

}



export function CheptelTab({

  farmId,

  farmName,

  navigation,

  onInvalidateOverview

}: Props) {

  const { t } = useTranslation();

  const { accessToken, activeProfileId } = useSession();

  const qc = useQueryClient();

  const [barnId, setBarnId] = useState<string | undefined>(undefined);

  const [createOpen, setCreateOpen] = useState(false);



  const pensQuery = useQuery({

    queryKey: ["cheptelPens", farmId, activeProfileId, barnId],

    queryFn: () =>

      fetchCheptelPens(accessToken!, farmId, activeProfileId, barnId),

    enabled: Boolean(accessToken)

  });



  const toggleMut = useMutation({

    mutationFn: ({ penId }: { penId: string }) =>

      patchPenToggleActive(accessToken!, farmId, penId, activeProfileId),

    onSuccess: () => {

      void pensQuery.refetch();

      onInvalidateOverview?.();

    }

  });



  const deleteMut = useMutation({

    mutationFn: (penId: string) =>

      deleteCheptelPen(accessToken!, farmId, penId, activeProfileId),

    onSuccess: () => {

      void pensQuery.refetch();

      onInvalidateOverview?.();

    }

  });



  const pens = pensQuery.data?.pens ?? [];

  const barns = pensQuery.data?.barns ?? [];

  const total = pensQuery.data?.totalPens ?? pens.length;

  const layoutRepairDone = useRef<string | null>(null);

  const layoutRepairKey = `${farmId}:v${LAYOUT_REPAIR_VERSION}`;



  useEffect(() => {

    if (

      !accessToken ||

      !farmId ||

      layoutRepairDone.current === layoutRepairKey ||

      pensQuery.isPending ||

      !pensQuery.isSuccess

    ) {

      return;

    }

    if (!pensNeedLayoutRepair(pens, barns)) {

      return;

    }

    layoutRepairDone.current = layoutRepairKey;

    void applyCheptelDefaultPenLayout(accessToken, farmId, activeProfileId)

      .then(() => {

        void pensQuery.refetch();

        void qc.invalidateQueries({ queryKey: ["farmCheptel", farmId] });

        onInvalidateOverview?.();

      })

      .catch(() => {

        layoutRepairDone.current = null;

      });

  }, [

    accessToken,

    farmId,

    layoutRepairKey,

    activeProfileId,

    pens,

    barns,

    pensQuery.isPending,

    pensQuery.isSuccess,

    pensQuery,

    qc,

    onInvalidateOverview

  ]);



  const columns = useMemo(() => {

    const sortedBarns = [...barns].sort(

      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)

    );

    if (barnId) {

      const barn = sortedBarns.find((b) => b.id === barnId);

      return barn

        ? [

            {

              barn,

              pens: pens

                .filter((p) => p.barnId === barnId)

                .sort(sortPensTopToBottom)

            }

          ]

        : [];

    }

    return sortedBarns.map((barn) => ({

      barn,

      pens: pens.filter((p) => p.barnId === barn.id).sort(sortPensTopToBottom)

    }));

  }, [barns, pens, barnId]);



  const twoColumnLayout = columns.length === 2 && !barnId;



  const openLoge = (pen: CheptelPenRowDto) => {

    navigation.navigate("LogeDetail", {

      farmId,

      farmName,

      penId: pen.id,

      penLabel: penDisplayLabel(pen)

    });

  };



  const columnTitle = (index: number) => {

    if (twoColumnLayout) {

      return index === 0

        ? t("cheptel.pens.columnLeft")

        : t("cheptel.pens.columnRight");

    }

    return barnDisplayLabel(columns[index]?.barn ?? { name: "" });

  };



  if (!accessToken) {

    return null;

  }



  if (pensQuery.isPending) {

    return <ActivityIndicator color={mobileColors.accent} style={{ marginTop: 24 }} />;

  }



  const renderPenList = (colPens: CheptelPenRowDto[], stacked: boolean) => (

    <View style={stacked ? styles.penStack : styles.penGrid}>

      {colPens.map((pen) => (

        <PenCard

          key={pen.id}

          pen={pen}

          displayName={penDisplayLabel(pen)}

          layout={stacked ? "stacked" : "grid"}

          onPress={() => openLoge(pen)}

          onToggleActive={(p, next) => {

            if (p.isActive !== next) {

              toggleMut.mutate({ penId: p.id });

            }

          }}

          onDelete={(p) => deleteMut.mutate(p.id)}

        />

      ))}

    </View>

  );



  return (

    <>

      <ScreenSection>

        <View style={styles.headerRow}>

          <Text style={styles.headerTitle}>

            {t("cheptel.navCheptel")}{" "}

            <Text style={styles.countBadge}>({total})</Text>

          </Text>

          <Pressable

            style={styles.addPill}

            onPress={() => setCreateOpen(true)}

            accessibilityRole="button"

          >

            <Text style={styles.addPillTx}>+ {t("cheptel.pens.newPen")}</Text>

          </Pressable>

        </View>



        <ScrollView

          horizontal

          showsHorizontalScrollIndicator={false}

          contentContainerStyle={styles.barnPills}

        >

          <Pressable

            style={[styles.barnPill, !barnId && styles.barnPillOn]}

            onPress={() => setBarnId(undefined)}

          >

            <Text style={[styles.barnPillTx, !barnId && styles.barnPillTxOn]}>

              {t("cheptel.pens.allBarns")}

            </Text>

          </Pressable>

          {barns.map((b) => (

            <Pressable

              key={b.id}

              style={[styles.barnPill, barnId === b.id && styles.barnPillOn]}

              onPress={() => setBarnId(b.id)}

            >

              <Text

                style={[styles.barnPillTx, barnId === b.id && styles.barnPillTxOn]}

              >

                {barnDisplayLabel(b)}

              </Text>

            </Pressable>

          ))}

        </ScrollView>



        <Text style={styles.topToBottomHint}>{t("cheptel.pens.topToBottom")}</Text>

      </ScreenSection>



      {twoColumnLayout ? (

        <ScreenSection flush>

          <View style={styles.twoColumnsRow}>

            {columns.map((col, colIndex) => (

              <View key={col.barn.id} style={styles.barnColumn}>

                <Text style={styles.columnTitle}>{columnTitle(colIndex)}</Text>

                <Text style={styles.columnSub}>

                  {barnDisplayLabel(col.barn)}

                </Text>

                {renderPenList(col.pens, true)}

              </View>

            ))}

          </View>

        </ScreenSection>

      ) : (

        columns.map((col, colIndex) => (

          <ScreenSection

            key={col.barn.id}

            title={

              columns.length > 1 && !barnId

                ? `${columnTitle(colIndex)} · ${barnDisplayLabel(col.barn)}`

                : barnDisplayLabel(col.barn)

            }

            flush

          >

            <View style={styles.penGridPad}>

              {renderPenList(col.pens, false)}

            </View>

          </ScreenSection>

        ))

      )}



      {pens.length === 0 ? (

        <Text style={styles.empty}>{t("cheptel.pens.empty")}</Text>

      ) : null}



      <CreateLogeModal

        visible={createOpen}

        farmId={farmId}

        accessToken={accessToken}

        activeProfileId={activeProfileId}

        barns={barns}

        onClose={() => setCreateOpen(false)}

        onCreated={() => {

          void pensQuery.refetch();

          void qc.invalidateQueries({ queryKey: ["cheptelPens", farmId] });

          onInvalidateOverview?.();

        }}

      />

    </>

  );

}



const styles = StyleSheet.create({

  headerRow: {

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",

    gap: 8

  },

  headerTitle: {

    ...mobileTypography.cardTitle,

    color: mobileColors.textPrimary,

    flex: 1

  },

  countBadge: { color: mobileColors.textSecondary, fontWeight: "600" },

  addPill: {

    borderWidth: 1,

    borderColor: mobileColors.accent,

    borderRadius: mobileRadius.pill,

    paddingHorizontal: 12,

    paddingVertical: 8

  },

  addPillTx: {

    fontSize: 13,

    fontWeight: "700",

    color: mobileColors.accent

  },

  barnPills: { gap: 8 },

  barnPill: {

    paddingHorizontal: 14,

    paddingVertical: 8,

    borderRadius: mobileRadius.pill,

    borderWidth: 1,

    borderColor: mobileColors.border,

    backgroundColor: mobileColors.background

  },

  barnPillOn: {

    borderColor: mobileColors.accent,

    backgroundColor: mobileColors.accentSoft

  },

  barnPillTx: { ...mobileTypography.meta, color: mobileColors.textSecondary },

  barnPillTxOn: { color: mobileColors.accent, fontWeight: "700" },

  topToBottomHint: {

    ...mobileTypography.meta,

    color: mobileColors.textSecondary,

    fontStyle: "italic"

  },

  twoColumnsRow: {

    flexDirection: "row",

    alignItems: "flex-start",

    gap: mobileSpacing.sm,

    padding: mobileSpacing.md

  },

  barnColumn: {

    flex: 1,

    minWidth: 0

  },

  columnTitle: {

    ...mobileTypography.meta,

    fontWeight: "700",

    color: mobileColors.textPrimary,

    textTransform: "uppercase",

    letterSpacing: 0.6,

    fontSize: 11

  },

  columnSub: {

    fontSize: 12,

    color: mobileColors.textSecondary,

    marginBottom: mobileSpacing.sm

  },

  penStack: {

    gap: mobileSpacing.sm

  },

  penGridPad: {

    padding: mobileSpacing.md

  },

  penGrid: {

    flexDirection: "row",

    flexWrap: "wrap",

    justifyContent: "space-between"

  },

  empty: {

    ...mobileTypography.meta,

    color: mobileColors.textSecondary,

    textAlign: "center",

    marginTop: mobileSpacing.lg

  }

});

