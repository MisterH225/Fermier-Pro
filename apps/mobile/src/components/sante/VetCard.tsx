import { Pressable, StyleSheet, Text, View } from "react-native";
import type { VetSearchItemDto } from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  vet: VetSearchItemDto;
  onPress: () => void;
};

export function VetCard({ vet, onPress }: Props) {
  const stars =
    vet.ratingAvg != null
      ? `${vet.ratingAvg.toFixed(1)} ★ (${vet.ratingCount})`
      : "—";

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.avatar}>
        <Text style={styles.avatarTx}>
          {vet.profilePhotoUrl ? "🩺" : vet.fullName.slice(0, 1).toUpperCase()}
        </Text>
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name}>{vet.fullName}</Text>
          {vet.isVerified ? (
            <Text style={styles.verified}>✅</Text>
          ) : null}
        </View>
        <Text style={styles.meta}>{vet.primarySpecialty}</Text>
        <Text style={styles.meta}>
          📍 {vet.locationLabel}
          {vet.distanceKm != null ? ` · ${vet.distanceKm} km` : ""}
        </Text>
        <Text style={styles.meta}>{stars}</Text>
        <Text
          style={[
            styles.badge,
            vet.availability ? styles.badgeOk : styles.badgeBusy
          ]}
        >
          {vet.availability ? "Disponible" : "Occupé"}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: mobileSpacing.md,
    backgroundColor: mobileColors.background,
    borderRadius: 16,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.sm,
    ...mobileShadows.card
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: `${mobileColors.accent}18`,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarTx: { fontSize: 22, fontWeight: "700", color: mobileColors.accent },
  body: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: {
    ...mobileTypography.cardTitle,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    flex: 1
  },
  verified: { fontSize: 14 },
  meta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  badge: {
    marginTop: mobileSpacing.xs,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: mobileRadius.pill,
    fontSize: 11,
    fontWeight: "700",
    overflow: "hidden"
  },
  badgeOk: { backgroundColor: "#ECFDF5", color: "#059669" },
  badgeBusy: { backgroundColor: "#FEF2F2", color: "#DC2626" }
});
