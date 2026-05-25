import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { FarmCard, type FarmCardBadge } from "../../components/vet/FarmCard";
import { MobileAppShell } from "../../components/layout";
import { useVetBottomChromePad } from "../../context/VetBottomChromeContext";
import { useSession } from "../../context/SessionContext";
import { fetchVetDashboard } from "../../lib/api";
import { openPhoneCall } from "../../lib/phone";
import { vetColors } from "../../theme/vetTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

const FILTERS = ["all", "alerts", "visit", "recent"] as const;

export function VetFarmsScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomPad = useVetBottomChromePad();
  const { accessToken, activeProfileId } = useSession();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");

  const dashQ = useQuery({
    queryKey: ["vetDashboard", activeProfileId, "farmsBadges"],
    queryFn: () => fetchVetDashboard(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const visitFarmIds = useMemo(
    () => new Set((dashQ.data?.upcomingVisits ?? []).map((v) => v.farmId)),
    [dashQ.data?.upcomingVisits]
  );

  const items = useMemo(() => {
    let list = dashQ.data?.assignedFarms ?? [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          (f.producerName?.toLowerCase().includes(q) ?? false)
      );
    }
    if (filter === "visit") {
      list = list.filter((f) => visitFarmIds.has(f.id));
    }
    return list;
  }, [dashQ.data?.assignedFarms, search, filter, visitFarmIds]);

  function badgeFor(farmId: string): FarmCardBadge {
    if (visitFarmIds.has(farmId)) return "visit";
    return "ok";
  }

  return (
    <MobileAppShell hideTopBar>
      <View style={[styles.wrap, { paddingBottom: bottomPad }]}>
        <TextInput
          style={styles.search}
          placeholder={t("vet.farms.search")}
          placeholderTextColor={vetColors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        <View style={styles.pills}>
          {FILTERS.map((f) => (
            <Pressable
              key={f}
              style={[styles.pill, filter === f && styles.pillOn]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.pillTx, filter === f && styles.pillTxOn]}>
                {t(`vet.farms.filter.${f}`)}
              </Text>
            </Pressable>
          ))}
        </View>
        <FlatList
          data={items}
          keyExtractor={(f) => f.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: mobileSpacing.sm }} />}
          renderItem={({ item }) => (
            <FarmCard
              farmName={item.name}
              producerName={item.producerName}
              location={item.address}
              badge={badgeFor(item.id)}
              onPress={() =>
                navigation.navigate("VetFarmDetail", {
                  farmId: item.id,
                  farmName: item.name
                })
              }
              onMessage={() => navigation.navigate("VetMessages")}
              onCall={() =>
                void openPhoneCall(item.producerPhone, {
                  errorTitle: t("vet.call.errorTitle"),
                  errorMessage: t("vet.call.error")
                })
              }
            />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>{t("vet.farms.empty")}</Text>
          }
        />
      </View>
    </MobileAppShell>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: mobileSpacing.lg },
  search: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 10,
    marginBottom: mobileSpacing.md,
    color: vetColors.textPrimary
  },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: mobileSpacing.md },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: vetColors.cardBg,
    borderWidth: 1,
    borderColor: vetColors.border
  },
  pillOn: { backgroundColor: vetColors.primary, borderColor: vetColors.primary },
  pillTx: { fontSize: 13, color: vetColors.textSecondary, fontWeight: "600" },
  pillTxOn: { color: "#fff" },
  list: { paddingBottom: 24 },
  empty: {
    ...mobileTypography.body,
    color: vetColors.textSecondary,
    textAlign: "center",
    marginTop: 40
  }
});
