import { Ionicons } from "@expo/vector-icons";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import type { DirectoryProfileMetaTile } from "../../lib/directoryCardModel";
import { mobileColors, mobileRadius, mobileShadows, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { producerColors } from "../../theme/producerTheme";

export type { DirectoryProfileMetaTile };

export type DirectoryProfileCardProps = {
  name: string;
  title: string;
  photoUrl?: string | null;
  available: boolean;
  availableLabel: string;
  unavailableLabel: string;
  /** Ex. "4,85 (12 avis)" — omit si aucune note. */
  ratingLabel?: string | null;
  distanceLabel?: string | null;
  /** Ligne secondaire sous les notes (formation, service, etc.). */
  highlightLabel?: string | null;
  highlightIcon?: keyof typeof Ionicons.glyphMap;
  locationLabel?: string | null;
  metaTiles?: DirectoryProfileMetaTile[];
  verified?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Carte annuaire (technicien / vétérinaire) — photo carrée, notes,
 * barre localité et tuiles méta (expérience, formation, salaire…).
 */
export function DirectoryProfileCard({
  name,
  title,
  photoUrl,
  available,
  availableLabel,
  unavailableLabel,
  ratingLabel,
  distanceLabel,
  highlightLabel,
  highlightIcon = "school-outline",
  locationLabel,
  metaTiles = [],
  verified = false,
  onPress,
  style
}: DirectoryProfileCardProps) {
  const initials = initialsFromName(name);
  const ratingLine = [ratingLabel, distanceLabel].filter(Boolean).join("  ·  ");

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={name}
    >
      <View style={styles.topRow}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.photo} />
        ) : (
          <View style={styles.photoPh}>
            <Text style={styles.photoTx}>{initials || "?"}</Text>
          </View>
        )}

        <View style={styles.infoCol}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                available ? styles.statusDotOn : styles.statusDotOff
              ]}
            />
            <Text
              style={[
                styles.statusTx,
                available ? styles.statusTxOn : styles.statusTxOff
              ]}
              numberOfLines={1}
            >
              {available ? availableLabel : unavailableLabel}
            </Text>
            {verified ? (
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={mobileColors.accent}
                style={styles.verifiedIcon}
              />
            ) : null}
          </View>

          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {title ? (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          ) : null}

          {ratingLine ? (
            <View style={styles.ratingRow}>
              {ratingLabel ? (
                <Ionicons name="star" size={13} color={producerColors.warning} />
              ) : null}
              <Text style={styles.ratingTx} numberOfLines={1}>
                {ratingLine}
              </Text>
            </View>
          ) : null}

          {highlightLabel ? (
            <View style={styles.highlightRow}>
              <Ionicons
                name={highlightIcon}
                size={14}
                color={mobileColors.accent}
              />
              <Text style={styles.highlightTx} numberOfLines={1}>
                {highlightLabel}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {locationLabel ? (
        <View style={styles.locationBar}>
          <Ionicons
            name="location-outline"
            size={16}
            color={mobileColors.textSecondary}
          />
          <Text style={styles.locationTx} numberOfLines={1}>
            {locationLabel}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={mobileColors.textSecondary}
          />
        </View>
      ) : null}

      {metaTiles.length > 0 ? (
        <View style={styles.tilesRow}>
          {metaTiles.map((tile) => (
            <View key={`${tile.label}-${tile.value}`} style={styles.tile}>
              <Text style={styles.tileLabel} numberOfLines={1}>
                {tile.label}
              </Text>
              <Text style={styles.tileValue} numberOfLines={1}>
                {tile.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const PHOTO = 72;

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.sm,
    gap: mobileSpacing.md,
    ...mobileShadows.card
  },
  cardPressed: { opacity: 0.92 },
  topRow: {
    flexDirection: "row",
    gap: mobileSpacing.md,
    alignItems: "flex-start"
  },
  photo: {
    width: PHOTO,
    height: PHOTO,
    borderRadius: mobileRadius.lg,
    backgroundColor: mobileColors.surfaceMuted
  },
  photoPh: {
    width: PHOTO,
    height: PHOTO,
    borderRadius: mobileRadius.lg,
    backgroundColor: mobileColors.accentSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  photoTx: {
    fontSize: mobileFontSize.xl,
    fontWeight: "800",
    color: mobileColors.accent
  },
  infoCol: { flex: 1, minWidth: 0, gap: 2 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: mobileRadius.sm
  },
  statusDotOn: { backgroundColor: mobileColors.success },
  statusDotOff: { backgroundColor: mobileColors.textSecondary },
  statusTx: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.sm,
    fontWeight: "600",
    flexShrink: 1
  },
  statusTxOn: { color: mobileColors.success },
  statusTxOff: { color: mobileColors.textSecondary },
  verifiedIcon: { marginLeft: "auto" },
  name: {
    ...mobileTypography.cardTitle,
    fontSize: mobileFontSize.lg,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  title: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontSize: mobileFontSize.sm
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4
  },
  ratingTx: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.sm,
    color: mobileColors.textPrimary,
    fontWeight: "600",
    flexShrink: 1
  },
  highlightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4
  },
  highlightTx: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.sm,
    color: mobileColors.accent,
    fontWeight: "600",
    flexShrink: 1
  },
  locationBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 10
  },
  locationTx: {
    ...mobileTypography.meta,
    flex: 1,
    color: mobileColors.textPrimary,
    fontSize: mobileFontSize.sm
  },
  tilesRow: {
    flexDirection: "row",
    gap: mobileSpacing.sm
  },
  tile: {
    flex: 1,
    minWidth: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: mobileColors.background,
    alignItems: "center",
    gap: 2
  },
  tileLabel: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.xs,
    color: mobileColors.textSecondary
  },
  tileValue: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.sm,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    textAlign: "center"
  }
});
