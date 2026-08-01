import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { FarmMapPickerModal } from "../producer/FarmMapPickerModal";
import { merchantColors } from "../../theme/merchantTheme";
import {
  mobileColors,
  mobileFontSize,
  mobileRadius,
  mobileSpacing
} from "../../theme/mobileTheme";

export type MerchantLocationValue = {
  locationCity: string;
  latitude: number | null;
  longitude: number | null;
};

type Props = {
  value: MerchantLocationValue;
  onChange: (next: MerchantLocationValue) => void;
  /** Affiche le rappel moulin non localisé. */
  showMillNudge?: boolean;
  testID?: string;
};

/**
 * Localisation commerçant — même UX que la ferme :
 * localité texte OU GPS / épingle (FarmMapPickerModal).
 */
export function MerchantLocationFields({
  value,
  onChange,
  showMillNudge = false,
  testID = "merchant-location-fields"
}: Props) {
  const { t } = useTranslation();
  const [gpsBusy, setGpsBusy] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);

  const useGps = async () => {
    setGpsBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t("common.accessDeniedTitle"), t("producer.gpsDenied"));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      onChange({
        ...value,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude
      });
    } catch {
      Alert.alert(t("common.error"), t("createFarmScreen.gpsError"));
    } finally {
      setGpsBusy(false);
    }
  };

  const hasCoords =
    value.latitude != null &&
    value.longitude != null &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude);

  return (
    <View style={styles.wrap} testID={testID}>
      <Text style={styles.label}>{t("merchant.location.title")}</Text>
      <Text style={styles.hint}>{t("merchant.location.hint")}</Text>

      {showMillNudge ? (
        <View style={styles.nudge} testID={`${testID}-mill-nudge`}>
          <Ionicons
            name="location-outline"
            size={18}
            color={merchantColors.primary}
          />
          <Text style={styles.nudgeTx}>{t("merchant.location.millNudge")}</Text>
        </View>
      ) : null}

      <TextInput
        style={styles.input}
        value={value.locationCity}
        onChangeText={(locationCity) => onChange({ ...value, locationCity })}
        placeholder={t("merchant.location.cityPlaceholder")}
        placeholderTextColor={mobileColors.textSecondary}
        autoCapitalize="words"
        testID={`${testID}-city`}
      />

      {hasCoords ? (
        <Text style={styles.coords} testID={`${testID}-coords`}>
          {t("merchant.location.coordsSet", {
            lat: value.latitude!.toFixed(5),
            lng: value.longitude!.toFixed(5)
          })}
        </Text>
      ) : null}

      {Platform.OS !== "web" ? (
        <Pressable
          style={styles.row}
          onPress={() => setMapVisible(true)}
          testID={`${testID}-map`}
        >
          <Ionicons
            name="map-outline"
            size={20}
            color={merchantColors.primary}
          />
          <Text style={styles.rowTx}>{t("producer.placeOnMap")}</Text>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={mobileColors.textSecondary}
          />
        </Pressable>
      ) : null}

      <Pressable
        style={styles.row}
        onPress={() => void useGps()}
        disabled={gpsBusy}
        testID={`${testID}-gps`}
      >
        {gpsBusy ? (
          <ActivityIndicator color={merchantColors.primary} />
        ) : (
          <Ionicons
            name="navigate-outline"
            size={20}
            color={merchantColors.primary}
          />
        )}
        <Text style={styles.rowTx}>{t("producer.useGpsShort")}</Text>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={mobileColors.textSecondary}
        />
      </Pressable>

      {hasCoords ? (
        <Pressable
          style={styles.clear}
          onPress={() =>
            onChange({ ...value, latitude: null, longitude: null })
          }
          testID={`${testID}-clear-coords`}
        >
          <Text style={styles.clearTx}>{t("merchant.location.clearCoords")}</Text>
        </Pressable>
      ) : null}

      <FarmMapPickerModal
        visible={mapVisible}
        onClose={() => setMapVisible(false)}
        initialLat={value.latitude}
        initialLng={value.longitude}
        onConfirm={(lat, lng) => {
          onChange({ ...value, latitude: lat, longitude: lng });
          setMapVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.sm },
  label: {
    fontSize: mobileFontSize.md,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  hint: {
    fontSize: mobileFontSize.sm,
    color: mobileColors.textSecondary,
    marginBottom: 4
  },
  nudge: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: mobileSpacing.sm,
    borderRadius: mobileRadius.md,
    backgroundColor: merchantColors.primaryLight
  },
  nudgeTx: {
    flex: 1,
    fontSize: mobileFontSize.sm,
    color: merchantColors.primary,
    fontWeight: "600"
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 12,
    fontSize: mobileFontSize.md,
    color: mobileColors.textPrimary,
    backgroundColor: mobileColors.surface
  },
  coords: {
    fontSize: mobileFontSize.xs,
    color: mobileColors.textSecondary
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border
  },
  rowTx: {
    flex: 1,
    fontSize: mobileFontSize.md,
    color: mobileColors.textPrimary,
    fontWeight: "600"
  },
  clear: { alignSelf: "flex-start", paddingVertical: 6 },
  clearTx: {
    fontSize: mobileFontSize.sm,
    color: mobileColors.textSecondary,
    textDecorationLine: "underline"
  }
});
