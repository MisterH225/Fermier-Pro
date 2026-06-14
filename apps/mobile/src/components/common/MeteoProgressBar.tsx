import { StyleSheet, View } from "react-native";

type Props = {
  /** Remplissage 0–1 */
  progress: number;
  /** Couleur de la barre de progression (blanc semi-transparent par défaut) */
  color?: string;
  /** Couleur du fond de la barre */
  trackColor?: string;
  height?: number;
};

export function MeteoProgressBar({
  progress,
  color = "rgba(255,255,255,0.80)",
  trackColor = "rgba(255,255,255,0.25)",
  height = 6
}: Props) {
  const fill = Math.max(0, Math.min(1, progress));
  return (
    <View
      style={[styles.track, { backgroundColor: trackColor, height, borderRadius: height / 2 }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(fill * 100) }}
    >
      <View
        style={[
          styles.fill,
          {
            backgroundColor: color,
            width: `${fill * 100}%`,
            height,
            borderRadius: height / 2
          }
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    overflow: "hidden"
  },
  fill: {}
});
