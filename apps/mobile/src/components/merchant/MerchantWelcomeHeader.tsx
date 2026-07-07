import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { merchantColors } from "../../theme/merchantTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type Props = {
  welcomeLabel: string;
  displayName: string;
  avatarUrl?: string | null;
  onPressAvatar?: () => void;
};

export function MerchantWelcomeHeader({
  welcomeLabel,
  displayName,
  avatarUrl,
  onPressAvatar
}: Props) {
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
          <Ionicons name="storefront" size={26} color={merchantColors.primary} />
        </View>
      )}
      <View style={styles.textCol}>
        <Text style={styles.welcome}>{welcomeLabel}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {displayName}
        </Text>
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
    minWidth: 0,
    gap: mobileSpacing.md
  },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 },
  avatarPlaceholder: {
    backgroundColor: merchantColors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  textCol: { flex: 1, minWidth: 0 },
  welcome: { ...mobileTypography.meta, color: merchantColors.textSecondary },
  name: { fontSize: 20, fontWeight: "800", color: merchantColors.textPrimary }
});
