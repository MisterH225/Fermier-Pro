import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { useMeteoScore } from "../../hooks/useMeteoScore";
import { useTrustScore } from "../../hooks/useTrustScore";
import { mobileSpacing, mobileRadius, mobileFontSize } from "../../theme/mobileTheme";
import type { TrustScoreProfileType } from "../../lib/api/trustScore";
import {
  profileHasMeteoScore,
  resolveMeteoHeaderPresentation,
  type MeteoProfileType
} from "./meteoHeaderModel";
import { TrustMeteoSheet } from "./TrustMeteoSheet";

type Props = {
  /** Profil actif — détermine si un score existe. */
  profileType: MeteoProfileType;
  iconColor?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Icône météo de confiance dans le header.
 * Tap → TrustMeteoSheet (ombre v2 possible même si header reste sur v1).
 */
export function MeteoHeaderButton({
  profileType,
  iconColor,
  style
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const scoreQ = useMeteoScore(profileType);
  const trustQ = useTrustScore({
    profileType: profileType as TrustScoreProfileType,
    visibility: "self",
    enabled: sheetOpen
  });

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
    <>
      <Pressable
        onPress={() => setSheetOpen(true)}
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
      <TrustMeteoSheet
        visible={sheetOpen}
        trust={trustQ.data}
        loading={trustQ.isPending || trustQ.isFetching}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    padding: mobileSpacing.sm
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: mobileRadius.lg,
    alignItems: "center",
    justifyContent: "center"
  },
  icon: {
    fontSize: mobileFontSize.lg,
    lineHeight: 22
  }
});
