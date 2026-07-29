import { Pressable, StyleSheet, Text, View } from "react-native";
import { mobileColors, mobileFontSize, mobileSpacing } from "../../theme/mobileTheme";

type Props = {
  /** Note affichée (1–5). */
  value: number;
  /** Si fourni, les étoiles sont sélectionnables. */
  onChange?: (value: number) => void;
  size?: number;
  /** Affichage lecture seule (défaut si pas de onChange). */
  readonly?: boolean;
};

/**
 * Étoiles 1–5 — affichage des avis réels uniquement (jamais pour le score composite).
 */
export function RatingStars({
  value,
  onChange,
  size = mobileFontSize.xxl,
  readonly
}: Props) {
  const interactive = Boolean(onChange) && readonly !== true;
  const clamped = Math.max(0, Math.min(5, Math.round(value)));

  return (
    <View style={styles.row} accessibilityRole={interactive ? undefined : "text"}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = clamped >= n;
        const star = (
          <Text
            style={[
              styles.star,
              { fontSize: size, color: filled ? mobileColors.warning : mobileColors.border }
            ]}
          >
            {filled ? "★" : "☆"}
          </Text>
        );
        if (!interactive) {
          return <View key={n}>{star}</View>;
        }
        return (
          <Pressable
            key={n}
            onPress={() => onChange?.(n)}
            accessibilityRole="button"
            accessibilityLabel={`${n}`}
            hitSlop={6}
          >
            {star}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.xs
  },
  star: {
    lineHeight: 32
  }
});
