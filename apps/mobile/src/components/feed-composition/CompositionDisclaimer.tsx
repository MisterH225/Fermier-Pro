import { StyleSheet, Text, View } from "react-native";
import {
  mobileFontSize,
  mobileRadius,
  mobileSpacing,
  mobileStatusSurfaces
} from "../../theme/mobileTheme";

type Props = {
  compact?: boolean;
};

/** Disclaimer permanent — formulation indicative. */
export function CompositionDisclaimer({ compact = false }: Props) {
  return (
    <View
      style={[styles.box, compact && styles.boxCompact]}
      testID="composition-disclaimer"
      accessibilityRole="text"
    >
      <Text style={styles.text}>
        Formulation indicative — validez avec votre vétérinaire ou technicien
        avant utilisation.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: mobileStatusSurfaces.warningBg,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: "#F5D78E",
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm
  },
  boxCompact: {
    paddingVertical: mobileSpacing.xs
  },
  text: {
    color: mobileStatusSurfaces.warningText,
    fontSize: mobileFontSize.sm,
    lineHeight: 20,
    fontWeight: "600",
    textAlign: "center"
  }
});
