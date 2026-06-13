import { StyleSheet, Text, View } from "react-native";
import type { ProducerScoreDto, ReliabilityScoreBadgeDto } from "../../lib/api";
import { mobileColors, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type Props = {
  score: ReliabilityScoreBadgeDto | null | undefined;
  prefix?: string;
};

export function ReliabilityScoreBadge({ score, prefix }: Props) {
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

export function ProducerScoreBadge({
  score,
  prefix
}: {
  score: ProducerScoreDto | null | undefined;
  prefix?: string;
}) {
  return <ReliabilityScoreBadge score={score} prefix={prefix} />;
}

const styles = StyleSheet.create({
  wrap: { marginTop: mobileSpacing.xs },
  text: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  }
});
