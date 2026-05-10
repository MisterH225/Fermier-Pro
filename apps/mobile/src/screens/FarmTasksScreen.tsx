import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { ModuleFeatureGate } from "../components/ModuleFeatureGate";
import { useSession } from "../context/SessionContext";
import type { FarmTaskDto, PatchFarmTaskPayload } from "../lib/api";
import { fetchFarmTasks, patchFarmTask } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "FarmTasks">;

type FilterKey = "all" | "todo" | "in_progress" | "done";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "todo", label: "À faire" },
  { key: "in_progress", label: "En cours" },
  { key: "done", label: "Terminées" }
];

const STATUS_FR: Record<string, string> = {
  todo: "À faire",
  in_progress: "En cours",
  done: "Terminée",
  cancelled: "Annulée"
};

const PRIORITY_FR: Record<string, string> = {
  low: "Basse",
  normal: "Normale",
  high: "Haute"
};

export function FarmTasksScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>("all");

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: clientFeatures.tasks
        ? () => (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("CreateTask", { farmId, farmName })
              }
              style={styles.headerBtn}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              <Text style={styles.headerBtnText}>+ Tâche</Text>
            </TouchableOpacity>
          )
        : undefined
    });
  }, [navigation, farmId, farmName, clientFeatures.tasks]);

  const tasksQuery = useQuery({
    queryKey: ["farmTasks", farmId, activeProfileId, filter],
    queryFn: () =>
      fetchFarmTasks(
        accessToken,
        farmId,
        activeProfileId,
        filter === "all" ? undefined : filter
      ),
    enabled: clientFeatures.tasks
  });

  const updateMutation = useMutation({
    mutationFn: ({
      taskId,
      payload
    }: {
      taskId: string;
      payload: PatchFarmTaskPayload;
    }) =>
      patchFarmTask(
        accessToken,
        farmId,
        taskId,
        payload,
        activeProfileId
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["farmTasks", farmId] });
    },
    onError: (e: Error) => {
      Alert.alert("Mise à jour impossible", e.message);
    }
  });

  const markDone = (t: FarmTaskDto) => {
    updateMutation.mutate({
      taskId: t.id,
      payload: { status: "done" }
    });
  };

  const reopen = (t: FarmTaskDto) => {
    updateMutation.mutate({
      taskId: t.id,
      payload: { status: "todo", completedAt: null }
    });
  };

  const loading = tasksQuery.isPending;
  const err =
    tasksQuery.error instanceof Error
      ? tasksQuery.error.message
      : tasksQuery.error
        ? String(tasksQuery.error)
        : null;

  if (!clientFeatures.tasks) {
    return (
      <ModuleFeatureGate feature="tasks">
        <View />
      </ModuleFeatureGate>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#5d7a1f" />
      </View>
    );
  }

  if (err) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{err}</Text>
        <Text style={styles.hint}>
          Scopes requis : tasksRead / tasksWrite sur la ferme.
        </Text>
      </View>
    );
  }

  const list = tasksQuery.data ?? [];

  return (
    <View style={styles.flex}>
      <Text style={styles.farmHint}>{farmName}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterChip,
              filter === f.key && styles.filterChipOn
            ]}
            onPress={() => setFilter(f.key)}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === f.key && styles.filterChipTextOn
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={tasksQuery.isFetching}
            onRefresh={() => void tasksQuery.refetch()}
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>Aucune tâche pour ce filtre.</Text>
        }
        renderItem={({ item: t }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{t.title}</Text>
              <Text style={styles.badge}>
                {STATUS_FR[t.status] ?? t.status}
              </Text>
            </View>
            <Text style={styles.cardMeta}>
              Priorité : {PRIORITY_FR[t.priority] ?? t.priority}
              {t.category ? ` · ${t.category}` : ""}
            </Text>
            {t.dueAt ? (
              <Text style={styles.due}>
                Échéance :{" "}
                {new Date(t.dueAt).toLocaleString(undefined, {
                  dateStyle: "short",
                  timeStyle: "short"
                })}
              </Text>
            ) : null}
            {t.assignee?.fullName ? (
              <Text style={styles.assign}>
                Assignée à : {t.assignee.fullName}
              </Text>
            ) : null}
            {t.description ? (
              <Text style={styles.desc} numberOfLines={4}>
                {t.description}
              </Text>
            ) : null}
            <View style={styles.actions}>
              {t.status !== "done" && t.status !== "cancelled" ? (
                <TouchableOpacity
                  style={styles.actionPrimary}
                  onPress={() => markDone(t)}
                  disabled={updateMutation.isPending}
                >
                  <Text style={styles.actionPrimaryText}>Terminer</Text>
                </TouchableOpacity>
              ) : null}
              {t.status === "done" ? (
                <TouchableOpacity
                  style={styles.actionSecondary}
                  onPress={() => reopen(t)}
                  disabled={updateMutation.isPending}
                >
                  <Text style={styles.actionSecondaryText}>Rouvrir</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: "#f9f8ea"
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f9f8ea"
  },
  farmHint: {
    paddingHorizontal: 16,
    paddingTop: 12,
    fontSize: 14,
    color: "#6d745b"
  },
  filterScroll: {
    maxHeight: 48,
    marginBottom: 8
  },
  filterRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center"
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e0e4d4",
    backgroundColor: "#fff",
    marginRight: 8
  },
  filterChipOn: {
    borderColor: "#5d7a1f",
    backgroundColor: "#e8efd9"
  },
  filterChipText: {
    fontSize: 13,
    color: "#4b513d"
  },
  filterChipTextOn: {
    color: "#1f2910",
    fontWeight: "600"
  },
  list: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 32
  },
  empty: {
    textAlign: "center",
    color: "#6d745b",
    marginTop: 24,
    fontStyle: "italic"
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e4d4"
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2910"
  },
  badge: {
    fontSize: 11,
    fontWeight: "600",
    color: "#5d7a1f",
    backgroundColor: "#e8efd9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden"
  },
  cardMeta: {
    marginTop: 6,
    fontSize: 13,
    color: "#6d745b"
  },
  due: {
    marginTop: 4,
    fontSize: 13,
    color: "#8b4513"
  },
  assign: {
    marginTop: 4,
    fontSize: 13,
    color: "#4b513d"
  },
  desc: {
    marginTop: 10,
    fontSize: 14,
    color: "#4b513d",
    lineHeight: 20
  },
  actions: {
    flexDirection: "row",
    marginTop: 12,
    flexWrap: "wrap"
  },
  actionPrimary: {
    backgroundColor: "#5d7a1f",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginRight: 10
  },
  actionPrimaryText: {
    color: "#fff",
    fontWeight: "600"
  },
  actionSecondary: {
    borderWidth: 1,
    borderColor: "#5d7a1f",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10
  },
  actionSecondaryText: {
    color: "#5d7a1f",
    fontWeight: "600"
  },
  error: {
    color: "#b00020",
    textAlign: "center"
  },
  hint: {
    marginTop: 10,
    fontSize: 13,
    color: "#6d745b",
    textAlign: "center"
  },
  headerBtn: {
    paddingHorizontal: 6
  },
  headerBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15
  }
});
