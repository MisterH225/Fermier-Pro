import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { MarketplaceModuleGate } from "../components/MarketplaceModuleGate";
import { useSession } from "../context/SessionContext";
import {
  createMarketplaceListing,
  fetchFarmAnimals,
  fetchFarms,
  type CreateMarketplaceListingPayload
} from "../lib/api";
import { marketplaceActionErrorMessage } from "../lib/marketplaceLabels";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "CreateMarketplaceListing">;

export function CreateMarketplaceListingScreen({ navigation, route }: Props) {
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const qc = useQueryClient();

  const initialFarmId = route.params?.farmId;
  const [farmId, setFarmId] = useState<string | null>(initialFarmId ?? null);
  const [animalId, setAnimalId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [currency, setCurrency] = useState("XOF");
  const [locationLabel, setLocationLabel] = useState("");

  const farmsQ = useQuery({
    queryKey: ["farms", activeProfileId],
    queryFn: () => fetchFarms(accessToken, activeProfileId)
  });

  const animalsQ = useQuery({
    queryKey: ["farmAnimals", farmId, activeProfileId],
    queryFn: () => fetchFarmAnimals(accessToken, farmId!, activeProfileId),
    enabled: Boolean(farmId)
  });

  const animals = animalsQ.data ?? [];

  const mut = useMutation({
    mutationFn: () => {
      const t = title.trim();
      if (!t) {
        throw new Error("Le titre est obligatoire.");
      }
      const payload: CreateMarketplaceListingPayload = {
        title: t,
        description: description.trim() || undefined,
        currency: currency.trim() || "XOF",
        locationLabel: locationLabel.trim() || undefined
      };
      if (farmId) {
        payload.farmId = farmId;
      }
      if (animalId) {
        payload.animalId = animalId;
      }
      const rawPrice = unitPrice.trim().replace(",", ".");
      if (rawPrice) {
        const p = Number.parseFloat(rawPrice);
        if (!Number.isFinite(p) || p < 0) {
          throw new Error("Prix unitaire invalide.");
        }
        payload.unitPrice = p;
      }
      const rawQty = quantity.trim();
      if (rawQty) {
        const qn = Number.parseInt(rawQty, 10);
        if (!Number.isFinite(qn) || qn < 1) {
          throw new Error("Quantité : entier positif ou champ vide.");
        }
        payload.quantity = qn;
      }
      return createMarketplaceListing(accessToken, payload, activeProfileId);
    },
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ["marketplaceMyListings"] });
      void qc.invalidateQueries({ queryKey: ["marketplaceListings"] });
      navigation.replace("MarketplaceListingDetail", {
        listingId: created.id,
        headline: created.title
      });
    },
    onError: (e: Error) =>
      Alert.alert(
        "Création impossible",
        marketplaceActionErrorMessage(e.message)
      )
  });

  const farmRows = farmsQ.data ?? [];
  const loadingFarms = farmsQ.isPending;

  const farmChips = useMemo(
    () => (
      <View style={styles.chipRow}>
        <TouchableOpacity
          style={[styles.chip, farmId === null && styles.chipActive]}
          onPress={() => {
            setFarmId(null);
            setAnimalId(null);
          }}
        >
          <Text style={[styles.chipTxt, farmId === null && styles.chipTxtActive]}>
            Sans ferme
          </Text>
        </TouchableOpacity>
        {farmRows.map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[styles.chip, farmId === f.id && styles.chipActive]}
            onPress={() => {
              setFarmId(f.id);
              setAnimalId(null);
            }}
          >
            <Text style={[styles.chipTxt, farmId === f.id && styles.chipTxtActive]}>
              {f.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    ),
    [farmId, farmRows]
  );

  if (!clientFeatures.marketplace) {
    return (
      <MarketplaceModuleGate>
        <View />
      </MarketplaceModuleGate>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.sectionTitle}>Ferme liée (optionnel)</Text>
      {loadingFarms ? (
        <ActivityIndicator color="#5d7a1f" style={{ marginVertical: 8 }} />
      ) : (
        farmChips
      )}
      <Text style={styles.hint}>
        Lier une ferme permet de vérifier les droits « marché » sur cette ferme avant
        publication.
      </Text>

      {farmId ? (
        <>
          <Text style={[styles.sectionTitle, styles.sectionSp]}>Animal (optionnel)</Text>
          {animalsQ.isPending ? (
            <ActivityIndicator color="#5d7a1f" />
          ) : (
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, animalId === null && styles.chipActive]}
                onPress={() => setAnimalId(null)}
              >
                <Text
                  style={[styles.chipTxt, animalId === null && styles.chipTxtActive]}
                >
                  Aucun
                </Text>
              </TouchableOpacity>
              {animals.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.chip, animalId === a.id && styles.chipActive]}
                  onPress={() => setAnimalId(a.id)}
                >
                  <Text
                    style={[styles.chipTxt, animalId === a.id && styles.chipTxtActive]}
                  >
                    {a.publicId}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      ) : null}

      <Text style={styles.label}>Titre *</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Ex. Vaches laitières — lot de 5"
        placeholderTextColor="#999"
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.inputMulti]}
        value={description}
        onChangeText={setDescription}
        placeholder="Détails, race, conformité…"
        placeholderTextColor="#999"
        multiline
      />

      <Text style={styles.label}>Prix unitaire (optionnel)</Text>
      <TextInput
        style={styles.input}
        value={unitPrice}
        onChangeText={setUnitPrice}
        placeholder="Ex. 250000"
        placeholderTextColor="#999"
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>Quantité (optionnel)</Text>
      <TextInput
        style={styles.input}
        value={quantity}
        onChangeText={setQuantity}
        placeholder="Nombre d’unités"
        placeholderTextColor="#999"
        keyboardType="number-pad"
      />

      <Text style={styles.label}>Devise</Text>
      <TextInput
        style={styles.input}
        value={currency}
        onChangeText={setCurrency}
        placeholder="XOF"
        placeholderTextColor="#999"
        autoCapitalize="characters"
      />

      <Text style={styles.label}>Lieu / retrait</Text>
      <TextInput
        style={styles.input}
        value={locationLabel}
        onChangeText={setLocationLabel}
        placeholder="Ex. Nioro du Rip"
        placeholderTextColor="#999"
      />

      <TouchableOpacity
        style={[styles.submit, mut.isPending && styles.submitDisabled]}
        disabled={mut.isPending}
        onPress={() => mut.mutate()}
      >
        <Text style={styles.submitTxt}>
          {mut.isPending ? "Enregistrement…" : "Créer le brouillon"}
        </Text>
      </TouchableOpacity>
      <Text style={styles.footerNote}>
        L’annonce est créée en brouillon. Tu pourras la publier depuis le détail.
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
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6d745b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8
  },
  sectionSp: {
    marginTop: 16
  },
  hint: {
    fontSize: 12,
    color: "#8b7355",
    marginTop: 8,
    lineHeight: 18
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  chip: {
    borderWidth: 1,
    borderColor: "#c8d4b0",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: "#fff"
  },
  chipActive: {
    backgroundColor: "#5d7a1f",
    borderColor: "#5d7a1f"
  },
  chipTxt: {
    fontSize: 14,
    color: "#1f2910"
  },
  chipTxtActive: {
    color: "#fff",
    fontWeight: "600"
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
  },
  footerNote: {
    marginTop: 16,
    fontSize: 13,
    color: "#6d745b",
    lineHeight: 18
  }
});
