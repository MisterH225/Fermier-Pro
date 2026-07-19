import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { techColors } from "../../theme/technicianTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type TechWelcomeHeaderProps = {
  welcomeLabel: string;
  displayName: string;
  avatarUrl: string | null;
  onPressAvatar: () => void;
};

export function TechWelcomeHeader({
  welcomeLabel,
  displayName,
  avatarUrl,
  onPressAvatar
}: TechWelcomeHeaderProps) {
  return (
    <TouchableOpacity
      style={styles.cluster}
      onPress={onPressAvatar}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={welcomeLabel}
    >
      {avatarUrl ? (
        <Image
          key={avatarUrl}
          source={{ uri: avatarUrl }}
          style={styles.avatar}
        />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Ionicons name="construct" size={26} color={techColors.primary} />
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
    minHeight: 48,
    minWidth: 0,
    paddingVertical: 4,
    marginRight: mobileSpacing.sm
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: techColors.primaryLight
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: techColors.border
  },
  textCol: { marginLeft: mobileSpacing.md, flexShrink: 1 },
  welcome: {
    ...mobileTypography.meta,
    fontSize: 12,
    color: techColors.textSecondary
  },
  name: {
    ...mobileTypography.title,
    fontSize: 18,
    fontWeight: "700",
    color: techColors.textPrimary,
    flexShrink: 1
  }
});
