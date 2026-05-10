import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useLayoutEffect } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { HousingModuleGate } from "../components/HousingModuleGate";
import { useSession } from "../context/SessionContext";
import { fetchPenDetail } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "PenDetail">;

export function PenDetailScreen({ route, navigation }: Props) {
  const { farmId, farmName, penId, penLabel } = route.params;
  const { accessToken, activeProfileId, clientFeatures } = useSession();

  const q = useQuery({
    queryKey: ["penDetail", farmId, penId, activeProfileId],
    queryFn: () =>
      fetchPenDetail(accessToken, farmId, penId, activeProfileId),
    enabled: clientFeatures.housing
  });

  const pen = q.data;

  useLayoutEffect(() => {
    const title = pen?.name ?? penLabel ?? "Loge";
    navigation.setOptions({
      title,
      headerRight: clientFeatures.housing
        ? () => (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("CreatePenLog", {
                  farmId,
                  farmName,
                  penId,
                  penLabel: title
                })
              }
              style={styles.headerBtn}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              <Text style={styles.headerBtnText}>+ Journal</Text>
            </TouchableOpacity>
          )
        : undefined
    });
  }, [
    navigation,
    pen?.name,
    penLabel,
    farmId,
    farmName,
    penId,
    clientFeatures.housing
  ]);

  if (!clientFeatures.housing) {
    return (
      <HousingModuleGate>
        <View />
      </HousingModuleGate>
    );
  }

  if (q.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#5d7a1f" />
      </View>
    );
  }

  const err =
    q.error instanceof Error ? q.error.message : q.error ? String(q.error) : null;

  if (err || !pen) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{err ?? "Loge introuvable."}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.farmHint}>{farmName}</Text>
      <Text style={styles.barnLine}>
        Bâtiment : {pen.barn.name}
      </Text>

      <View style={styles.block}>
        <Text style={styles.label}>Statut</Text>
        <Text style={styles.value}>{pen.status}</Text>
      </View>

      {pen.capacity != null ? (
        <View style={styles.block}>
          <Text style={styles.label}>Capacité</Text>
          <Text style={styles.value}>{pen.capacity}</Text>
        </View>
      ) : null}

      {pen.zoneLabel ? (
        <View style={styles.block}>
          <Text style={styles.label}>Zone</Text>
          <Text style={styles.value}>{pen.zoneLabel}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Occupation actuelle</Text>
      {pen.placements.length === 0 ? (
        <Text style={styles.muted}>Aucun placement actif.</Text>
      ) : (
        pen.placements.map((p) => (
          <View key={p.id} style={styles.block}>
            {p.animal ? (
              <>
                <Text style={styles.label}>Animal</Text>
                <Text style={styles.value}>
                  {p.animal.tagCode ?? p.animal.publicId} · {p.animal.status}
                </Text>
              </>
            ) : null}
            {p.batch ? (
              <>
                <Text style={[styles.label, styles.labelSpaced]}>Bande</Text>
                <Text style={styles.value}>
                  {p.batch.name} ({p.batch.headcount} têtes)
                </Text>
              </>
            ) : null}
            <Text style={styles.meta}>
              Depuis le {new Date(p.startedAt).toLocaleString("fr-FR")}
            </Text>
            {p.animal || p.batch ? (
              <TouchableOpacity
                style={styles.moveBtn}
                onPress={() =>
                  navigation.navigate("PenMove", {
                    farmId,
                    farmName,
                    fromPenId: penId,
                    fromPenLabel: pen.name,
                    animalId: p.animal?.id,
                    batchId: p.batch?.id,
                    occupantSummary: p.animal
                      ? (p.animal.tagCode ?? p.animal.publicId)
                      : p.batch?.name
                  })
                }
              >
                <Text style={styles.moveBtnText}>
                  Déplacer vers une autre loge…
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))
      )}

      <Text style={[styles.sectionTitle, styles.sectionSpacer]}>
        Journal (aperçu)
      </Text>
      {pen.logs.length === 0 ? (
        <Text style={styles.muted}>Aucune entrée récente.</Text>
      ) : (
        pen.logs.map((log) => (
          <View key={log.id} style={styles.block}>
            <Text style={styles.logTitle}>{log.title}</Text>
            <Text style={styles.meta}>
              {log.type} · {new Date(log.recordedAt).toLocaleString("fr-FR")}
              {log.recorder.fullName ? ` · ${log.recorder.fullName}` : ""}
            </Text>
            {log.body ? (
              <Text style={styles.logBody}>{log.body}</Text>
            ) : null}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f9f8ea" },
  content: { padding: 16, paddingBottom: 40 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f9f8ea"
  },
  error: { color: "#a34c24", textAlign: "center" },
  farmHint: { fontSize: 13, color: "#6d745b", marginBottom: 4 },
  barnLine: { fontSize: 14, color: "#5d7a1f", marginBottom: 14 },
  block: {
    marginBottom: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e8e4d4"
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6d745b",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  labelSpaced: { marginTop: 10 },
  value: { fontSize: 15, color: "#1f2910", lineHeight: 22 },
  meta: { fontSize: 13, color: "#6d745b", marginTop: 8 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1f2910",
    marginTop: 8,
    marginBottom: 10
  },
  sectionSpacer: { marginTop: 16 },
  muted: { fontSize: 14, color: "#6d745b", marginBottom: 8 },
  logTitle: { fontSize: 15, fontWeight: "700", color: "#1f2910" },
  logBody: { fontSize: 14, color: "#4a5238", marginTop: 8, lineHeight: 20 },
  headerBtn: { marginRight: 4 },
  headerBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  moveBtn: { marginTop: 12, alignSelf: "flex-start" },
  moveBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#5d7a1f"
  }
});
