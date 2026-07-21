import { StyleSheet, Text, View } from "react-native";
import { mobileFontSize, mobileRadius, mobileSpacing } from "../../theme/mobileTheme";

type Props = {
  label: string;
  backgroundColor: string;
  color: string;
};

/** Pastille de statut réutilisable (évite les `badge` / `pill` locaux). */
export function StatusBadge({ label, backgroundColor, color }: Props) {
  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <Text style={[styles.tx, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 4,
    borderRadius: mobileRadius.sm
  },
  tx: {
    fontSize: mobileFontSize.xs,
    fontWeight: "700"
  }
});
