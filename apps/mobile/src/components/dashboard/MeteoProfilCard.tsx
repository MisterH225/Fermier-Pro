import { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { MeteoProgressBar } from "../common/MeteoProgressBar";
import {
  getMeteoLevel,
  getMeteoProgress
} from "../../constants/meteoProfil";

type Props = {
  /** Score 0–100 (globalValue du profil) */
  score: number | null | undefined;
  /** Navigue vers l'écran de détail des critères */
  onPress?: () => void;
};

/**
 * Carte "Ma météo du moment" — remplace les anciens XxxScoreCard.
 * Affiche le niveau météo actuel, un message motivant, une barre de
 * progression dans le niveau, et l'incitation vers le niveau suivant.
 *
 * Règles absolues :
 * - Zéro mention du mot "score" dans l'UI
 * - Zéro chiffre /100 affiché
 * - Niveau actuel + prochain toujours visibles
 * - onPress préservé (navigue vers détail)
 */
export function MeteoProfilCard({ score, onPress }: Props) {
  const level = getMeteoLevel(score);
  const progress = getMeteoProgress(score);

  // Animation douce de l'icône — pulse léger (scale 1→1.18→1, loop)
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.18,
          duration: 1200,
          useNativeDriver: true
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true
        })
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: level.card_bg, opacity: pressed ? 0.92 : 1 }
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Ma météo du moment : ${level.label}. ${level.message}`}
    >
      {/* Ligne 1 : titre + CTA */}
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: level.card_text }]}>
          Ma météo du moment
        </Text>
        <Text style={[styles.cta, { color: level.card_text }]}>
          Voir ma progression →
        </Text>
      </View>

      {/* Ligne 2 : icône animée + niveau actuel */}
      <View style={styles.levelRow}>
        <Animated.Text
          style={[styles.icon, { transform: [{ scale: pulseAnim }] }]}
        >
          {level.icon}
        </Animated.Text>
        <Text style={[styles.levelLabel, { color: level.card_text }]}>
          {level.label}
        </Text>
      </View>

      {/* Ligne 3 : message motivant */}
      <Text style={[styles.message, { color: level.card_text }]}>
        {level.message}
      </Text>

      {/* Ligne 4 : barre de progression dans le niveau actuel */}
      <View style={styles.progressWrap}>
        <MeteoProgressBar progress={progress} />
      </View>

      {/* Ligne 5 : prochain niveau (si pas au maximum) */}
      {level.next_label ? (
        <Text
          style={[
            styles.nextLevel,
            { color: level.card_text, opacity: 0.75 }
          ]}
        >
          {level.next_label}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 10,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
    opacity: 0.9
  },
  cta: {
    fontSize: 11,
    fontWeight: "700",
    opacity: 0.9
  },
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  icon: {
    fontSize: 40,
    lineHeight: 48
  },
  levelLabel: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
    flexShrink: 1
  },
  message: {
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
    opacity: 0.95
  },
  progressWrap: {
    marginTop: 2
  },
  nextLevel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2
  }
});
