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
import { FeedStockModuleGate } from "../components/FeedStockModuleGate";
import { useSession } from "../context/SessionContext";
import { createFeedStockLot } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<
  RootStackParamList,
  "CreateFeedPurchase"
>;

export function CreateFeedPurchaseScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const qc = useQueryClient();

  const [productName, setProductName] = useState("");
  const [quantityKg, setQuantityKg] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [notes, setNotes] = useState("");

  const mut = useMutation({
    mutationFn: () => {
      const q = Number.parseFloat(quantityKg.trim().replace(",", "."));
      if (!productName.trim()) {
        throw new Error("Indique un nom de produit ou formulation.");
      }
      if (!Number.isFinite(q) || q <= 0) {
        throw new Error("Indique une quantité en kg.");
      }
      return createFeedStockLot(
        accessToken,
        farmId,
        {
          productName: productName.trim(),
          quantityKg: q,
          supplierName: supplierName.trim() || undefined,
          notes: notes.trim() || undefined
        },
        activeProfileId
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feedStockLots", farmId] });
      Alert.alert("Enregistré", "Le lot a été ajouté au stock.", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    },
    onError: (e: Error) => Alert.alert("Erreur", e.message)
  });

  if (!clientFeatures.feedStock) {
    return (
      <FeedStockModuleGate>
        <View />
      </FeedStockModuleGate>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.farmHint}>{farmName}</Text>
      <Text style={styles.label}>Produit / formulation</Text>
      <TextInput
        style={styles.input}
        value={productName}
        onChangeText={setProductName}
        placeholder="Ex. granulés croissance 16 %"
      />
      <Text style={styles.label}>Quantité achetée (kg)</Text>
      <TextInput
        style={styles.input}
        value={quantityKg}
        onChangeText={setQuantityKg}
        keyboardType="decimal-pad"
        placeholder="ex. 500"
      />
      <Text style={styles.label}>Fournisseur (optionnel)</Text>
      <TextInput
        style={styles.input}
        value={supplierName}
        onChangeText={setSupplierName}
      />
      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={notes}
        onChangeText={setNotes}
        multiline
      />
      <TouchableOpacity
        style={[styles.cta, mut.isPending && styles.ctaDisabled]}
        disabled={mut.isPending}
        onPress={() => mut.mutate()}
      >
        <Text style={styles.ctaTxt}>
          {mut.isPending ? "Enregistrement…" : "Ajouter au stock"}
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
  textArea: { minHeight: 80, textAlignVertical: "top" },
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
