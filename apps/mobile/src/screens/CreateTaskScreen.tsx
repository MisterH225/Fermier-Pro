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
  TouchableOpacity,
  View
} from "react-native";
import { useSession } from "../context/SessionContext";
import {
  createFarmTask,
  type CreateFarmTaskPayload
} from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "CreateTask">;

const PRIORITIES = [
  { value: "low" as const, label: "Basse" },
  { value: "normal" as const, label: "Normale" },
  { value: "high" as const, label: "Haute" }
];

export function CreateTaskScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { accessToken, activeProfileId } = useSession();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] =
    useState<CreateFarmTaskPayload["priority"]>("normal");
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

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.farmHint}>{farmName}</Text>

      <Text style={styles.label}>Titre *</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Ex. Vaccination bande B"
        placeholderTextColor="#999"
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={description}
        onChangeText={setDescription}
        placeholder="Détails pour le terrain…"
        placeholderTextColor="#999"
        multiline
      />

      <Text style={styles.label}>Catégorie (optionnel)</Text>
      <TextInput
        style={styles.input}
        value={category}
        onChangeText={setCategory}
        placeholder="sante, logistique…"
        placeholderTextColor="#999"
      />

      <Text style={styles.label}>Priorité</Text>
      <View style={styles.row}>
        {PRIORITIES.map((p) => (
          <TouchableOpacity
            key={p.value}
            style={[
              styles.chip,
              priority === p.value && styles.chipOn,
              { marginRight: 8, marginBottom: 8 }
            ]}
            onPress={() => setPriority(p.value)}
          >
            <Text
              style={[
                styles.chipText,
                priority === p.value && styles.chipTextOn
              ]}
            >
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Échéance (optionnel, AAAA-MM-JJ)</Text>
      <TextInput
        style={styles.input}
        value={dueDate}
        onChangeText={setDueDate}
        placeholder="2026-05-15"
        placeholderTextColor="#999"
        keyboardType="numbers-and-punctuation"
      />

      <TouchableOpacity
        style={[styles.submit, mutation.isPending && styles.submitDisabled]}
        onPress={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Créer la tâche</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
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
  farmHint: {
    fontSize: 14,
    color: "#6d745b",
    marginBottom: 12
  },
  label: {
    fontSize: 12,
    color: "#6d745b",
    marginBottom: 6,
    marginTop: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e4d4",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1f2910"
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: "top"
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e4d4",
    backgroundColor: "#fff"
  },
  chipOn: {
    borderColor: "#5d7a1f",
    backgroundColor: "#e8efd9"
  },
  chipText: {
    color: "#4b513d",
    fontSize: 14
  },
  chipTextOn: {
    color: "#1f2910",
    fontWeight: "600"
  },
  submit: {
    marginTop: 28,
    backgroundColor: "#5d7a1f",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center"
  },
  submitDisabled: {
    opacity: 0.7
  },
  submitText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 17
  }
});
