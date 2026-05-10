import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
import { acceptFarmInvitationWithToken } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<
  RootStackParamList,
  "AcceptFarmInvitation"
>;

export function AcceptFarmInvitationScreen({ route, navigation }: Props) {
  const prefill = route.params?.prefilledToken ?? "";
  const { accessToken, activeProfileId } = useSession();
  const qc = useQueryClient();
  const [token, setToken] = useState(prefill);

  useEffect(() => {
    if (prefill) setToken(prefill);
  }, [prefill]);

  const mut = useMutation({
    mutationFn: () =>
      acceptFarmInvitationWithToken(
        accessToken,
        token.trim(),
        activeProfileId
      ),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["farms", activeProfileId] });
      void qc.invalidateQueries({ queryKey: ["farm"] });
      Alert.alert(
        res.alreadyMember
          ? "Déjà membre"
          : "Bienvenue sur la ferme",
        res.alreadyMember
          ? "Tu avais déjà accès avec ce rôle."
          : `Tu es maintenant ${roleHint(res.role)} sur cette exploitation.`,
        [
          {
            text: "Voir mes fermes",
            onPress: () => navigation.navigate("FarmList")
          }
        ]
      );
    },
    onError: (e: Error) => Alert.alert("Invitation refusée", e.message)
  });

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.intro}>
        Colle le jeton reçu lorsqu&apos;un gestionnaire t&apos;a invité par
        message ou e-mail (sans espaces).
      </Text>
      <Text style={styles.label}>Jeton d&apos;invitation</Text>
      <TextInput
        style={styles.input}
        value={token}
        onChangeText={setToken}
        placeholder="Suite hexadécimale du lien ou du message"
        autoCapitalize="none"
        autoCorrect={false}
        multiline
      />
      <TouchableOpacity
        style={[styles.cta, mut.isPending && styles.ctaDisabled]}
        disabled={mut.isPending || token.trim().length < 16}
        onPress={() => mut.mutate()}
      >
        <Text style={styles.ctaTxt}>
          {mut.isPending ? "Validation…" : "Rejoindre la ferme"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function roleHint(role: string): string {
  switch (role) {
    case "worker":
      return "technicien";
    case "viewer":
      return "observateur";
    case "veterinarian":
      return "intervenant vétérinaire";
    case "manager":
      return "gérant";
    default:
      return `membre (${role})`;
  }
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f9f8ea" },
  content: { padding: 16, paddingBottom: 40 },
  intro: {
    fontSize: 14,
    color: "#6d745b",
    lineHeight: 20,
    marginBottom: 16
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4a5238",
    marginBottom: 8
  },
  input: {
    borderWidth: 1,
    borderColor: "#d4d2c4",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: "#fff",
    minHeight: 88,
    textAlignVertical: "top"
  },
  cta: {
    marginTop: 24,
    backgroundColor: "#5d7a1f",
    borderRadius: 14,
    padding: 16,
    alignItems: "center"
  },
  ctaDisabled: { opacity: 0.55 },
  ctaTxt: { color: "#fff", fontWeight: "700", fontSize: 16 }
});
