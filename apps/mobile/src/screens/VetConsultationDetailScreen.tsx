import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { mobileRadius, mobileFontSize } from "../theme/mobileTheme";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useTranslation } from "react-i18next";
import { VetModuleGate } from "../components/VetModuleGate";
import { useSession } from "../context/SessionContext";
import type { PatchVetConsultationPayload } from "../lib/api";
import { fetchVetConsultation, patchVetConsultation } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";
import { getQueryErrorMessage, getUserFacingError } from "../lib/userFacingError";
import { useBottomInset } from "../hooks/useBottomInset";
import { vetColors, vetStackScreenOptions } from "../theme/vetTheme";

type Props = NativeStackScreenProps<
  RootStackParamList,
  "VetConsultationDetail"
>;

const STATUS_FR: Record<string, string> = {
  open: "Ouverte",
  in_progress: "En cours",
  resolved: "Résolue",
  cancelled: "Annulée"
};

export function VetConsultationDetailScreen({ route, navigation }: Props) {
  const bottomInset = useBottomInset();
  const { t } = useTranslation();
  const { farmId, farmName, consultationId } = route.params;
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const qc = useQueryClient();

  const patchMutation = useMutation({
    mutationFn: (payload: PatchVetConsultationPayload) =>
      patchVetConsultation(
        accessToken,
        farmId,
        consultationId,
        payload,
        activeProfileId
      ),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["vetConsultation", farmId, consultationId]
      });
      void qc.invalidateQueries({ queryKey: ["vetConsultations", farmId] });
      void qc.invalidateQueries({ queryKey: ["vet-pending-compositions"] });
      void qc.invalidateQueries({ queryKey: ["feed-composition"] });
      void qc.invalidateQueries({ queryKey: ["feed-compositions"] });
    },
    onError: (e: Error) => {
      Alert.alert("Mise à jour impossible", getUserFacingError(e, t));
    }
  });

  const q = useQuery({
    queryKey: ["vetConsultation", farmId, consultationId, activeProfileId],
    queryFn: () =>
      fetchVetConsultation(
        accessToken,
        farmId,
        consultationId,
        activeProfileId
      ),
    enabled: clientFeatures.vetConsultations
  });

  const row = q.data;

  const [editSubject, setEditSubject] = useState("");
  const [editSummary, setEditSummary] = useState("");

  useEffect(() => {
    if (row) {
      setEditSubject(row.subject);
      setEditSummary(row.summary ?? "");
    }
  }, [row?.id, row?.subject, row?.summary]);

  useLayoutEffect(() => {
    navigation.setOptions({
      ...vetStackScreenOptions,
      title: "Consultation",
      headerRight: clientFeatures.vetConsultations
        ? () => (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("AddVetConsultationAttachment", {
                  farmId,
                  farmName,
                  consultationId
                })
              }
              style={styles.headerBtn}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              <Text style={styles.headerBtnText}>+ Fichier</Text>
            </TouchableOpacity>
          )
        : undefined
    });
  }, [
    navigation,
    farmId,
    farmName,
    consultationId,
    clientFeatures.vetConsultations
  ]);

  if (!clientFeatures.vetConsultations) {
    return (
      <VetModuleGate>
        <View />
      </VetModuleGate>
    );
  }

  if (q.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={vetColors.primary} />
      </View>
    );
  }

  const err = getQueryErrorMessage(q.error, t);

  if (err || !row) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{err ?? "Consultation introuvable."}</Text>
      </View>
    );
  }

  const metaDirty =
    editSubject.trim() !== row.subject.trim() ||
    editSummary.trim() !== (row.summary ?? "").trim();

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 24}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.editCard}>
          <Text style={styles.editTitle}>Objet et résumé</Text>
          <Text style={styles.editLabel}>Objet</Text>
          <TextInput
            style={styles.editInput}
            value={editSubject}
            onChangeText={setEditSubject}
            placeholder="Objet du dossier"
            placeholderTextColor={vetColors.textMuted}
          />
          <Text style={styles.editLabel}>Résumé</Text>
          <TextInput
            style={[styles.editInput, styles.editMultiline]}
            value={editSummary}
            onChangeText={setEditSummary}
            placeholder="Symptômes, contexte…"
            placeholderTextColor={vetColors.textMuted}
            multiline
          />
          <TouchableOpacity
            style={[
              styles.saveBtn,
              (!metaDirty ||
                !editSubject.trim() ||
                patchMutation.isPending) &&
                styles.actionBtnDisabled
            ]}
            disabled={
              !metaDirty || !editSubject.trim() || patchMutation.isPending
            }
            onPress={() =>
              patchMutation.mutate({
                subject: editSubject.trim(),
                summary: editSummary.trim()
              })
            }
          >
            <Text style={styles.saveBtnText}>Enregistrer objet et résumé</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Statut</Text>
          <Text style={styles.value}>
            {STATUS_FR[row.status] ?? row.status}
          </Text>
        </View>

        {row.status === "open" || row.status === "in_progress" ? (
          <View style={styles.actionBox}>
            <Text style={styles.actionTitle}>Actions</Text>
            {row.status === "open" ? (
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  patchMutation.isPending && styles.actionBtnDisabled
                ]}
                disabled={patchMutation.isPending}
                onPress={() =>
                  patchMutation.mutate({ status: "in_progress" })
                }
              >
                <Text style={styles.actionBtnText}>Passer en cours</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[
                styles.actionBtn,
                patchMutation.isPending && styles.actionBtnDisabled
              ]}
              disabled={patchMutation.isPending}
              onPress={() => patchMutation.mutate({ status: "resolved" })}
            >
              <Text style={styles.actionBtnText}>Clôturer (résolu)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionBtnDanger,
                patchMutation.isPending && styles.actionBtnDisabled
              ]}
              disabled={patchMutation.isPending}
              onPress={() =>
                Alert.alert(
                  "Annuler le dossier",
                  "Confirmer l’annulation de cette consultation ?",
                  [
                    { text: "Retour", style: "cancel" },
                    {
                      text: "Annuler",
                      style: "destructive",
                      onPress: () =>
                        patchMutation.mutate({ status: "cancelled" })
                    }
                  ]
                )
              }
            >
              <Text style={styles.actionBtnDangerText}>Annuler le dossier</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.block}>
          <Text style={styles.label}>Ouvert le</Text>
          <Text style={styles.value}>
            {new Date(row.openedAt).toLocaleString("fr-FR")}
          </Text>
        </View>

        {row.closedAt ? (
          <View style={styles.block}>
            <Text style={styles.label}>Clôturé le</Text>
            <Text style={styles.value}>
              {new Date(row.closedAt).toLocaleString("fr-FR")}
            </Text>
          </View>
        ) : null}

        {row.animal ? (
          <View style={styles.block}>
            <Text style={styles.label}>Animal lié</Text>
            <Text style={styles.value}>
              {row.animal.tagCode ?? row.animal.publicId} ({row.animal.status})
            </Text>
          </View>
        ) : null}

        <View style={styles.block}>
          <Text style={styles.label}>Ouvert par</Text>
          <Text style={styles.value}>
            {row.openedBy.fullName ?? "—"}
          </Text>
        </View>

        {row.primaryVet ? (
          <View style={styles.block}>
            <Text style={styles.label}>Vétérinaire référent</Text>
            <Text style={styles.value}>
              {row.primaryVet.fullName ?? "—"}
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Pièces jointes</Text>
        {row.attachments.length === 0 ? (
          <Text style={styles.muted}>Aucune pièce jointe.</Text>
        ) : (
          row.attachments.map((a) => (
            <TouchableOpacity
              key={a.id}
              style={styles.attachRow}
              onPress={() => void Linking.openURL(a.url)}
            >
              <Text style={styles.attachLabel}>
                {a.label?.trim() || "Document"}
              </Text>
              <Text style={styles.attachUrl} numberOfLines={1}>
                {a.url}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: vetColors.canvas },
  scroll: { flex: 1, backgroundColor: vetColors.canvas },
  content: { padding: 16 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: vetColors.canvas
  },
  error: { color: vetColors.danger, textAlign: "center" },
  block: {
    marginBottom: 14,
    backgroundColor: vetColors.cardBg,
    borderRadius: mobileRadius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: vetColors.border
  },
  label: {
    fontSize: mobileFontSize.sm,
    fontWeight: "700",
    color: vetColors.textSecondary,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  value: {
    fontSize: mobileFontSize.md,
    color: vetColors.textPrimary,
    lineHeight: 22
  },
  sectionTitle: {
    fontSize: mobileFontSize.lg,
    fontWeight: "700",
    color: vetColors.textPrimary,
    marginTop: 8,
    marginBottom: 10
  },
  muted: { fontSize: mobileFontSize.md, color: vetColors.textSecondary },
  attachRow: {
    backgroundColor: vetColors.cardBg,
    borderRadius: mobileRadius.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: vetColors.border
  },
  attachLabel: {
    fontSize: mobileFontSize.md,
    fontWeight: "600",
    color: vetColors.primary
  },
  attachUrl: {
    fontSize: mobileFontSize.sm,
    color: vetColors.textSecondary,
    marginTop: 4
  },
  headerBtn: { marginRight: 4 },
  headerBtnText: {
    color: vetColors.primary,
    fontWeight: "600",
    fontSize: mobileFontSize.md
  },
  actionBox: {
    marginBottom: 14,
    backgroundColor: vetColors.cardBg,
    borderRadius: mobileRadius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: vetColors.border
  },
  actionTitle: {
    fontSize: mobileFontSize.md,
    fontWeight: "700",
    color: vetColors.textPrimary,
    marginBottom: 12
  },
  actionBtn: {
    backgroundColor: vetColors.primary,
    borderRadius: mobileRadius.md,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 10
  },
  actionBtnDanger: {
    backgroundColor: vetColors.cardBg,
    borderRadius: mobileRadius.md,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: vetColors.danger
  },
  actionBtnText: {
    color: vetColors.onPrimary,
    fontWeight: "700",
    fontSize: mobileFontSize.md
  },
  actionBtnDangerText: {
    color: vetColors.danger,
    fontWeight: "700",
    fontSize: mobileFontSize.md
  },
  actionBtnDisabled: { opacity: 0.55 },
  editCard: {
    marginBottom: 14,
    backgroundColor: vetColors.cardBg,
    borderRadius: mobileRadius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: vetColors.border
  },
  editTitle: {
    fontSize: mobileFontSize.md,
    fontWeight: "700",
    color: vetColors.textPrimary,
    marginBottom: 12
  },
  editLabel: {
    fontSize: mobileFontSize.sm,
    fontWeight: "700",
    color: vetColors.textSecondary,
    marginBottom: 6
  },
  editInput: {
    backgroundColor: vetColors.canvas,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: vetColors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: mobileFontSize.md,
    color: vetColors.textPrimary,
    marginBottom: 12
  },
  editMultiline: { minHeight: 100, textAlignVertical: "top" },
  saveBtn: {
    backgroundColor: vetColors.primary,
    borderRadius: mobileRadius.md,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4
  },
  saveBtnText: {
    color: vetColors.onPrimary,
    fontWeight: "700",
    fontSize: mobileFontSize.md
  }
});
