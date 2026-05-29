import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SmartChart, type SmartChartPeriod } from "../../charts";
import {
  fetchCheptelGmqSummary,
  fetchCheptelWeightSeries,
  fetchFarmAnimals
} from "../../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import { AddWeightModal } from "./AddWeightModal";
import { GMQCard } from "./GMQCard";

type Props = {
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  readOnly?: boolean;
};

export function CheptelWeightTab({ farmId, accessToken, activeProfileId, readOnly = false }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";
  const [period, setPeriod] = useState<SmartChartPeriod>("6M");
  const [animalId, setAnimalId] = useState<string | undefined>(undefined);
  const [addOpen, setAddOpen] = useState(false);

  const months = period === "3M" ? 3 : period === "6M" ? 6 : 12;

  const animalsQuery = useQuery({
    queryKey: ["farmAnimals", farmId, activeProfileId],
    queryFn: () => fetchFarmAnimals(accessToken, farmId, activeProfileId)
  });

  const seriesQuery = useQuery({
    queryKey: ["cheptelWeightSeries", farmId, activeProfileId, animalId, months],
    queryFn: () =>
      fetchCheptelWeightSeries(accessToken, farmId, activeProfileId, {
        animalId,
        months
      })
  });

  const gmqQuery = useQuery({
    queryKey: ["cheptelGmq", farmId, activeProfileId],
    queryFn: () => fetchCheptelGmqSummary(accessToken, farmId, activeProfileId)
  });

  const chartLines = useMemo(() => {
    const points = seriesQuery.data ?? [];
    const byMonth = new Map<string, number[]>();
    for (const p of points) {
      const d = new Date(p.measuredAt);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const arr = byMonth.get(key) ?? [];
      arr.push(p.weightKg);
      byMonth.set(key, arr);
    }
    const data = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, vals]) => ({
        month,
        value: vals.reduce((a, b) => a + b, 0) / vals.length
      }));
    return [
      {
        key: "weight",
        label: t("cheptel.weight.chartLabel"),
        color: mobileColors.accent,
        data
      }
    ];
  }, [seriesQuery.data, t]);

  const animals = animalsQuery.data ?? [];
  const gmqRows = gmqQuery.data?.animals ?? [];

  return (
    <View>
      {!readOnly ? (
        <View style={styles.toolbar}>
          <Pressable onPress={() => setAddOpen(true)} style={styles.settingsBtn}>
            <Text style={styles.settingsTx}>＋ {t("cheptel.weight.addShort")}</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.animalPills}>
        <Pressable
          style={[styles.pill, !animalId && styles.pillOn]}
          onPress={() => setAnimalId(undefined)}
        >
          <Text style={[styles.pillTx, !animalId && styles.pillTxOn]}>
            {t("cheptel.weight.allAnimals")}
          </Text>
        </Pressable>
        {animals
          .filter((a) => a.status === "active")
          .slice(0, 24)
          .map((a) => (
            <Pressable
              key={a.id}
              style={[styles.pill, animalId === a.id && styles.pillOn]}
              onPress={() => setAnimalId(a.id)}
            >
              <Text style={[styles.pillTx, animalId === a.id && styles.pillTxOn]}>
                {a.tagCode ?? a.publicId.slice(0, 8)}
              </Text>
            </Pressable>
          ))}
      </ScrollView>

      {seriesQuery.isPending ? (
        <ActivityIndicator color={mobileColors.accent} />
      ) : (
        <SmartChart
          lines={chartLines}
          period={period}
          onPeriodChange={setPeriod}
          unit="kg"
          monthLabel={(m) => {
            const [y, mo] = m.split("-").map(Number);
            return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString(locale, {
              month: "short"
            });
          }}
          emptyLabel={t("cheptel.weight.noChart")}
        />
      )}

      <Text style={styles.sectionTitle}>{t("cheptel.weight.gmqSection")}</Text>
      {gmqQuery.isPending ? (
        <ActivityIndicator color={mobileColors.accent} />
      ) : gmqRows.length === 0 ? (
        <Text style={styles.empty}>{t("cheptel.weight.noGmq")}</Text>
      ) : (
        gmqRows.slice(0, 12).map((row) => <GMQCard key={row.animalId} row={row} />)
      )}

      {!readOnly ? (
      <AddWeightModal
        visible={addOpen}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        preselectedAnimalId={animalId ?? null}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          void seriesQuery.refetch();
          void gmqQuery.refetch();
        }}
      />
      ) : null}

      {!readOnly ? (
      <Pressable style={styles.fab} onPress={() => setAddOpen(true)}>
        <Text style={styles.fabTx}>＋</Text>
      </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 8 },
  settingsBtn: { padding: 8 },
  settingsTx: { color: mobileColors.accent, fontWeight: "600" },
  animalPills: { marginBottom: mobileSpacing.md, maxHeight: 44 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  pillOn: { borderColor: mobileColors.accent, backgroundColor: mobileColors.accentSoft },
  pillTx: { ...mobileTypography.meta },
  pillTxOn: { color: mobileColors.accent, fontWeight: "700" },
  sectionTitle: {
    ...mobileTypography.body,
    fontWeight: "700",
    marginTop: mobileSpacing.lg,
    marginBottom: mobileSpacing.sm
  },
  empty: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  fab: {
    position: "absolute",
    right: 0,
    bottom: mobileSpacing.lg,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: mobileColors.accent,
    alignItems: "center",
    justifyContent: "center"
  },
  fabTx: { color: "#fff", fontSize: 28 }
});
