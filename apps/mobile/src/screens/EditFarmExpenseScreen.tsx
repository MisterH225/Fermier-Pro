import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
import { FinanceModuleGate } from "../components/FinanceModuleGate";
import { useSession } from "../context/SessionContext";
import { fetchFarmExpense, patchFarmExpense } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "EditFarmExpense">;

function parseAmount(raw: string): number | null {
  const n = Number.parseFloat(raw.trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function amountToInput(amount: string | number): string {
  if (typeof amount === "number") return String(amount);
  const n = Number.parseFloat(amount);
  return Number.isFinite(n) ? String(n) : amount;
}

export function EditFarmExpenseScreen({ route, navigation }: Props) {
  const { farmId, farmName, expenseId } = route.params;
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const qc = useQueryClient();
  const [amountText, setAmountText] = useState("");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");

  const expenseQuery = useQuery({
    queryKey: ["farmExpense", farmId, expenseId, activeProfileId],
    queryFn: () =>
      fetchFarmExpense(accessToken, farmId, expenseId, activeProfileId),
    enabled: clientFeatures.finance
  });

  useEffect(() => {
    const e = expenseQuery.data;
    if (e) {
      setAmountText(amountToInput(e.amount));
      setLabel(e.label);
      setCategory(e.category ?? "");
      setNote(e.note ?? "");
    }
  }, [expenseQuery.data?.id]);

  const mutation = useMutation({
    mutationFn: () => {
      const amount = parseAmount(amountText);
      if (amount == null) throw new Error("Montant invalide.");
      return patchFarmExpense(
        accessToken,
        farmId,
        expenseId,
        {
          amount,
          label: label.trim(),
          category: category.trim() || null,
          note: note.trim() || null
        },
        activeProfileId
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["financeSummary", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmExpenses", farmId] });
      void qc.invalidateQueries({
        queryKey: ["farmExpense", farmId, expenseId]
      });
      navigation.goBack();
    },
    onError: (e: Error) => {
      Alert.alert("Enregistrement impossible", e.message);
    }
  });

  const submit = () => {
    if (!label.trim()) {
      Alert.alert("Champ requis", "Indique un libellé pour cette dépense.");
      return;
    }
    const amount = parseAmount(amountText);
    if (amount == null) {
      Alert.alert("Montant", "Saisis un montant numérique positif.");
      return;
    }
    mutation.mutate();
  };

  if (!clientFeatures.finance) {
    return (
      <FinanceModuleGate>
        <View />
      </FinanceModuleGate>
    );
  }

  if (expenseQuery.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#5d7a1f" />
      </View>
    );
  }

  const err =
    expenseQuery.error instanceof Error
      ? expenseQuery.error.message
      : expenseQuery.error
        ? String(expenseQuery.error)
        : null;

  if (err || !expenseQuery.data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{err ?? "Dépense introuvable."}</Text>
      </View>
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

        <Text style={styles.label}>Montant (XOF par défaut)</Text>
        <TextInput
          style={styles.input}
          value={amountText}
          onChangeText={setAmountText}
          placeholder="Ex. 125000"
          placeholderTextColor="#a8a99a"
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Libellé</Text>
        <TextInput
          style={styles.input}
          value={label}
          onChangeText={setLabel}
          placeholder="Ex. Aliment finition"
          placeholderTextColor="#a8a99a"
        />

        <Text style={styles.label}>Catégorie (optionnel)</Text>
        <TextInput
          style={styles.input}
          value={category}
          onChangeText={setCategory}
          placeholder="Ex. alimentation"
          placeholderTextColor="#a8a99a"
        />

        <Text style={styles.label}>Note (optionnel)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={note}
          onChangeText={setNote}
          placeholder="Précisions…"
          placeholderTextColor="#a8a99a"
          multiline
        />

        <TouchableOpacity
          style={[styles.cta, mutation.isPending && styles.ctaDisabled]}
          onPress={submit}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>Enregistrer les modifications</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f9f8ea" },
  content: { padding: 16, paddingBottom: 40 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f9f8ea"
  },
  error: { color: "#a34c24", textAlign: "center" },
  hint: { fontSize: 13, color: "#6d745b", marginBottom: 16 },
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
  multiline: { minHeight: 88, textAlignVertical: "top" },
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
