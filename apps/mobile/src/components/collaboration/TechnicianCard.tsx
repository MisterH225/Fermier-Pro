import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { TechnicianProfileDto } from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  tech: TechnicianProfileDto;
  onPress: () => void;
};

export function TechnicianCard({ tech, onPress }: Props) {
  const specs = tech.specializations.slice(0, 2);
  const extra = tech.specializations.length - specs.length;
  const name = tech.displayName ?? "Technicien";
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Pressable style={styles.card} onPress={onPress}>
      {tech.profilePhotoUrl ? (
        <Image source={{ uri: tech.profilePhotoUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPh}>
          <Text style={styles.avatarTx}>{initials}</Text>
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text
            style={[
              styles.badge,
              tech.isAvailable ? styles.badgeOk : styles.badgeOff
            ]}
          >
            {tech.isAvailable ? "✅ Dispo" : "Indispo"}
          </Text>
        </View>
        {tech.locationLabel ? (
          <Text style={styles.meta} numberOfLines={1}>
            📍 {tech.locationLabel}
          </Text>
        ) : null}
        <View style={styles.pills}>
          {specs.map((s) => (
            <View key={s} style={styles.pill}>
              <Text style={styles.pillTx} numberOfLines={1}>
                {s}
              </Text>
            </View>
          ))}
          {extra > 0 ? (
            <Text style={styles.morePill}>+{extra}</Text>
          ) : null}
        </View>
        <View style={styles.bottomRow}>
          <Text style={styles.formation}>
            🎓 {tech.formationTypeLabel ?? "—"}
          </Text>
          {tech.experienceYearsCount != null ? (
            <Text style={styles.exp}>{tech.experienceYearsCount} ans exp.</Text>
          ) : null}
        </View>
        {tech.pretensionSalarialeMensuelle != null ? (
          <Text style={styles.pretension}>
            {Math.round(tech.pretensionSalarialeMensuelle).toLocaleString(
              "fr-FR"
            )}{" "}
            {tech.pretensionCurrency}/mois
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: mobileSpacing.md,
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: 12,
    marginBottom: mobileSpacing.sm,
    ...mobileShadows.card
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPh: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: mobileColors.accentSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarTx: { fontWeight: "800", color: mobileColors.accent },
  body: { flex: 1, minWidth: 0 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  name: {
    ...mobileTypography.body,
    fontWeight: "700",
    fontSize: 15,
    flex: 1
  },
  badge: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: mobileRadius.pill
  },
  badgeOk: { backgroundColor: "#DCFCE7", color: "#166534" },
  badgeOff: { backgroundColor: "#F3F4F6", color: mobileColors.textSecondary },
  meta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  pill: {
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    maxWidth: 120
  },
  pillTx: { fontSize: 11, color: mobileColors.textSecondary },
  morePill: { fontSize: 11, color: mobileColors.textSecondary, alignSelf: "center" },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6
  },
  formation: { fontSize: 12, color: mobileColors.textSecondary },
  exp: { fontSize: 12, color: mobileColors.textSecondary },
  pretension: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.accent,
    marginTop: 4,
    textAlign: "right"
  }
});
