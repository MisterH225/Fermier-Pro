import { StyleSheet, Text, View } from "react-native";
import type { ProfileType } from "@fermier/types";
import { mobileTypography, mobileKpiPalette, mobileRadius, mobileFontSize } from "../../theme/mobileTheme";
import { buyerColors } from "../../theme/buyerTheme";
import { uiNamedColors } from "../../theme/uiNamedColors";

const BADGE_META: Record<
  ProfileType,
  { emoji: string; label: string; color: string }
> = {
  producer: { emoji: "🌾", label: "Éleveur", color: uiNamedColors.c1D9E75 },
  veterinarian: { emoji: "🩺", label: "Vétérinaire", color: uiNamedColors.c4A90D9 },
  technician: { emoji: "🔧", label: "Technicien", color: buyerColors.primary },
  buyer: { emoji: "🛒", label: "Acheteur", color: mobileKpiPalette.gestation.accent },
  merchant: { emoji: "🏪", label: "Commerçant", color: uiNamedColors.cC2410C }
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
  if (!meta) {
    return null;
  }
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
    borderRadius: mobileRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: "flex-start"
  },
  text: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.xs,
    fontWeight: "600"
  }
});
