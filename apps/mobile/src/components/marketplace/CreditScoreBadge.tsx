import { StyleSheet, Text, View } from "react-native";
import type { BuyerCreditScoreDto } from "../../lib/api";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type Props = {
  score: BuyerCreditScoreDto | null | undefined;
  prefix?: string;
};

export function CreditScoreBadge({ score, prefix }: Props) {
  if (!score) {
    return null;
  }
  return (
    <View
      style={[styles.wrap, { borderColor: score.color + "55", backgroundColor: score.color + "18" }]}
      accessibilityRole="text"
      accessibilityLabel={`${prefix ?? ""} ${score.label}`}
    >
      <Text style={styles.prefix}>{prefix ?? ""}</Text>
      <Text style={[styles.text, { color: score.color }]}>
        {score.emoji} {score.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: mobileSpacing.xs,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: mobileRadius.md ?? 12,
    borderWidth: StyleSheet.hairlineWidth
  },
  prefix: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: mobileColors.textSecondary
  },
  text: {
    ...mobileTypography.meta,
    fontWeight: "700"
  }
});
