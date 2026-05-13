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
import { EventCard, CheptelBatchDetailHeader } from "../components/farm";
import { Card } from "../components/ui/Card";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { useSession } from "../context/SessionContext";
import {
  fetchBatchHealthEvents,
  fetchFarmBatch,
  postBatchHealthEvent,
  postBatchWeight,
  type BatchHealthEventRow,
  type PostBatchHealthEventPayload
} from "../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing
} from "../theme/mobileTheme";
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

type BatchTab = "health" | "weight" | "feed" | "events";

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
  const [batchTab, setBatchTab] = useState<BatchTab>("health");

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

  const mergedTimeline = useMemo(() => {
    if (!batch) {
      return [];
    }
    const rows: Array<{
      id: string;
      title: string;
      subtitle: string;
      timeLabel: string;
      ts: number;
    }> = [];
    for (const w of batch.weights) {
      const ts = new Date(w.measuredAt).getTime();
      rows.push({
        id: `w-${w.id}`,
        title: "Pesée",
        subtitle: `${formatKg(w.avgWeightKg)} moyenne`,
        timeLabel: new Date(w.measuredAt).toLocaleString(),
        ts
      });
    }
    const healthRows = healthQuery.data ?? [];
    for (const ev of healthRows) {
      const ts = new Date(ev.recordedAt).getTime();
      rows.push({
        id: `h-${ev.id}`,
        title: ev.title,
        subtitle: SEVERITY_FR[ev.severity] ?? ev.severity,
        timeLabel: new Date(ev.recordedAt).toLocaleString(),
        ts
      });
    }
    return rows.sort((a, b) => b.ts - a.ts);
  }, [batch, healthQuery.data]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={mobileColors.accent} />
      </View>
    );
  }

  if (err || !batch) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{err || "Bande introuvable."}</Text>
      </View>
    );
  }

  const speciesLabel = [batch.species.name, batch.breed?.name]
    .filter(Boolean)
    .join(" · ");

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <CheptelBatchDetailHeader
        batchName={route.params.batchName}
        farmName={route.params.farmName}
        headCount={batch.headcount}
        speciesLabel={speciesLabel}
        statusLabel={batch.status != null ? String(batch.status) : "—"}
      />
      {batch.notes ? (
        <Text style={styles.notes}>{batch.notes}</Text>
      ) : null}

      <View style={styles.segmentWrap}>
        <SegmentedControl
          items={[
            { key: "health", label: "Santé" },
            { key: "weight", label: "Poids" },
            { key: "feed", label: "Alim." },
            { key: "events", label: "Journal" }
          ]}
          activeKey={batchTab}
          onChange={(k) => setBatchTab(k as BatchTab)}
        />
      </View>

      {batchTab === "weight" ? (
        <>
          <Text style={styles.section}>Enregistrer une pesée (poids moyen)</Text>
          <TextInput
            style={styles.input}
            value={avgText}
            onChangeText={setAvgText}
            placeholder="Poids moyen / tête (kg)"
            placeholderTextColor={mobileColors.textSecondary}
            keyboardType="decimal-pad"
          />
          <TextInput
            style={styles.input}
            value={headText}
            onChangeText={setHeadText}
            placeholder="Effectif au moment de la pesée (optionnel)"
            placeholderTextColor={mobileColors.textSecondary}
            keyboardType="number-pad"
          />
          <TextInput
            style={[styles.input, styles.noteInput]}
            value={noteText}
            onChangeText={setNoteText}
            placeholder="Note (optionnel)"
            placeholderTextColor={mobileColors.textSecondary}
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
        </>
      ) : null}

      {batchTab === "health" ? (
        <>
          <Text style={[styles.section, styles.healthSectionTitle]}>
            Santé de la bande
          </Text>
          {healthQuery.isError ? (
            <Text style={styles.healthScopeHint}>
              Impossible de charger l’historique santé. Vérifie le scope{" "}
              <Text style={styles.mono}>healthRead</Text> sur cette ferme.
            </Text>
          ) : healthQuery.isPending ? (
            <ActivityIndicator size="small" color={mobileColors.accent} />
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
                placeholderTextColor={mobileColors.textSecondary}
              />
              <TextInput
                style={[styles.input, styles.noteInput]}
                value={healthBody}
                onChangeText={setHealthBody}
                placeholder="Détail clinique, traitement… (optionnel)"
                placeholderTextColor={mobileColors.textSecondary}
                multiline
              />
              <TextInput
                style={styles.input}
                value={healthDate}
                onChangeText={setHealthDate}
                placeholder="Date de l’événement AAAA-MM-JJ (optionnel)"
                placeholderTextColor={mobileColors.textSecondary}
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
        </>
      ) : null}

      {batchTab === "feed" ? (
        <Card>
          <Text style={styles.feedTitle}>Alimentation</Text>
          <Text style={styles.feedBody}>
            Suivi des rations, consommation et stock aliment : branche ici les indicateurs
            ICP / ration quotidienne et les entrées de mouvement depuis le module nutrition.
          </Text>
        </Card>
      ) : null}

      {batchTab === "events" ? (
        <>
          <Text style={styles.section}>Journal de la bande</Text>
          {mergedTimeline.length === 0 ? (
            <Text style={styles.emptyHist}>Aucun événement enregistré.</Text>
          ) : (
            <View style={styles.timeline}>
              {mergedTimeline.map((ev) => (
                <EventCard
                  key={ev.id}
                  title={ev.title}
                  subtitle={ev.subtitle}
                  timestamp={ev.timeLabel}
                />
              ))}
            </View>
          )}
        </>
      ) : null}
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
    backgroundColor: mobileColors.surface
  },
  content: {
    padding: mobileSpacing.lg,
    paddingBottom: 40
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: mobileColors.surface
  },
  error: {
    color: mobileColors.error,
    textAlign: "center"
  },
  segmentWrap: {
    marginBottom: mobileSpacing.lg
  },
  timeline: {
    gap: mobileSpacing.md
  },
  feedTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    marginBottom: 8
  },
  feedBody: {
    fontSize: 14,
    lineHeight: 20,
    color: mobileColors.textSecondary
  },
  notes: {
    fontSize: 14,
    color: mobileColors.textSecondary,
    fontStyle: "italic",
    marginBottom: 16
  },
  section: {
    fontSize: 14,
    fontWeight: "700",
    color: mobileColors.accent,
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
    color: mobileColors.warning,
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
    color: mobileColors.textSecondary,
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
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.background,
    marginRight: 6,
    marginBottom: 6
  },
  severityChipOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  severityChipText: {
    fontSize: 13,
    color: mobileColors.textSecondary
  },
  severityChipTextOn: {
    fontWeight: "600",
    color: mobileColors.textPrimary
  },
  btnOutline: {
    borderWidth: 1,
    borderColor: mobileColors.accent,
    paddingVertical: 14,
    borderRadius: mobileRadius.md,
    alignItems: "center",
    marginBottom: 8
  },
  btnOutlineText: {
    color: mobileColors.accent,
    fontWeight: "700",
    fontSize: 16
  },
  healthCard: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: mobileColors.border
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
    color: mobileColors.textPrimary
  },
  sevBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft,
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
    color: mobileColors.error,
    backgroundColor: "#ffebee"
  },
  input: {
    backgroundColor: mobileColors.background,
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: mobileColors.textPrimary,
    marginBottom: 10
  },
  noteInput: {
    marginBottom: 14
  },
  btn: {
    backgroundColor: mobileColors.accent,
    paddingVertical: 14,
    borderRadius: mobileRadius.md,
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
    color: mobileColors.textSecondary,
    fontStyle: "italic"
  },
  row: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  rowMain: {
    fontSize: 16,
    fontWeight: "600",
    color: mobileColors.textPrimary
  },
  rowSub: {
    fontSize: 12,
    color: mobileColors.textSecondary,
    marginTop: 4
  },
  rowNote: {
    fontSize: 13,
    color: mobileColors.textSecondary,
    marginTop: 6
  }
});
