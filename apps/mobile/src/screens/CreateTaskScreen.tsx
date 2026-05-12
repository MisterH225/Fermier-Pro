import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Card, PrimaryButton, SegmentedControl } from "../components/ui";
import { TasksModuleGate } from "../components/TasksModuleGate";
import { useSession } from "../context/SessionContext";
import {
  createFarmTask,
  type CreateFarmTaskPayload
} from "../lib/api";
import { mobileColors, mobileRadius, mobileSpacing } from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "CreateTask">;

const PRIORITIES = [
  { value: "low" as const, label: "Basse" },
  { value: "normal" as const, label: "Normale" },
  { value: "high" as const, label: "Haute" }
];
type TaskPriority = (typeof PRIORITIES)[number]["value"];

export function CreateTaskScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [dueDate, setDueDate] = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      const t = title.trim();
      if (!t) {
        throw new Error("Le titre est obligatoire.");
      }
      const payload: CreateFarmTaskPayload = {
        title: t,
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        priority,
        dueAt: dueDate.trim()
          ? `${dueDate.trim()}T12:00:00.000Z`
          : undefined
      };
      return createFarmTask(
        accessToken,
        farmId,
        payload,
        activeProfileId
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["farmTasks", farmId] });
      navigation.goBack();
    },
    onError: (e: Error) => {
      Alert.alert("Création impossible", e.message);
    }
  });

  if (!clientFeatures.tasks) {
    return (
      <TasksModuleGate>
        <View />
      </TasksModuleGate>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.farmHint}>{farmName}</Text>

      <Card>
        <Text style={styles.label}>Titre *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Ex. Vaccination bande B"
          placeholderTextColor={mobileColors.textSecondary}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="Détails pour le terrain…"
          placeholderTextColor={mobileColors.textSecondary}
          multiline
        />

        <Text style={styles.label}>Catégorie (optionnel)</Text>
        <TextInput
          style={styles.input}
          value={category}
          onChangeText={setCategory}
          placeholder="sante, logistique…"
          placeholderTextColor={mobileColors.textSecondary}
        />

        <Text style={styles.label}>Priorité</Text>
        <SegmentedControl
          items={PRIORITIES.map((p) => ({ key: p.value, label: p.label }))}
          activeKey={priority}
          onChange={(key) => setPriority(key as TaskPriority)}
        />

        <Text style={styles.label}>Échéance (optionnel, AAAA-MM-JJ)</Text>
        <TextInput
          style={styles.input}
          value={dueDate}
          onChangeText={setDueDate}
          placeholder="2026-05-15"
          placeholderTextColor={mobileColors.textSecondary}
          keyboardType="numbers-and-punctuation"
        />
      </Card>

      <PrimaryButton
        label="Enregistrer l’événement"
        onPress={() => mutation.mutate()}
        disabled={mutation.isPending}
        loading={mutation.isPending}
      />

      {mutation.isPending ? <ActivityIndicator color={mobileColors.accent} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: mobileColors.surface
  },
  content: {
    padding: mobileSpacing.lg,
    paddingBottom: 40,
    gap: mobileSpacing.lg
  },
  farmHint: {
    fontSize: 14,
    color: mobileColors.textSecondary
  },
  label: {
    fontSize: 12,
    color: mobileColors.textSecondary,
    marginBottom: 6,
    marginTop: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  input: {
    backgroundColor: mobileColors.background,
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: mobileColors.textPrimary
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: "top"
  }
});
