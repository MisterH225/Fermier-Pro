import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { vetColors, vetRadius, vetShadow } from "../../theme/vetTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

export type FarmCardBadge = "alert" | "visit" | "ok" | null;

type FarmCardProps = {
  farmName: string;
  producerName: string | null;
  location: string | null;
  badge?: FarmCardBadge;
  onPress?: () => void;
  onMessage?: () => void;
  onCall?: () => void;
};

function badgeLabel(badge: FarmCardBadge): string | null {
  if (badge === "alert") return "🔴 Alerte";
  if (badge === "visit") return "🗓️ RDV";
  if (badge === "ok") return "✅ À jour";
  return null;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function FarmCard({
  farmName,
  producerName,
  location,
  badge,
  onPress,
  onMessage,
  onCall
}: FarmCardProps) {
  const badgeTx = badgeLabel(badge ?? null);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, vetShadow.card, pressed && { opacity: 0.92 }]}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarTx}>{initials(farmName)}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.farm} numberOfLines={1}>
            {farmName}
          </Text>
          {badgeTx ? <Text style={styles.badge}>{badgeTx}</Text> : null}
        </View>
        {producerName ? (
          <Text style={styles.sub} numberOfLines={1}>
            {producerName}
          </Text>
        ) : null}
        {location ? (
          <Text style={styles.sub} numberOfLines={1}>
            📍 {location}
          </Text>
        ) : null}
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.actionBtn} onPress={onMessage}>
          <Ionicons name="chatbubble-outline" size={18} color={vetColors.primary} />
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={onCall}>
          <Ionicons name="call-outline" size={18} color={vetColors.primary} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: vetColors.cardBg,
    borderRadius: vetRadius.card,
    padding: mobileSpacing.md,
    gap: mobileSpacing.md,
    borderWidth: 1,
    borderColor: vetColors.border
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: vetColors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarTx: {
    fontWeight: "800",
    fontSize: 16,
    color: vetColors.primary
  },
  body: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  farm: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: vetColors.textPrimary,
    flex: 1
  },
  badge: { fontSize: 11, color: vetColors.textSecondary },
  sub: {
    ...mobileTypography.meta,
    color: vetColors.textSecondary
  },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: vetColors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  }
});
