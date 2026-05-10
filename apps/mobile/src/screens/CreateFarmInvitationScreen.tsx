import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useSession } from "../context/SessionContext";
import { createFarmInvitation } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<
  RootStackParamList,
  "CreateFarmInvitation"
>;

const ROLES = [
  { value: "worker", label: "Technicien" },
  { value: "viewer", label: "Lecture seule" },
  { value: "veterinarian", label: "Vétérinaire" },
  { value: "manager", label: "Gérant" }
] as const;

export function CreateFarmInvitationScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { accessToken, activeProfileId } = useSession();
  const qc = useQueryClient();

  const [role, setRole] = useState<string>("worker");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      createFarmInvitation(
        accessToken,
        farmId,
        {
          role,
          inviteeEmail: email.trim() || undefined,
          inviteePhone: phone.trim() || undefined
        },
        activeProfileId
      ),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["farmPendingInvitations", farmId] });
      Alert.alert(
        "Invitation créée",
        `Partage ce lien ou code avec la personne invitée (valide jusqu’au ${new Date(
          res.expiresAt
        ).toLocaleDateString("fr-FR")}) :\n\nToken : ${res.token}`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    },
    onError: (e: Error) => Alert.alert("Erreur", e.message)
  });

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.farmHint}>{farmName}</Text>
      <Text style={styles.label}>Rôle</Text>
      <View style={styles.roleRow}>
        {ROLES.map((r) => (
          <TouchableOpacity
            key={r.value}
            style={[styles.roleChip, role === r.value && styles.roleChipOn]}
            onPress={() => setRole(r.value)}
          >
            <Text
              style={[
                styles.roleChipTxt,
                role === r.value && styles.roleChipTxtOn
              ]}
            >
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.label}>E-mail invité (optionnel)</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="exemple@domaine.com"
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Text style={styles.label}>Téléphone invité (optionnel)</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="+221 …"
        keyboardType="phone-pad"
      />
      <Text style={styles.note}>
        Au moins un e-mail ou un téléphone aide à retrouver l’invitation ; le
        token peut aussi être copié après création.
      </Text>
      <TouchableOpacity
        style={[styles.cta, mut.isPending && styles.ctaDisabled]}
        disabled={mut.isPending}
        onPress={() => mut.mutate()}
      >
        <Text style={styles.ctaTxt}>
          {mut.isPending ? "Création…" : "Créer l’invitation"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f9f8ea" },
  content: { padding: 16, paddingBottom: 40 },
  farmHint: { fontSize: 14, color: "#6d745b", marginBottom: 16 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4a5238",
    marginBottom: 6,
    marginTop: 10
  },
  input: {
    borderWidth: 1,
    borderColor: "#d4d2c4",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#fff"
  },
  roleRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#c4c2b4",
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: "#fff"
  },
  roleChipOn: {
    borderColor: "#5d7a1f",
    backgroundColor: "#e8f0d4"
  },
  roleChipTxt: { fontSize: 14, color: "#4a5238" },
  roleChipTxtOn: { fontWeight: "700", color: "#3d5218" },
  note: { fontSize: 13, color: "#6d745b", marginTop: 12, lineHeight: 18 },
  cta: {
    marginTop: 24,
    backgroundColor: "#5d7a1f",
    borderRadius: 14,
    padding: 16,
    alignItems: "center"
  },
  ctaDisabled: { opacity: 0.6 },
  ctaTxt: { color: "#fff", fontWeight: "700", fontSize: 16 }
});
