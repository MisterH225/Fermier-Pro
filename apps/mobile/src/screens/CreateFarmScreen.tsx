import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { createFarm, type CreateFarmPayload } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

const PRODUCER = "producer";

type Props = NativeStackScreenProps<RootStackParamList, "CreateFarm">;

const MODES = [
  { value: "batch" as const, label: "Bandes (lots)" },
  { value: "individual" as const, label: "Individuel" },
  { value: "hybrid" as const, label: "Hybride" }
];

export function CreateFarmScreen({ navigation }: Props) {
  const { accessToken, authMe } = useSession();
  const queryClient = useQueryClient();

  const producerProfile = useMemo(
    () => authMe?.profiles.find((p) => p.type === PRODUCER),
    [authMe?.profiles]
  );

  const [name, setName] = useState("");
  const [speciesFocus, setSpeciesFocus] = useState("porcin");
  const [livestockMode, setLivestockMode] =
    useState<CreateFarmPayload["livestockMode"]>("batch");
  const [address, setAddress] = useState("");

  const mutation = useMutation({
    mutationFn: (payload: CreateFarmPayload) => {
      if (!producerProfile) {
        throw new Error("Aucun profil producteur sur ce compte.");
      }
      return createFarm(accessToken, producerProfile.id, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["farms"] });
      void queryClient.invalidateQueries({ queryKey: ["farm"] });
      navigation.goBack();
    },
    onError: (e: Error) => {
      Alert.alert("Création impossible", e.message);
    }
  });

  const submit = () => {
    const n = name.trim();
    if (!n) {
      Alert.alert("Nom requis", "Indique le nom de la ferme.");
      return;
    }
    if (!producerProfile) {
      Alert.alert(
        "Profil producteur",
        "Ce compte n’a pas encore de profil producteur côté serveur."
      );
      return;
    }
    const payload: CreateFarmPayload = {
      name: n,
      speciesFocus: speciesFocus.trim() || undefined,
      livestockMode,
      address: address.trim() || undefined
    };
    mutation.mutate(payload);
  };

  if (!producerProfile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.warn}>
          Tu n’as pas de profil producteur. Le MVP suppose au moins ce profil
          pour créer une ferme (API POST /farms).
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.label}>Nom de la ferme *</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Ex. Élevage du plateau"
        placeholderTextColor="#999"
      />

      <Text style={styles.label}>Espèce / focus</Text>
      <TextInput
        style={styles.input}
        value={speciesFocus}
        onChangeText={setSpeciesFocus}
        placeholder="porcin"
        placeholderTextColor="#999"
      />

      <Text style={styles.label}>Mode d’élevage</Text>
      <View style={styles.modeRow}>
        {MODES.map((m) => (
          <TouchableOpacity
            key={m.value}
            style={[
              styles.modeChip,
              livestockMode === m.value && styles.modeChipOn,
              { marginRight: 8, marginBottom: 8 }
            ]}
            onPress={() => setLivestockMode(m.value)}
          >
            <Text
              style={[
                styles.modeChipText,
                livestockMode === m.value && styles.modeChipTextOn
              ]}
            >
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Adresse (optionnel)</Text>
      <TextInput
        style={[styles.input, styles.inputMulti]}
        value={address}
        onChangeText={setAddress}
        placeholder="Commune, route…"
        placeholderTextColor="#999"
        multiline
      />

      <TouchableOpacity
        style={[
          styles.submit,
          mutation.isPending && styles.submitDisabled
        ]}
        onPress={submit}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Créer la ferme</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.note}>
        L’API exige le profil producteur (en-tête automatique). Tu peux rester
        sur un autre profil actif ailleurs dans l’app.
      </Text>
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
  centered: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f9f8ea"
  },
  warn: {
    color: "#8b4513",
    fontSize: 15,
    lineHeight: 22
  },
  label: {
    fontSize: 12,
    color: "#6d745b",
    marginBottom: 6,
    marginTop: 12,
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
  inputMulti: {
    minHeight: 72,
    textAlignVertical: "top"
  },
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  modeChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e4d4",
    backgroundColor: "#fff"
  },
  modeChipOn: {
    borderColor: "#5d7a1f",
    backgroundColor: "#e8efd9"
  },
  modeChipText: {
    color: "#4b513d",
    fontSize: 14
  },
  modeChipTextOn: {
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
    fontSize: 17,
    fontWeight: "700"
  },
  note: {
    marginTop: 20,
    fontSize: 12,
    color: "#6d745b",
    lineHeight: 17
  }
});
