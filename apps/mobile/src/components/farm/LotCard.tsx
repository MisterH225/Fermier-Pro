import { StyleSheet, Text, View } from "react-native";
import { Card } from "../ui/Card";
import { Tag } from "../ui/Tag";
import { mobileColors, mobileTypography } from "../../theme/mobileTheme";

type LotStatus = "En croissance" | "En finition" | "À surveiller";

type LotCardProps = {
  lotName: string;
  stage: string;
  headCount: number;
  mortality7d: number;
  status: LotStatus;
  onPress?: () => void;
};

function toneFromStatus(status: LotStatus): "success" | "warning" | "danger" {
  if (status === "En croissance") return "success";
  if (status === "En finition") return "warning";
  return "danger";
}

export function LotCard({
  lotName,
  stage,
  headCount,
  mortality7d,
  status,
  onPress
}: LotCardProps) {
  return (
    <Card onPress={onPress}>
      <View style={styles.top}>
        <View style={styles.textWrap}>
          <Text style={styles.title}>{lotName}</Text>
          <Text style={styles.meta}>{stage}</Text>
        </View>
        <Tag label={status} tone={toneFromStatus(status)} />
      </View>
      <View style={styles.metrics}>
        <Text style={styles.metric}>{headCount} porcs</Text>
        <Text style={styles.metric}>Mortalité 7j: {mortality7d}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10
  },
  textWrap: {
    flex: 1,
    paddingRight: 8
  },
  title: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    marginBottom: 2
  },
  meta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  metrics: {
    flexDirection: "row",
    gap: 16
  },
  metric: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary
  }
});
