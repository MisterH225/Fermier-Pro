import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { vetColors } from "../../theme/vetTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type VetWelcomeHeaderProps = {
  welcomeLabel: string;
  displayName: string;
  avatarUrl: string | null;
  verified?: boolean;
  onPressAvatar: () => void;
};

export function VetWelcomeHeader({
  welcomeLabel,
  displayName,
  avatarUrl,
  verified,
  onPressAvatar
}: VetWelcomeHeaderProps) {
  return (
    <TouchableOpacity
      style={styles.cluster}
      onPress={onPressAvatar}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={welcomeLabel}
    >
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Ionicons name="medkit" size={26} color={vetColors.primary} />
        </View>
      )}
      <View style={styles.textCol}>
        <Text style={styles.welcome}>{welcomeLabel}</Text>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          {verified ? (
            <Text style={styles.verifiedBadge} accessibilityLabel="Vérifié">
              ✅
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const AVATAR = 48;

const styles = StyleSheet.create({
  cluster: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minHeight: 48,
    minWidth: 0,
    paddingVertical: 4,
    marginRight: mobileSpacing.sm
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: vetColors.primaryLight
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: vetColors.border
  },
  textCol: { marginLeft: mobileSpacing.md, flexShrink: 1 },
  welcome: {
    ...mobileTypography.meta,
    fontSize: 12,
    color: vetColors.textSecondary
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  name: {
    ...mobileTypography.title,
    fontSize: 18,
    fontWeight: "700",
    color: vetColors.textPrimary,
    flexShrink: 1
  },
  verifiedBadge: { fontSize: 14 }
});
