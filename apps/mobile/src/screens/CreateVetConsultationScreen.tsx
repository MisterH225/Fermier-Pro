import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { mobileColors, mobileRadius, mobileFontSize } from "../theme/mobileTheme";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getUserFacingError } from "../lib/userFacingError";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { VetModuleGate } from "../components/VetModuleGate";
import { useSession } from "../context/SessionContext";
import type { AnimalListItem } from "../lib/api";
import { createVetConsultation, fetchFarmAnimals } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";
import { useBottomInset } from "../hooks/useBottomInset";
import { producerColors } from "../theme/producerTheme";

type Props = NativeStackScreenProps<RootStackParamList, "CreateVetConsultation">;

function animalTitle(a: AnimalListItem): string {
  const tag = a.tagCode?.trim() || a.publicId;
  return `${a.species.name} · ${tag}`;
}

export function CreateVetConsultationScreen({ route, navigation }: Props) {
  const bottomInset = useBottomInset();
  const { t } = useTranslation();
  const { farmId, farmName } = route.params;
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [summary, setSummary] = useState("");
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null);

  const animalsQuery = useQuery({
    queryKey: ["farmAnimals", farmId, activeProfileId],
    queryFn: () => fetchFarmAnimals(accessToken, farmId, activeProfileId),
    enabled: clientFeatures.vetConsultations
  });

  const mutation = useMutation({
    mutationFn: () =>
      createVetConsultation(
        accessToken,
        farmId,
        {
          subject: subject.trim(),
          ...(summary.trim() ? { summary: summary.trim() } : {}),
          ...(selectedAnimalId ? { animalId: selectedAnimalId } : {})
        },
        activeProfileId
      ),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["vetConsultations", farmId] });
      navigation.replace("VetConsultationDetail", {
        farmId,
        farmName,
        consultationId: data.id
      });
    },
    onError: (e: Error) => {
      Alert.alert("Création impossible", getUserFacingError(e, t));
    }
  });

  const submit = () => {
    if (!subject.trim()) {
      Alert.alert("Champ requis", "Indique un objet pour le dossier.");
      return;
    }
    mutation.mutate();
  };

  if (!clientFeatures.vetConsultations) {
    return (
      <VetModuleGate>
        <View />
      </VetModuleGate>
    );
  }

  const animals = animalsQuery.data ?? [];

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      >
        <Text style={styles.screenTitle}>
          {t("vet.offPlatformVisit.title")}
        </Text>
        <Text style={styles.screenSubtitle}>
          {t("vet.offPlatformVisit.subtitle")}
        </Text>

        <Text style={styles.label}>Objet</Text>
        <TextInput
          style={styles.input}
          value={subject}
          onChangeText={setSubject}
          placeholder="Ex. Boiterie truie 12"
          placeholderTextColor={producerColors.textMuted}
        />

        <Text style={styles.label}>Résumé (optionnel)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={summary}
          onChangeText={setSummary}
          placeholder="Symptômes, contexte…"
          placeholderTextColor={producerColors.textMuted}
          multiline
        />

        <Text style={styles.label}>Animal lié (optionnel)</Text>
        <TouchableOpacity
          style={[styles.chip, selectedAnimalId === null && styles.chipOn]}
          onPress={() => setSelectedAnimalId(null)}
        >
          <Text
            style={[
              styles.chipText,
              selectedAnimalId === null && styles.chipTextOn
            ]}
          >
            Aucun animal
          </Text>
        </TouchableOpacity>

        {animalsQuery.isPending ? (
          <View style={styles.animalsLoading}>
            <ActivityIndicator color={producerColors.olive} />
          </View>
        ) : animals.length === 0 ? (
          <Text style={styles.muted}>
            Aucun animal sur cette ferme pour l’instant — tu peux quand même
            créer le dossier.
          </Text>
        ) : (
          <View style={styles.chipWrap}>
            {animals.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={[
                  styles.chip,
                  selectedAnimalId === a.id && styles.chipOn
                ]}
                onPress={() => setSelectedAnimalId(a.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedAnimalId === a.id && styles.chipTextOn
                  ]}
                  numberOfLines={2}
                >
                  {animalTitle(a)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.cta, mutation.isPending && styles.ctaDisabled]}
          onPress={submit}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color={mobileColors.onAccent} />
          ) : (
            <Text style={styles.ctaText}>Créer le dossier</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: mobileColors.canvas },
  content: { padding: 16 },
  screenTitle: {
    fontSize: mobileFontSize.xl,
    fontWeight: "800",
    color: mobileColors.textPrimary,
    marginBottom: 6
  },
  screenSubtitle: {
    fontSize: mobileFontSize.md,
    color: mobileColors.textSecondary,
    lineHeight: 20,
    marginBottom: 20
  },
  hint: { fontSize: mobileFontSize.sm, color: mobileColors.textSecondary, marginBottom: 16 },
  label: {
    fontSize: mobileFontSize.sm,
    fontWeight: "700",
    color: producerColors.oliveInk,
    marginBottom: 8
  },
  input: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: producerColors.oliveBorderWarm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: mobileFontSize.lg,
    color: mobileColors.textPrimary,
    marginBottom: 16
  },
  multiline: { minHeight: 120, textAlignVertical: "top" },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
    marginTop: 4
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: mobileRadius.xl,
    borderWidth: 1,
    borderColor: producerColors.oliveBorderWarm,
    backgroundColor: mobileColors.background,
    marginRight: 8,
    marginBottom: 8,
    maxWidth: "100%"
  },
  chipOn: {
    borderColor: producerColors.olive,
    backgroundColor: producerColors.oliveWashSoft
  },
  chipText: { fontSize: mobileFontSize.sm, color: producerColors.oliveInk },
  chipTextOn: { fontWeight: "700", color: mobileColors.textPrimary },
  muted: {
    fontSize: mobileFontSize.md,
    color: mobileColors.textSecondary,
    marginBottom: 16,
    lineHeight: 20
  },
  animalsLoading: { paddingVertical: 12, marginBottom: 8 },
  cta: {
    backgroundColor: producerColors.olive,
    borderRadius: mobileRadius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8
  },
  ctaDisabled: { opacity: 0.7 },
  ctaText: { color: mobileColors.onAccent, fontWeight: "700", fontSize: mobileFontSize.lg }
});
