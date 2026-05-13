import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import MapView, { Marker, type LatLng } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

const DEFAULT_FR: LatLng = { latitude: 46.603354, longitude: 1.888334 };

type FarmMapPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  initialLat: number | null;
  initialLng: number | null;
  onConfirm: (lat: number, lng: number) => void;
};

function isValidCoord(lat: number | null, lng: number | null): boolean {
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

export function FarmMapPickerModal({
  visible,
  onClose,
  initialLat,
  initialLng,
  onConfirm
}: FarmMapPickerModalProps) {
  const { t } = useTranslation();
  const [marker, setMarker] = useState<LatLng>(DEFAULT_FR);
  const [mapResetKey, setMapResetKey] = useState(0);

  const hasInitial = useMemo(
    () => isValidCoord(initialLat, initialLng),
    [initialLat, initialLng]
  );

  const initialRegion = useMemo(() => {
    const lat = hasInitial ? initialLat! : DEFAULT_FR.latitude;
    const lng = hasInitial ? initialLng! : DEFAULT_FR.longitude;
    const d = hasInitial ? 0.06 : 9;
    return {
      latitude: lat,
      longitude: lng,
      latitudeDelta: d,
      longitudeDelta: d
    };
  }, [hasInitial, initialLat, initialLng]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setMapResetKey((k) => k + 1);
    if (hasInitial) {
      setMarker({ latitude: initialLat!, longitude: initialLng! });
    } else {
      setMarker(DEFAULT_FR);
    }
  }, [visible, hasInitial, initialLat, initialLng]);

  const handleConfirm = useCallback(() => {
    onConfirm(marker.latitude, marker.longitude);
  }, [marker.latitude, marker.longitude, onConfirm]);

  if (Platform.OS === "web") {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.toolbar}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("producer.mapPickerCancel")}
            style={styles.toolbarBtn}
          >
            <Text style={styles.toolbarBtnText}>
              {t("producer.mapPickerCancel")}
            </Text>
          </Pressable>
          <Text style={styles.toolbarTitle} numberOfLines={1}>
            {t("producer.mapPickerTitle")}
          </Text>
          <Pressable
            onPress={handleConfirm}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("producer.mapPickerConfirm")}
            style={styles.toolbarBtn}
          >
            <Text style={styles.toolbarConfirm}>
              {t("producer.mapPickerConfirm")}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>{t("producer.mapPickerHint")}</Text>

        <View style={styles.mapWrap}>
          <MapView
            key={mapResetKey}
            style={StyleSheet.absoluteFill}
            initialRegion={initialRegion}
            onPress={(e) => setMarker(e.nativeEvent.coordinate)}
            mapType="standard"
            showsCompass
            toolbarEnabled={false}
          >
            <Marker
              coordinate={marker}
              draggable
              onDragEnd={(e) => setMarker(e.nativeEvent.coordinate)}
            />
          </MapView>
        </View>

        <View style={styles.coordBar}>
          <Ionicons
            name="pin"
            size={18}
            color={mobileColors.accent}
            style={styles.coordIcon}
          />
          <Text style={styles.coordText} numberOfLines={1}>
            {marker.latitude.toFixed(5)}, {marker.longitude.toFixed(5)}
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: mobileColors.background
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border
  },
  toolbarBtn: {
    minWidth: 88,
    paddingVertical: 6
  },
  toolbarBtnText: {
    ...mobileTypography.body,
    fontSize: 16,
    color: mobileColors.textSecondary
  },
  toolbarTitle: {
    ...mobileTypography.body,
    flex: 1,
    textAlign: "center",
    fontWeight: "600",
    fontSize: 16,
    color: mobileColors.textPrimary,
    marginHorizontal: mobileSpacing.sm
  },
  toolbarConfirm: {
    ...mobileTypography.body,
    fontSize: 16,
    fontWeight: "600",
    color: mobileColors.accent,
    textAlign: "right"
  },
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.sm
  },
  mapWrap: {
    flex: 1,
    marginHorizontal: mobileSpacing.lg,
    marginBottom: mobileSpacing.sm,
    borderRadius: mobileRadius.lg,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  coordBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: mobileSpacing.lg,
    marginBottom: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.md,
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.md
  },
  coordIcon: {
    marginRight: mobileSpacing.sm
  },
  coordText: {
    ...mobileTypography.body,
    flex: 1,
    fontSize: 15,
    color: mobileColors.textPrimary
  }
});
