import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
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
import { MarketplaceModuleGate } from "../components/MarketplaceModuleGate";
import { useSession } from "../context/SessionContext";
import {
  fetchMarketplaceListing,
  type UpdateMarketplaceListingPayload,
  updateMarketplaceListing
} from "../lib/api";
import { marketplaceActionErrorMessage } from "../lib/marketplaceLabels";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "EditMarketplaceListing">;

export function EditMarketplaceListingScreen({ navigation, route }: Props) {
  const { listingId } = route.params;
  const { accessToken, activeProfileId, authMe, clientFeatures } = useSession();
  const qc = useQueryClient();
  const synced = useRef(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [currency, setCurrency] = useState("XOF");
  const [locationLabel, setLocationLabel] = useState("");

  const q = useQuery({
    queryKey: ["marketplaceListing", listingId, activeProfileId],
    queryFn: () =>
      fetchMarketplaceListing(accessToken, listingId, activeProfileId),
    enabled: clientFeatures.marketplace
  });

  useEffect(() => {
    synced.current = false;
  }, [listingId]);

  useEffect(() => {
    const L = q.data;
    if (!L || synced.current) {
      return;
    }
    synced.current = true;
    setTitle(L.title);
    setDescription(L.description ?? "");
    if (L.unitPrice != null) {
      const n =
        typeof L.unitPrice === "string"
          ? Number.parseFloat(L.unitPrice)
          : Number(L.unitPrice);
      setUnitPrice(Number.isFinite(n) ? String(n) : "");
    } else {
      setUnitPrice("");
    }
    setQuantity(L.quantity != null ? String(L.quantity) : "");
    setCurrency(L.currency ?? "XOF");
    setLocationLabel(L.locationLabel ?? "");
  }, [q.data]);

  const mut = useMutation({
    mutationFn: () => {
      const t = title.trim();
      if (!t) {
        throw new Error("Le titre est obligatoire.");
      }
      const payload: UpdateMarketplaceListingPayload = {
        title: t,
        description: description.trim() ? description.trim() : null,
        currency: currency.trim() || "XOF",
        locationLabel: locationLabel.trim() ? locationLabel.trim() : null
      };
      const rawPrice = unitPrice.trim().replace(",", ".");
      if (rawPrice) {
        const p = Number.parseFloat(rawPrice);
        if (!Number.isFinite(p) || p < 0) {
          throw new Error("Prix unitaire invalide.");
        }
        payload.unitPrice = p;
      } else {
        payload.unitPrice = null;
      }
      const rawQty = quantity.trim();
      if (rawQty) {
        const qn = Number.parseInt(rawQty, 10);
        if (!Number.isFinite(qn) || qn < 1) {
          throw new Error("Quantité : entier positif ou champ vide.");
        }
        payload.quantity = qn;
      } else {
        payload.quantity = null;
      }
      return updateMarketplaceListing(
        accessToken,
        listingId,
        payload,
        activeProfileId
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["marketplaceListing", listingId] });
      void qc.invalidateQueries({ queryKey: ["marketplaceMyListings"] });
      void qc.invalidateQueries({ queryKey: ["marketplaceListings"] });
      navigation.goBack();
    },
    onError: (e: Error) =>
      Alert.alert(
        "Enregistrement impossible",
        marketplaceActionErrorMessage(e.message)
      )
  });

  const err =
    q.error instanceof Error ? q.error.message : q.error ? String(q.error) : null;

  if (!clientFeatures.marketplace) {
    return (
      <MarketplaceModuleGate>
        <View />
      </MarketplaceModuleGate>
    );
  }

  if (q.isPending || !q.data) {
    return (
      <View style={styles.centered}>
        {err ? (
          <Text style={styles.error}>{err}</Text>
        ) : (
          <ActivityIndicator size="large" color="#5d7a1f" />
        )}
      </View>
    );
  }

  const L = q.data;
  const myId = authMe?.user.id;
  if (!myId || L.sellerUserId !== myId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Tu ne peux modifier que tes propres annonces.</Text>
      </View>
    );
  }

  if (L.status === "sold" || L.status === "cancelled") {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>
          Cette annonce est clôturée et ne peut plus être modifiée.
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
      <Text style={styles.meta}>
        Ferme / animal ne sont pas modifiables après création.
      </Text>

      <Text style={styles.label}>Titre *</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Titre"
        placeholderTextColor="#999"
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.inputMulti]}
        value={description}
        onChangeText={setDescription}
        placeholder="Description"
        placeholderTextColor="#999"
        multiline
      />

      <Text style={styles.label}>Prix unitaire</Text>
      <TextInput
        style={styles.input}
        value={unitPrice}
        onChangeText={setUnitPrice}
        keyboardType="decimal-pad"
        placeholderTextColor="#999"
      />

      <Text style={styles.label}>Quantité</Text>
      <TextInput
        style={styles.input}
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="number-pad"
        placeholderTextColor="#999"
      />

      <Text style={styles.label}>Devise</Text>
      <TextInput
        style={styles.input}
        value={currency}
        onChangeText={setCurrency}
        autoCapitalize="characters"
        placeholderTextColor="#999"
      />

      <Text style={styles.label}>Lieu / retrait</Text>
      <TextInput
        style={styles.input}
        value={locationLabel}
        onChangeText={setLocationLabel}
        placeholderTextColor="#999"
      />

      <TouchableOpacity
        style={[styles.submit, mut.isPending && styles.submitDisabled]}
        disabled={mut.isPending}
        onPress={() => mut.mutate()}
      >
        <Text style={styles.submitTxt}>
          {mut.isPending ? "Enregistrement…" : "Enregistrer"}
        </Text>
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
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f9f8ea"
  },
  error: {
    color: "#b00020",
    textAlign: "center"
  },
  meta: {
    fontSize: 13,
    color: "#6d745b",
    marginBottom: 8,
    lineHeight: 18
  },
  label: {
    fontSize: 13,
    color: "#4b513d",
    marginTop: 16,
    marginBottom: 6,
    fontWeight: "600"
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
    minHeight: 100,
    textAlignVertical: "top"
  },
  submit: {
    marginTop: 24,
    backgroundColor: "#5d7a1f",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center"
  },
  submitDisabled: {
    opacity: 0.65
  },
  submitTxt: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16
  }
});
