import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { mobileColors } from "../theme/mobileTheme";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ReconciliationOfferDto } from "../lib/api";
import { ReconciliationAlertModal } from "../components/stock/ReconciliationAlertModal";
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
import { FinanceModuleGate } from "../components/FinanceModuleGate";
import { useSession } from "../context/SessionContext";
import { createFarmExpense, type CreateFarmExpenseResponse } from "../lib/api";
import { invalidateFarmFinanceQueries } from "../lib/invalidateFarmFinanceQueries";
import {
  offlineQueuedMessage,
  useOfflineMutation
} from "../hooks/useOfflineMutation";
import type { RootStackParamList } from "../types/navigation";
import { getQueryErrorMessage, getUserFacingError } from "../lib/userFacingError";

type Props = NativeStackScreenProps<RootStackParamList, "CreateFarmExpense">;

function parseAmount(raw: string): number | null {
  const n = Number.parseFloat(raw.trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function CreateFarmExpenseScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { t } = useTranslation();
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const qc = useQueryClient();
  const [amountText, setAmountText] = useState("");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [reconciliationOffer, setReconciliationOffer] =
    useState<ReconciliationOfferDto | null>(null);

  const buildBody = () => {
    const amount = parseAmount(amountText);
    if (amount == null) {
      throw new Error("Montant invalide.");
    }
    return {
      amount,
      label: label.trim(),
      ...(category.trim() ? { category: category.trim() } : {}),
      ...(note.trim() ? { note: note.trim() } : {})
    };
  };

  const mutation = useOfflineMutation({
    farmId,
    type: "finance.createExpense",
    label: label.trim() || "Dépense",
    mutationFn: async () =>
      createFarmExpense(accessToken, farmId, buildBody(), activeProfileId),
    buildOfflineItem: () => ({
      calls: [
        {
          method: "POST",
          path: `/farms/${farmId}/finance/expenses`,
          body: buildBody()
        }
      ],
      invalidateRoots: [
        "financeOverview",
        "financeTransactions",
        "financeReport",
        "farmExpenses"
      ]
    }),
    onSuccess: (res) => {
      invalidateFarmFinanceQueries(qc, farmId);
      const body = res as CreateFarmExpenseResponse;
      if (body.reconciliation && body.reconciliation.status !== "none") {
        setReconciliationOffer(body.reconciliation);
        return;
      }
      navigation.goBack();
    },
    onQueued: () => {
      invalidateFarmFinanceQueries(qc, farmId);
      navigation.goBack();
      Alert.alert("", offlineQueuedMessage(t));
    },
    onError: (e: Error) => {
      Alert.alert(t("common.errors.saveFailed"), getUserFacingError(e, t));
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

  return (
    <>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
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
            <Text style={styles.ctaText}>Enregistrer la dépense</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    {reconciliationOffer && accessToken ? (
      <ReconciliationAlertModal
        visible
        offer={reconciliationOffer}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        onClose={() => {
          setReconciliationOffer(null);
          navigation.goBack();
        }}
        onDone={() => {
          invalidateFarmFinanceQueries(qc, farmId);
          void qc.invalidateQueries({ queryKey: ["farmFeed", farmId] });
          setReconciliationOffer(null);
          navigation.goBack();
        }}
      />
    ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: mobileColors.canvas },
  content: { padding: 16, paddingBottom: 40 },
  hint: { fontSize: 13, color: mobileColors.textSecondary, marginBottom: 16 },
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
    color: mobileColors.textPrimary,
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
