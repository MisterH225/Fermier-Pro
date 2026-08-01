import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";
import { EmptyStateCard } from "../../components/common/EmptyStateCard";
import { CompositionDisclaimer } from "../../components/feed-composition/CompositionDisclaimer";
import { useSession } from "../../context/SessionContext";
import { useScrollBottomPad } from "../../hooks/useScrollBottomPad";
import { listFeedCompositions } from "../../lib/api";
import { isFeedCompositionModuleActive } from "../../lib/feedComposition";
import {
  formatXof,
  stageLabelFr,
  statusLabelFr
} from "../../lib/feedCompositionFormat";
import type { RootStackParamList } from "../../types/navigation";
import {
  mobileColors,
  mobileFontSize,
  mobileRadius,
  mobileSpacing,
  mobileStatusSurfaces
} from "../../theme/mobileTheme";

type Props = NativeStackScreenProps<RootStackParamList, "FeedCompositionsList">;

export function FeedCompositionsListScreen({ navigation, route }: Props) {
  const { farmId, farmName } = route.params;
  const { accessToken, activeProfileId, platformModules } = useSession();
  const on = isFeedCompositionModuleActive(platformModules);
  const scrollPad = useScrollBottomPad();

  const listQ = useQuery({
    queryKey: ["feed-compositions", farmId, activeProfileId],
    queryFn: () =>
      listFeedCompositions(accessToken!, farmId, activeProfileId),
    enabled: Boolean(accessToken && on)
  });

  if (!on) {
    return (
      <View style={styles.root}>
        <Text style={styles.blocked}>Module composition inactif.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="compositions-list">
      <View style={styles.header}>
        <Text style={styles.farm}>{farmName}</Text>
        <CompositionDisclaimer compact />
        <Pressable
          style={styles.newBtn}
          testID="new-composition"
          onPress={() =>
            navigation.navigate("FeedComposition", { farmId, farmName })
          }
        >
          <Text style={styles.newBtnLabel}>Nouveau mélange</Text>
        </Pressable>
      </View>

      {listQ.isPending ? (
        <ActivityIndicator color={mobileColors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={listQ.data ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={listQ.isRefetching}
              onRefresh={() => void listQ.refetch()}
            />
          }
          contentContainerStyle={[styles.list, { paddingBottom: scrollPad }]}
          ListEmptyComponent={
            <EmptyStateCard
              icon="flask-outline"
              title="Aucun mélange enregistré"
              subtitle="Préparez un mélange pour vos porcs, enregistrez-le, puis envoyez-le au véto."
              onConfigure={() =>
                navigation.navigate("FeedComposition", { farmId, farmName })
              }
            />
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              testID={`composition-row-${item.id}`}
              onPress={() =>
                navigation.navigate("FeedCompositionDetail", {
                  farmId,
                  farmName,
                  compositionId: item.id
                })
              }
            >
              <View style={styles.rowTop}>
                <Text style={styles.stage}>{stageLabelFr(item.stage)}</Text>
                <StatusPill status={item.status} />
              </View>
              <Text style={styles.cost}>{formatXof(item.totalCostXof)}</Text>
              <Text style={styles.date}>
                {new Date(item.createdAt).toLocaleDateString("fr-FR")}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function StatusPill({ status }: { status: string }) {
  const bg =
    status === "validated"
      ? mobileStatusSurfaces.successBg
      : status === "vet_review"
        ? mobileStatusSurfaces.infoBg
        : mobileColors.surfaceMuted;
  const color =
    status === "validated"
      ? mobileStatusSurfaces.successText
      : status === "vet_review"
        ? mobileStatusSurfaces.infoText
        : mobileColors.textSecondary;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color }]}>{statusLabelFr(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mobileColors.canvas },
  header: {
    padding: mobileSpacing.lg,
    gap: mobileSpacing.sm
  },
  farm: {
    fontSize: mobileFontSize.lg,
    fontWeight: "800",
    color: mobileColors.textPrimary
  },
  blocked: {
    padding: mobileSpacing.xl,
    color: mobileColors.textSecondary
  },
  newBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    paddingVertical: mobileSpacing.md,
    alignItems: "center"
  },
  newBtnLabel: {
    color: mobileColors.onAccent,
    fontWeight: "800"
  },
  list: {
    paddingHorizontal: mobileSpacing.lg,
    gap: mobileSpacing.sm
  },
  row: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    borderWidth: 1,
    borderColor: mobileColors.border,
    padding: mobileSpacing.lg,
    marginBottom: mobileSpacing.sm,
    gap: 4
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  stage: {
    fontSize: mobileFontSize.md,
    fontWeight: "800",
    color: mobileColors.textPrimary
  },
  cost: {
    fontSize: mobileFontSize.xl,
    fontWeight: "800",
    color: mobileColors.textPrimary
  },
  date: {
    fontSize: mobileFontSize.sm,
    color: mobileColors.textSecondary
  },
  pill: {
    borderRadius: mobileRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  pillText: { fontSize: mobileFontSize.xs, fontWeight: "700" }
});
