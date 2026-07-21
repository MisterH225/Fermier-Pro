import { CommonActions } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import { getUserFacingError } from "../lib/userFacingError";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useActiveProject } from "../context/ActiveProjectContext";
import { useSession } from "../context/SessionContext";
import { createFarm, type CreateFarmPayload, type FarmDto } from "../lib/api";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";
import { useBottomInset } from "../hooks/useBottomInset";

const PRODUCER = "producer";

type Props = NativeStackScreenProps<RootStackParamList, "CreateFarm">;

const MODES = [
  { value: "batch" as const, label: "Bandes (cheptel groupé)" },
  { value: "individual" as const, label: "Individuel" },
  { value: "hybrid" as const, label: "Hybride" }
];

export function CreateFarmScreen({ navigation }: Props) {
  const bottomInset = useBottomInset();
  const { t } = useTranslation();
  const { accessToken, authMe } = useSession();
  const { setActiveFarm, refreshFarms } = useActiveProject();
  const queryClient = useQueryClient();

  const producerProfile = useMemo(
    () => authMe?.profiles.find((p) => p.type === PRODUCER),
    [authMe?.profiles]
  );

  const [name, setName] = useState("");
  const [livestockMode, setLivestockMode] =
    useState<CreateFarmPayload["livestockMode"]>("batch");
  const [locationSector, setLocationSector] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [locationCountry, setLocationCountry] = useState("Côte d'Ivoire");
  const [addressExtra, setAddressExtra] = useState("");
  const [coords, setCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);

  const mutation = useMutation({
    mutationFn: (payload: CreateFarmPayload) => {
      if (!producerProfile) {
        throw new Error("Aucun profil producteur sur ce compte.");
      }
      return createFarm(accessToken, producerProfile.id, payload);
    },
    onSuccess: async (farm: FarmDto) => {
      await setActiveFarm(farm.id);
      await refreshFarms();
      queryClient.clear();
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "ProducerDashboard" }]
        })
      );
    },
    onError: (e: Error) => {
      Alert.alert("Création impossible", getUserFacingError(e, t));
    }
  });

  const useGps = async () => {
    setGpsBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("", t("producer.gpsDenied"));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      setCoords({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude
      });
    } catch {
      Alert.alert("", t("createFarmScreen.gpsError"));
    } finally {
      setGpsBusy(false);
    }
  };

  const submit = () => {
    const n = name.trim();
    if (!n) {
      Alert.alert("Nom requis", "Indiquez le nom de la ferme.");
      return;
    }
    if (!producerProfile) {
      Alert.alert(
        "Profil producteur",
        "Ce compte ne peut pas créer de ferme pour le moment."
      );
      return;
    }
    if (!coords && !locationCity.trim() && !locationSector.trim()) {
      Alert.alert(
        t("createFarmScreen.locationRequiredTitle"),
        t("createFarmScreen.locationRequiredBody")
      );
      return;
    }
    const payload: CreateFarmPayload = {
      name: n,
      speciesFocus: "porcin",
      livestockMode,
      locationSector: locationSector.trim() || undefined,
      locationCity: locationCity.trim() || undefined,
      locationCountry: locationCountry.trim() || undefined,
      address: addressExtra.trim() || undefined,
      ...(coords
        ? { latitude: coords.latitude, longitude: coords.longitude }
        : {})
    };
    mutation.mutate(payload);
  };

  if (!producerProfile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.warn}>
          Ce compte ne peut pas créer de ferme pour le moment. Contactez le
          support si le problème persiste.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.label}>Nom de la ferme *</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Ex. Élevage du plateau"
        placeholderTextColor={mobileColors.textSecondary}
      />

      <Text style={styles.label}>Espèce</Text>
      <View style={styles.readOnlyField}>
        <Text style={styles.readOnlyText}>Porcin</Text>
      </View>

      <Text style={styles.label}>Mode d&apos;élevage</Text>
      <View style={styles.modeRow}>
        {MODES.map((m) => (
          <TouchableOpacity
            key={m.value}
            style={[
              styles.modeChip,
              livestockMode === m.value && styles.modeChipOn
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

      <Text style={styles.sectionTitle}>{t("createFarmScreen.locationHint")}</Text>

      <Pressable
        style={[styles.gpsBtn, gpsBusy && styles.submitDisabled]}
        onPress={() => void useGps()}
        disabled={gpsBusy}
        testID="create-farm-use-gps"
      >
        {gpsBusy ? (
          <ActivityIndicator color={mobileColors.accent} />
        ) : (
          <Text style={styles.gpsBtnTx}>{t("createFarmScreen.useGps")}</Text>
        )}
      </Pressable>
      {coords ? (
        <Text style={styles.gpsHint}>
          {t("createFarmScreen.gpsCaptured", {
            lat: coords.latitude.toFixed(5),
            lng: coords.longitude.toFixed(5)
          })}
        </Text>
      ) : (
        <Text style={styles.or}>{t("createFarmScreen.orManual")}</Text>
      )}

      <Text style={styles.label}>{t("createFarmScreen.sector")}</Text>
      <TextInput
        style={styles.input}
        value={locationSector}
        onChangeText={setLocationSector}
        placeholder={t("createFarmScreen.sectorPlaceholder")}
        placeholderTextColor={mobileColors.textSecondary}
      />

      <Text style={styles.label}>{t("createFarmScreen.city")}</Text>
      <TextInput
        style={styles.input}
        value={locationCity}
        onChangeText={setLocationCity}
        placeholder={t("createFarmScreen.cityPlaceholder")}
        placeholderTextColor={mobileColors.textSecondary}
      />

      <Text style={styles.label}>{t("createFarmScreen.country")}</Text>
      <TextInput
        style={styles.input}
        value={locationCountry}
        onChangeText={setLocationCountry}
        placeholder={t("createFarmScreen.countryPlaceholder")}
        placeholderTextColor={mobileColors.textSecondary}
      />

      <Text style={styles.label}>{t("createFarmScreen.addressExtra")}</Text>
      <TextInput
        style={[styles.input, styles.inputMulti]}
        value={addressExtra}
        onChangeText={setAddressExtra}
        placeholder={t("createFarmScreen.addressExtraPlaceholder")}
        placeholderTextColor={mobileColors.textSecondary}
        multiline
      />

      <TouchableOpacity
        style={[styles.submit, mutation.isPending && styles.submitDisabled]}
        onPress={submit}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? (
          <ActivityIndicator color={mobileColors.onAccent} />
        ) : (
          <Text style={styles.submitText}>Créer la ferme</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: mobileColors.canvas
  },
  content: {
    padding: mobileSpacing.lg
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    padding: mobileSpacing.xl,
    backgroundColor: mobileColors.canvas
  },
  warn: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    lineHeight: 22,
    textAlign: "center"
  },
  sectionTitle: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.lg,
    marginBottom: mobileSpacing.xs,
    lineHeight: 20
  },
  label: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: mobileColors.textSecondary,
    marginBottom: 6,
    marginTop: mobileSpacing.md
  },
  input: {
    backgroundColor: mobileColors.background,
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...mobileTypography.body,
    color: mobileColors.textPrimary
  },
  readOnlyField: {
    backgroundColor: mobileColors.surfaceMuted,
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  readOnlyText: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary
  },
  inputMulti: {
    minHeight: 72,
    textAlignVertical: "top"
  },
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.sm
  },
  modeChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.background
  },
  modeChipOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  modeChipText: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary
  },
  modeChipTextOn: {
    color: mobileColors.textPrimary,
    fontWeight: "600"
  },
  gpsBtn: {
    marginTop: mobileSpacing.sm,
    borderWidth: 1,
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft,
    borderRadius: mobileRadius.md,
    paddingVertical: 14,
    alignItems: "center"
  },
  gpsBtnTx: {
    color: mobileColors.accent,
    fontWeight: "700",
    fontSize: mobileFontSize.md
  },
  gpsHint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 6
  },
  or: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 8,
    marginBottom: 2
  },
  submit: {
    marginTop: mobileSpacing.xl,
    backgroundColor: mobileColors.accent,
    paddingVertical: 16,
    borderRadius: mobileRadius.pill,
    alignItems: "center"
  },
  submitDisabled: {
    opacity: 0.7
  },
  submitText: {
    color: mobileColors.onAccent,
    fontSize: mobileFontSize.lg,
    fontWeight: "700"
  }
});
