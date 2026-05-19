import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import type { CheptelPenRowDto } from "../../../lib/api";
import { fetchCheptelPens, fetchPenDetail } from "../../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import { PenBloc } from "./PenBloc";
import { PenDetailModal } from "./PenDetailModal";
import { CreatePenModal } from "./CreatePenModal";

type Props = {
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  onInvalidateOverview?: () => void;
};

export function PenGrid({
  farmId,
  accessToken,
  activeProfileId,
  onInvalidateOverview
}: Props) {
  const { t } = useTranslation();
  const [barnId, setBarnId] = useState<string | undefined>(undefined);
  const [selectedPenId, setSelectedPenId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const pensQuery = useQuery({
    queryKey: ["cheptelPens", farmId, activeProfileId, barnId],
    queryFn: () => fetchCheptelPens(accessToken, farmId, activeProfileId, barnId)
  });

  const penDetailQuery = useQuery({
    queryKey: ["penDetail", farmId, selectedPenId, activeProfileId],
    queryFn: () =>
      fetchPenDetail(accessToken, farmId, selectedPenId!, activeProfileId),
    enabled: Boolean(selectedPenId)
  });

  const pens = pensQuery.data?.pens ?? [];
  const barns = pensQuery.data?.barns ?? [];

  const selectedPen = useMemo(
    () => pens.find((p) => p.id === selectedPenId) ?? null,
    [pens, selectedPenId]
  );

  if (pensQuery.isPending) {
    return <ActivityIndicator color={mobileColors.accent} style={{ marginTop: 24 }} />;
  }

  return (
    <View>
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
              {b.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.grid}>
        {pens.map((pen: CheptelPenRowDto) => (
          <PenBloc
            key={pen.id}
            pen={pen}
            onPress={() => setSelectedPenId(pen.id)}
          />
        ))}
      </View>

      {pens.length === 0 ? (
        <Text style={styles.empty}>{t("cheptel.pens.empty")}</Text>
      ) : null}

      <Pressable style={styles.fab} onPress={() => setCreateOpen(true)}>
        <Text style={styles.fabTx}>＋</Text>
      </Pressable>

      <PenDetailModal
        visible={Boolean(selectedPenId && selectedPen)}
        pen={selectedPen}
        detail={penDetailQuery.data}
        isLoading={penDetailQuery.isPending}
        onClose={() => setSelectedPenId(null)}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
      />

      <CreatePenModal
        visible={createOpen}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        barns={barns}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          void pensQuery.refetch();
          onInvalidateOverview?.();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  barnPills: { gap: 8, paddingBottom: mobileSpacing.md },
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between"
  },
  empty: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textAlign: "center",
    marginTop: mobileSpacing.lg
  },
  fab: {
    position: "absolute",
    right: 0,
    bottom: mobileSpacing.lg,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: mobileColors.accent,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4
  },
  fabTx: { color: "#fff", fontSize: 28, fontWeight: "300" }
});
