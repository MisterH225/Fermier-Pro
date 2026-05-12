import { Ionicons } from "@expo/vector-icons";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { mobileColors, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type ProducerWelcomeHeaderProps = {
  welcomeLabel: string;
  firstName: string;
  avatarUrl: string | null;
  onPressAvatar: () => void;
};

export function ProducerWelcomeHeader({
  welcomeLabel,
  firstName,
  avatarUrl,
  onPressAvatar
}: ProducerWelcomeHeaderProps) {
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
          <Ionicons name="person" size={26} color={mobileColors.textSecondary} />
        </View>
      )}
      <View style={styles.textCol}>
        <Text style={styles.welcome}>{welcomeLabel}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {firstName}
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
    paddingVertical: 4,
    marginRight: mobileSpacing.sm
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: mobileColors.surface
  },
  avatarPlaceholder: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  textCol: {
    marginLeft: mobileSpacing.md,
    flexShrink: 1
  },
  welcome: {
    ...mobileTypography.meta,
    fontSize: 12,
    color: mobileColors.textSecondary
  },
  name: {
    ...mobileTypography.cardTitle,
    fontSize: 18,
    color: mobileColors.textPrimary
  }
});
