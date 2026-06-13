import { StyleSheet, Text, View } from "react-native";
import type { FarmPredictionsPayload } from "../../lib/api/predictions";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  payload: FarmPredictionsPayload;
};

const PRIORITY_COLOR = {
  high: "#D64545",
  medium: "#BA7517",
  low: "#B4B2A9"
} as const;

export function PredictiveAlertsCard({ payload }: Props) {
  const alerts = [...payload.alerts]
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    })
    .slice(0, 3);

  if (!alerts.length) {
    return null;
  }

  return (
    <View style={styles.card}>
      {alerts.map((a, i) => (
        <View
          key={i}
          style={[styles.row, { borderLeftColor: PRIORITY_COLOR[a.priority] }]}
        >
          <Text style={styles.message}>{a.message}</Text>
          <Text style={styles.action}>{a.action_recommended}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: mobileSpacing.sm },
  row: {
    backgroundColor: mobileColors.surface,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    borderLeftWidth: 3,
    gap: 4
  },
  message: { ...mobileTypography.body, fontWeight: "600" },
  action: { ...mobileTypography.meta, color: mobileColors.textSecondary }
});
