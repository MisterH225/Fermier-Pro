import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useSession } from "../context/SessionContext";
import {
  fetchBatchHealthEvents,
  fetchFarmBatch,
  postBatchHealthEvent,
  postBatchWeight,
  type BatchHealthEventRow,
  type PostBatchHealthEventPayload
} from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "BatchDetail">;

function formatKg(v: string | number | undefined): string {
  if (v === undefined || v === null) {
    return "—";
  }
  const n = typeof v === "string" ? Number.parseFloat(v) : Number(v);
  if (!Number.isFinite(n)) {
    return String(v);
  }
  return `${n.toFixed(3)} kg`;
}

const SEVERITY_OPTIONS: {
  value: PostBatchHealthEventPayload["severity"];
  label: string;
}[] = [
  { value: "info", label: "Info" },
  { value: "watch", label: "À surveiller" },
  { value: "urgent", label: "Urgent" }
];

const SEVERITY_FR: Record<string, string> = {
  info: "Info",
  watch: "À surveiller",
  urgent: "Urgent"
};

export function BatchDetailScreen({ route }: Props) {
  const { farmId, batchId } = route.params;
  const { accessToken, activeProfileId } = useSession();
  const queryClient = useQueryClient();

  const [avgText, setAvgText] = useState("");
  const [headText, setHeadText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [healthSeverity, setHealthSeverity] =
    useState<PostBatchHealthEventPayload["severity"]>("info");
  const [healthTitle, setHealthTitle] = useState("");
  const [healthBody, setHealthBody] = useState("");
  const [healthDate, setHealthDate] = useState("");

  const batchQuery = useQuery({
    queryKey: ["farmBatch", farmId, batchId, activeProfileId],
    queryFn: () => fetchFarmBatch(accessToken, farmId, batchId, activeProfileId)
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const avg = Number.parseFloat(avgText.replace(",", "."));
      if (!Number.isFinite(avg) || avg <= 0) {
        throw new Error("Indique un poids moyen valide (kg).");
      }
      let headcountSnapshot: number | undefined;
      const ht = headText.trim();
      if (ht) {
        const h = Number.parseInt(ht, 10);
        if (!Number.isFinite(h) || h < 0) {
          throw new Error("Effectif optionnel : nombre entier positif.");
        }
        headcountSnapshot = h;
      }
      return postBatchWeight(
        accessToken,
        farmId,
        batchId,
        {
          avgWeightKg: avg,
          headcountSnapshot,
          note: noteText.trim() || undefined
        },
        activeProfileId
      );
    },
    onSuccess: () => {
      setAvgText("");
      setHeadText("");
      setNoteText("");
      void queryClient.invalidateQueries({
        queryKey: ["farmBatch", farmId, batchId]
      });
      void queryClient.invalidateQueries({
        queryKey: ["farmBatches", farmId]
      });
    },
    onError: (e: Error) => {
      Alert.alert("Enregistrement impossible", e.message);
    }
  });

  const healthQuery = useQuery({
    queryKey: ["batchHealthEvents", farmId, batchId, activeProfileId],
    queryFn: () =>
      fetchBatchHealthEvents(
        accessToken,
        farmId,
        batchId,
        activeProfileId
      ),
    enabled: Boolean(batchQuery.data)
  });

  const healthMutation = useMutation({
    mutationFn: async () => {
      const t = healthTitle.trim();
      if (!t) {
        throw new Error("Le titre de l’événement est obligatoire.");
      }
      const payload: PostBatchHealthEventPayload = {
        severity: healthSeverity,
        title: t,
        body: healthBody.trim() || undefined,
        recordedAt: healthDate.trim()
          ? `${healthDate.trim()}T12:00:00.000Z`
          : undefined
      };
      return postBatchHealthEvent(
        accessToken,
        farmId,
        batchId,
        payload,
        activeProfileId
      );
    },
    onSuccess: () => {
      setHealthTitle("");
      setHealthBody("");
      setHealthDate("");
      setHealthSeverity("info");
      void queryClient.invalidateQueries({
        queryKey: ["batchHealthEvents", farmId, batchId]
      });
    },
    onError: (e: Error) => {
      Alert.alert("Enregistrement impossible", e.message);
    }
  });

  const batch = batchQuery.data;
  const loading = batchQuery.isPending;
  const err =
    batchQuery.error instanceof Error
      ? batchQuery.error.message
      : batchQuery.error
        ? String(batchQuery.error)
        : null;

  const metaLine = useMemo(() => {
    if (!batch) {
      return "";
    }
    const parts = [
      `${batch.headcount} tête${batch.headcount > 1 ? "s" : ""}`,
      batch.species.name,
      batch.breed?.name,
      batch.status
    ].filter(Boolean);
    return parts.join(" · ");
  }, [batch]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#5d7a1f" />
      </View>
    );
  }

  if (err || !batch) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{err || "Lot introuvable."}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.meta}>{metaLine}</Text>
      {batch.notes ? (
        <Text style={styles.notes}>{batch.notes}</Text>
      ) : null}

      <Text style={styles.section}>Enregistrer une pesée (poids moyen)</Text>
      <TextInput
        style={styles.input}
        value={avgText}
        onChangeText={setAvgText}
        placeholder="Poids moyen / tête (kg)"
        placeholderTextColor="#999"
        keyboardType="decimal-pad"
      />
      <TextInput
        style={styles.input}
        value={headText}
        onChangeText={setHeadText}
        placeholder="Effectif au moment de la pesée (optionnel)"
        placeholderTextColor="#999"
        keyboardType="number-pad"
      />
      <TextInput
        style={[styles.input, styles.noteInput]}
        value={noteText}
        onChangeText={setNoteText}
        placeholder="Note (optionnel)"
        placeholderTextColor="#999"
      />
      <TouchableOpacity
        style={[styles.btn, mutation.isPending && styles.btnDisabled]}
        onPress={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        <Text style={styles.btnText}>
          {mutation.isPending ? "Envoi…" : "Ajouter la pesée"}
        </Text>
      </TouchableOpacity>

      <Text style={[styles.section, styles.historyTitle]}>Historique</Text>
      {batch.weights.length === 0 ? (
        <Text style={styles.emptyHist}>Aucune pesée enregistrée.</Text>
      ) : (
        batch.weights.map((row) => (
          <View key={row.id} style={styles.row}>
            <Text style={styles.rowMain}>{formatKg(row.avgWeightKg)}</Text>
            <Text style={styles.rowSub}>
              {new Date(row.measuredAt).toLocaleString()}
              {row.headcountSnapshot != null
                ? ` · ${row.headcountSnapshot} têtes`
                : ""}
            </Text>
            {row.note ? (
              <Text style={styles.rowNote}>{row.note}</Text>
            ) : null}
          </View>
        ))
      )}

      <Text style={[styles.section, styles.healthSectionTitle]}>
        Santé du lot
      </Text>
      {healthQuery.isError ? (
        <Text style={styles.healthScopeHint}>
          Impossible de charger l’historique santé. Vérifie le scope{" "}
          <Text style={styles.mono}>healthRead</Text> sur cette ferme.
        </Text>
      ) : healthQuery.isPending ? (
        <ActivityIndicator size="small" color="#5d7a1f" />
      ) : (
        <>
          <Text style={styles.subSection}>Nouvel événement</Text>
          <View style={styles.severityRow}>
            {SEVERITY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.severityChip,
                  healthSeverity === opt.value && styles.severityChipOn
                ]}
                onPress={() => setHealthSeverity(opt.value)}
              >
                <Text
                  style={[
                    styles.severityChipText,
                    healthSeverity === opt.value && styles.severityChipTextOn
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={healthTitle}
            onChangeText={setHealthTitle}
            placeholder="Titre (obligatoire)"
            placeholderTextColor="#999"
          />
          <TextInput
            style={[styles.input, styles.noteInput]}
            value={healthBody}
            onChangeText={setHealthBody}
            placeholder="Détail clinique, traitement… (optionnel)"
            placeholderTextColor="#999"
            multiline
          />
          <TextInput
            style={styles.input}
            value={healthDate}
            onChangeText={setHealthDate}
            placeholder="Date de l’événement AAAA-MM-JJ (optionnel)"
            placeholderTextColor="#999"
            keyboardType="numbers-and-punctuation"
          />
          <TouchableOpacity
            style={[
              styles.btnOutline,
              healthMutation.isPending && styles.btnDisabled
            ]}
            onPress={() => healthMutation.mutate()}
            disabled={healthMutation.isPending}
          >
            <Text style={styles.btnOutlineText}>
              {healthMutation.isPending ? "Envoi…" : "Enregistrer l’événement"}
            </Text>
          </TouchableOpacity>

          <Text style={styles.subSection}>Historique santé</Text>
          {!healthQuery.data?.length ? (
            <Text style={styles.emptyHist}>Aucun événement santé.</Text>
          ) : (
            healthQuery.data.map((ev) => (
              <HealthEventCard key={ev.id} ev={ev} />
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

function HealthEventCard({ ev }: { ev: BatchHealthEventRow }) {
  return (
    <View style={styles.healthCard}>
      <View style={styles.healthCardTop}>
        <Text style={styles.healthTitle} numberOfLines={3}>
          {ev.title}
        </Text>
        <Text
          style={[
            styles.sevBadge,
            ev.severity === "urgent" && styles.sevUrgent,
            ev.severity === "watch" && styles.sevWatch
          ]}
        >
          {SEVERITY_FR[ev.severity] ?? ev.severity}
        </Text>
      </View>
      <Text style={styles.rowSub}>
        {new Date(ev.recordedAt).toLocaleString()}
        {ev.recorder?.fullName ? ` · ${ev.recorder.fullName}` : ""}
      </Text>
      {ev.body ? (
        <Text style={styles.rowNote}>{ev.body}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: "#f9f8ea"
  },
  content: {
    padding: 16,
    paddingBottom: 40
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f9f8ea"
  },
  error: {
    color: "#b00020",
    textAlign: "center"
  },
  meta: {
    fontSize: 15,
    color: "#4b513d",
    marginBottom: 8
  },
  notes: {
    fontSize: 14,
    color: "#6d745b",
    fontStyle: "italic",
    marginBottom: 16
  },
  section: {
    fontSize: 14,
    fontWeight: "700",
    color: "#5d7a1f",
    marginBottom: 10,
    marginTop: 8
  },
  historyTitle: {
    marginTop: 24
  },
  healthSectionTitle: {
    marginTop: 28
  },
  healthScopeHint: {
    fontSize: 13,
    color: "#8b4513",
    lineHeight: 20,
    marginBottom: 8
  },
  mono: {
    fontFamily: "monospace",
    fontSize: 12
  },
  subSection: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4b513d",
    marginBottom: 8,
    marginTop: 4
  },
  severityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 10
  },
  severityChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e4d4",
    backgroundColor: "#fff",
    marginRight: 6,
    marginBottom: 6
  },
  severityChipOn: {
    borderColor: "#5d7a1f",
    backgroundColor: "#e8efd9"
  },
  severityChipText: {
    fontSize: 13,
    color: "#4b513d"
  },
  severityChipTextOn: {
    fontWeight: "600",
    color: "#1f2910"
  },
  btnOutline: {
    borderWidth: 2,
    borderColor: "#5d7a1f",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 8
  },
  btnOutlineText: {
    color: "#5d7a1f",
    fontWeight: "700",
    fontSize: 16
  },
  healthCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e0e4d4"
  },
  healthCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8
  },
  healthTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#1f2910"
  },
  sevBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: "#5d7a1f",
    backgroundColor: "#e8efd9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden"
  },
  sevWatch: {
    color: "#8b4513",
    backgroundColor: "#fff3e0"
  },
  sevUrgent: {
    color: "#b00020",
    backgroundColor: "#ffebee"
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e4d4",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1f2910",
    marginBottom: 10
  },
  noteInput: {
    marginBottom: 14
  },
  btn: {
    backgroundColor: "#5d7a1f",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center"
  },
  btnDisabled: {
    opacity: 0.7
  },
  btnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16
  },
  emptyHist: {
    color: "#6d745b",
    fontStyle: "italic"
  },
  row: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e0e4d4"
  },
  rowMain: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2910"
  },
  rowSub: {
    fontSize: 12,
    color: "#6d745b",
    marginTop: 4
  },
  rowNote: {
    fontSize: 13,
    color: "#4b513d",
    marginTop: 6
  }
});
