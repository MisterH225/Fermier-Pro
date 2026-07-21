import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { VetCard } from "../components/sante/VetCard";
import { VetProfileModal } from "../components/sante/VetProfileModal";
import { MobileAppShell } from "../components/layout";
import { useSession } from "../context/SessionContext";
import { useScreenTitle } from "../hooks/useScreenTitle";
import { searchVets } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../theme/mobileTheme";
import { useBottomInset } from "../hooks/useBottomInset";

type Props = NativeStackScreenProps<RootStackParamList, "VetSearch">;

type FilterId = "all" | "porcin" | "available" | "rated" | "near";

export function VetSearchScreen({ route, navigation }: Props) {
  const { farmId, farmName, bookingSource = "vet_search" } = route.params;
  const { t } = useTranslation();
  const bottomInset = useBottomInset();
  const { accessToken, activeProfileId, authMe } = useSession();
  useScreenTitle(navigation, t("health.vetSearch.title"));

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [selectedVetId, setSelectedVetId] = useState<string | null>(null);

  const lat = authMe?.user.homeLatitude ?? undefined;
  const lng = authMe?.user.homeLongitude ?? undefined;

  const queryParams = useMemo(() => {
    const p: Parameters<typeof searchVets>[1] = { q: search.trim() || undefined };
    if (filter === "porcin") {
      p.specialty = "porcin";
    }
    if (filter === "available") {
      p.available = true;
    }
    if (filter === "rated") {
      p.rating = "4";
    }
    if (filter === "near" && lat != null && lng != null) {
      p.lat = lat;
      p.lng = lng;
    }
    return p;
  }, [search, filter, lat, lng]);

  const listQ = useQuery({
    queryKey: ["vetSearch", queryParams, activeProfileId],
    queryFn: () => searchVets(accessToken!, queryParams, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const filters: { id: FilterId; label: string }[] = [
    { id: "all", label: t("health.vetSearch.filterAll") },
    { id: "porcin", label: t("health.vetSearch.filterPorcin") },
    { id: "available", label: t("health.vetSearch.filterAvailable") },
    { id: "rated", label: t("health.vetSearch.filterRated") },
    { id: "near", label: t("health.vetSearch.filterNear") }
  ];

  return (
    <MobileAppShell hideTopBar omitBottomTabBar>
      <View style={styles.wrap}>
        <TextInput
          style={styles.search}
          placeholder={t("health.vetSearch.searchPlaceholder")}
          value={search}
          onChangeText={setSearch}
        />
        <View style={styles.pills}>
          {filters.map((f) => (
            <Pressable
              key={f.id}
              style={[styles.pill, filter === f.id && styles.pillOn]}
              onPress={() => setFilter(f.id)}
            >
              <Text
                style={[styles.pillTx, filter === f.id && styles.pillTxOn]}
              >
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {listQ.isPending ? (
          <ActivityIndicator color={mobileColors.accent} style={{ marginTop: 24 }} />
        ) : listQ.error ? (
          <Text style={styles.err}>{(listQ.error as Error).message}</Text>
        ) : (
          <FlatList
            data={listQ.data?.items ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.list, { paddingBottom: bottomInset }]}
            ListEmptyComponent={
              <Text style={styles.empty}>{t("health.vetSearch.empty")}</Text>
            }
            renderItem={({ item }) => (
              <VetCard vet={item} onPress={() => setSelectedVetId(item.id)} />
            )}
          />
        )}
      </View>

      <VetProfileModal
        visible={Boolean(selectedVetId)}
        vetId={selectedVetId}
        farmId={farmId}
        farmName={farmName}
        accessToken={accessToken!}
        activeProfileId={activeProfileId}
        onClose={() => setSelectedVetId(null)}
        onPlanVisit={() => {
          const id = selectedVetId;
          setSelectedVetId(null);
          if (id) {
            navigation.navigate("ProducerScheduleVetVisit", {
              farmId,
              farmName,
              vetProfileId: id,
              bookingSource
            });
          }
        }}
        onOpenChat={(roomId, headline, peerUserId) => {
          setSelectedVetId(null);
          navigation.navigate("ChatRoom", { roomId, headline, peerUserId });
        }}
      />
    </MobileAppShell>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: mobileSpacing.md },
  search: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.sm,
    marginBottom: mobileSpacing.sm,
    color: mobileColors.textPrimary
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.xs,
    marginBottom: mobileSpacing.md
  },
  pill: {
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 6,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  pillOn: {
    borderColor: mobileColors.accent,
    backgroundColor: `${mobileColors.accent}14`
  },
  pillTx: { fontSize: mobileFontSize.sm, color: mobileColors.textSecondary },
  pillTxOn: { color: mobileColors.accent, fontWeight: "700" },
  list: {},
  empty: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textAlign: "center",
    marginTop: 32
  },
  err: { color: mobileColors.error }
});
