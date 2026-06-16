import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { FarmPredictionsPayload } from "../../lib/api/predictions";
import type { RootStackParamList } from "../../types/navigation";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { formatPredictionDate } from "./predictionFormatters";

type Props = {
  payload: FarmPredictionsPayload;
  locale: string;
  farmId: string;
  farmName: string;
};

export function SailliesRecommandeesCard({
  payload,
  locale,
  farmId,
  farmName
}: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const gp = payload.gestation_predictions;
  if (!gp) return null;
  const sows = Array.isArray(gp.available_sows_for_mating) ? gp.available_sows_for_mating : [];

  if (!sows.length) {
    return null;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("predictions.sailliesRecommandeesTitle")}</Text>
      {sows.slice(0, 6).map((s) => (
        <Text key={s.sow_id} style={styles.line}>
          {t("predictions.sowAvailable", {
            sow: s.sow_number,
            date: formatPredictionDate(s.available_from, locale),
            reason: s.reason
          })}
        </Text>
      ))}
      <Pressable
        style={styles.cta}
        onPress={() =>
          navigation.navigate("FarmGestation", {
            farmId,
            farmName,
            initialTab: "planning"
          })
        }
      >
        <Text style={styles.ctaText}>{t("predictions.planMating")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileColors.surface,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.lg,
    gap: mobileSpacing.sm
  },
  title: { ...mobileTypography.cardTitle },
  line: { ...mobileTypography.body, color: mobileColors.textSecondary },
  cta: {
    marginTop: mobileSpacing.sm,
    backgroundColor: mobileColors.accent,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.md,
    alignItems: "center"
  },
  ctaText: { color: "#fff", fontWeight: "600" }
});
