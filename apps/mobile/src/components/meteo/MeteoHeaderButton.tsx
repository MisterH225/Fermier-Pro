import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { useMeteoScore } from "../../hooks/useMeteoScore";
import { mobileSpacing } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";
import {
  profileHasMeteoScore,
  resolveMeteoHeaderPresentation,
  type MeteoProfileType
} from "./meteoHeaderModel";

type Props = {
  /** Profil actif — détermine si un score existe (v1 = producteur seulement). */
  profileType: MeteoProfileType;
  iconColor?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Icône météo de confiance dans le header — calquée sur NotificationsHeaderButton.
 * Tap → écran de détail ProducerScoreDashboard (même destination que l'ancienne carte).
 */
export function MeteoHeaderButton({
  profileType,
  iconColor,
  style
}: Props) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const scoreQ = useMeteoScore(profileType);

  if (!profileHasMeteoScore(profileType)) {
    return null;
  }

  const presentation = resolveMeteoHeaderPresentation({
    score: scoreQ.data?.numericScore,
    isNew: scoreQ.data?.isNew,
    apiLabel: scoreQ.data?.apiLabel
  });

  const tint = presentation.isNew
    ? presentation.tint
    : iconColor ?? presentation.tint;

  return (
    <Pressable
      onPress={() => navigation.navigate("ProducerScoreDashboard")}
      style={({ pressed }) => [styles.btn, style, pressed && { opacity: 0.85 }]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={presentation.accessibilityLabel}
      testID="meteo-header-button"
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: `${presentation.tint}33` }
        ]}
      >
        <Text style={[styles.icon, { color: tint }]}>{presentation.icon}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    padding: mobileSpacing.sm
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  icon: {
    fontSize: 18,
    lineHeight: 22
  }
});
