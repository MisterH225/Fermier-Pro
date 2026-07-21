import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { buyerColors } from "../../theme/buyerTheme";
import { mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";

type BuyerWelcomeHeaderProps = {
  welcomeLabel: string;
  displayName: string;
  avatarUrl: string | null;
  onPressAvatar: () => void;
};

export function BuyerWelcomeHeader({
  welcomeLabel,
  displayName,
  avatarUrl,
  onPressAvatar
}: BuyerWelcomeHeaderProps) {
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
          <Ionicons name="cart" size={26} color={buyerColors.primary} />
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
    backgroundColor: buyerColors.primaryLight
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: buyerColors.border
  },
  textCol: { marginLeft: mobileSpacing.md, flexShrink: 1 },
  welcome: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.sm,
    color: buyerColors.textSecondary
  },
  name: {
    ...mobileTypography.title,
    fontSize: mobileFontSize.lg,
    fontWeight: "700",
    color: buyerColors.textPrimary,
    flexShrink: 1
  }
});
