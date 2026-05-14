import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { FarmMemberDto } from "../../lib/api";
import { ROLE_BADGE_COLOR, ROLE_DISPLAY_FR } from "../../lib/memberPermissions";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { MemberAvatar } from "./MemberAvatar";

type Props = {
  member: FarmMemberDto;
  onPress: () => void;
};

export function MemberCard({ member, onPress }: Props) {
  const badgeColor = ROLE_BADGE_COLOR[member.role] ?? mobileColors.textSecondary;
  const roleLabel = ROLE_DISPLAY_FR[member.role] ?? member.role;
  const displayName =
    member.user.fullName?.trim() || member.user.email || "—";

  return (
    <Pressable onPress={onPress} style={styles.card} accessibilityRole="button">
      <MemberAvatar name={displayName} size={44} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {displayName}
        </Text>
        {member.user.email ? (
          <Text style={styles.email} numberOfLines={1}>
            {member.user.email}
          </Text>
        ) : null}
      </View>
      <View style={styles.rightCol}>
        <View style={[styles.badge, { backgroundColor: `${badgeColor}18` }]}>
          <Text style={[styles.badgeTxt, { color: badgeColor }]}>
            {roleLabel}
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={mobileColors.textSecondary}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    padding: mobileSpacing.md,
    gap: mobileSpacing.md
  },
  info: {
    flex: 1,
    gap: 2
  },
  name: {
    ...mobileTypography.body,
    fontWeight: "600",
    color: mobileColors.textPrimary
  },
  email: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  rightCol: {
    alignItems: "flex-end",
    gap: mobileSpacing.xs
  },
  badge: {
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 3,
    borderRadius: mobileRadius.pill
  },
  badgeTxt: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3
  }
});
