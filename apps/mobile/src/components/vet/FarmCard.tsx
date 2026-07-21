import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const badgeTx =
    badge === "alert"
      ? `🔴 ${t("vet.farms.badge.alert")}`
      : badge === "visit"
        ? `🗓️ ${t("vet.farms.badge.visit")}`
        : badge === "ok"
          ? `✅ ${t("vet.farms.badge.ok")}`
          : null;
  return (
    <Pressable
      style={[styles.card, vetShadow.card]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTx}>{initials(farmName)}</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {farmName}
          </Text>
          {producerName ? (
            <Text style={styles.meta} numberOfLines={1}>
              {producerName}
            </Text>
          ) : null}
          {location ? (
            <Text style={styles.meta} numberOfLines={1}>
              {location}
            </Text>
          ) : null}
        </View>
        {badgeTx ? (
          <View style={styles.badge}>
            <Text style={styles.badgeTx}>{badgeTx}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.actions}>
        {onMessage ? (
          <Pressable onPress={onMessage} hitSlop={8} accessibilityRole="button">
            <Ionicons name="chatbubble-outline" size={20} color={vetColors.primary} />
          </Pressable>
        ) : null}
        {onCall ? (
          <Pressable onPress={onCall} hitSlop={8} accessibilityRole="button">
            <Ionicons name="call-outline" size={20} color={vetColors.primary} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: vetColors.cardBg,
    borderRadius: vetRadius.card,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.sm,
    gap: mobileSpacing.sm
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: vetColors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarTx: {
    ...mobileTypography.cardTitle,
    color: vetColors.primary,
    fontWeight: "700"
  },
  body: { flex: 1, minWidth: 0 },
  name: {
    ...mobileTypography.cardTitle,
    color: vetColors.textPrimary,
    fontWeight: "700"
  },
  meta: {
    ...mobileTypography.meta,
    color: vetColors.textSecondary,
    marginTop: 2
  },
  badge: {
    backgroundColor: vetColors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999
  },
  badgeTx: { fontSize: 11, fontWeight: "700", color: vetColors.primary },
  actions: { flexDirection: "row", gap: 16, paddingLeft: 56 }
});
