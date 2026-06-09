import { StyleSheet, Text, View } from "react-native";
import type { ProfileType } from "@fermier/types";
import { mobileTypography } from "../../theme/mobileTheme";

const BADGE_META: Record<
  ProfileType,
  { emoji: string; label: string; color: string }
> = {
  producer: { emoji: "🌾", label: "Éleveur", color: "#1D9E75" },
  veterinarian: { emoji: "🩺", label: "Vétérinaire", color: "#4A90D9" },
  technician: { emoji: "🔧", label: "Technicien", color: "#7C3AED" },
  buyer: { emoji: "🛒", label: "Acheteur", color: "#FF8C00" }
};

type Props = {
  profileType: ProfileType;
  anonymous?: boolean;
};

export function ProfileBadge({ profileType, anonymous }: Props) {
  if (anonymous) {
    return null;
  }
  const meta = BADGE_META[profileType];
  return (
    <View style={[styles.badge, { borderColor: meta.color }]}>
      <Text style={[styles.text, { color: meta.color }]}>
        {meta.emoji} {meta.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: "flex-start"
  },
  text: {
    ...mobileTypography.meta,
    fontSize: 11,
    fontWeight: "600"
  }
});
