import { StyleSheet, Text, View } from "react-native";
import type { BuyerCreditScoreDto } from "../../lib/api";
import { mobileColors, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type Props = {
  score: BuyerCreditScoreDto | null | undefined;
  prefix?: string;
};

export function CreditScoreBadge({ score, prefix }: Props) {
  if (!score) {
    return null;
  }
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>
        {prefix ? `${prefix} ` : ""}
        {score.emoji} {score.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: mobileSpacing.xs },
  text: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  }
});
