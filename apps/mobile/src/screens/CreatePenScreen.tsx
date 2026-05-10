import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { HousingModuleGate } from "../components/HousingModuleGate";
import { useSession } from "../context/SessionContext";
import { createPen } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "CreatePen">;

export function CreatePenScreen({ route, navigation }: Props) {
  const { farmId, farmName, barnId, barnName } = route.params;
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [zoneLabel, setZoneLabel] = useState("");
  const [capacityText, setCapacityText] = useState("");
  const [statusText, setStatusText] = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      let capacity: number | undefined;
      if (capacityText.trim()) {
        const n = Number.parseInt(capacityText.trim(), 10);
        if (!Number.isFinite(n) || n < 0) {
          throw new Error("Capacité invalide.");
        }
        capacity = n;
      }
      return createPen(
        accessToken,
        farmId,
        barnId,
        {
          name: name.trim(),
          ...(code.trim() ? { code: code.trim() } : {}),
          ...(zoneLabel.trim() ? { zoneLabel: zoneLabel.trim() } : {}),
          ...(capacity !== undefined ? { capacity } : {}),
          ...(statusText.trim() ? { status: statusText.trim() } : {})
        },
        activeProfileId
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["farmBarn", farmId, barnId] });
      void qc.invalidateQueries({ queryKey: ["farmBarns", farmId] });
      navigation.goBack();
    },
    onError: (e: Error) => {
      Alert.alert("Création impossible", e.message);
    }
  });

  const submit = () => {
    if (!name.trim()) {
      Alert.alert("Champ requis", "Indique un nom pour la loge.");
      return;
    }
    mutation.mutate();
  };

  if (!clientFeatures.housing) {
    return (
      <HousingModuleGate>
        <View />
      </HousingModuleGate>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Text style={styles.hint}>{farmName}</Text>
        <Text style={styles.barnHint}>{barnName ?? "Bâtiment"}</Text>

        <Text style={styles.label}>Nom de la loge</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Ex. Loge A"
          placeholderTextColor="#a8a99a"
        />

        <Text style={styles.label}>Code (optionnel)</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="Ex. LA"
          placeholderTextColor="#a8a99a"
        />

        <Text style={styles.label}>Zone / libellé (optionnel)</Text>
        <TextInput
          style={styles.input}
          value={zoneLabel}
          onChangeText={setZoneLabel}
          placeholder="Ex. Côté fenêtres"
          placeholderTextColor="#a8a99a"
        />

        <Text style={styles.label}>Capacité (optionnel)</Text>
        <TextInput
          style={styles.input}
          value={capacityText}
          onChangeText={setCapacityText}
          placeholder="Nombre de places"
          placeholderTextColor="#a8a99a"
          keyboardType="number-pad"
        />

        <Text style={styles.label}>Statut (optionnel)</Text>
        <TextInput
          style={styles.input}
          value={statusText}
          onChangeText={setStatusText}
          placeholder="Laisser vide pour « active »"
          placeholderTextColor="#a8a99a"
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={[styles.cta, mutation.isPending && styles.ctaDisabled]}
          onPress={submit}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>Créer la loge</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f9f8ea" },
  content: { padding: 16, paddingBottom: 40 },
  hint: { fontSize: 13, color: "#6d745b", marginBottom: 4 },
  barnHint: {
    fontSize: 15,
    fontWeight: "700",
    color: "#5d7a1f",
    marginBottom: 16
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4a5238",
    marginBottom: 8
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e8e4d4",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1f2910",
    marginBottom: 16
  },
  cta: {
    backgroundColor: "#5d7a1f",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8
  },
  ctaDisabled: { opacity: 0.7 },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 16 }
});
