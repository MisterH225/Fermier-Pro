import { StyleSheet, Text, View } from "react-native";
import { Card } from "../ui/Card";
import { mobileColors, mobileTypography } from "../../theme/mobileTheme";

type EventCardProps = {
  title: string;
  subtitle: string;
  timestamp: string;
};

export function EventCard({ title, subtitle, timestamp }: EventCardProps) {
  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <Text style={styles.time}>{timestamp}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  left: {
    flex: 1
  },
  title: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary
  },
  subtitle: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary
  },
  time: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  }
});
