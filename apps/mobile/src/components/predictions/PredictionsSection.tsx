import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { usePredictions } from "../../hooks/usePredictions";
import type { PredictionMenuKey } from "../../lib/api/predictions";
import { ScreenSection } from "../layout/ScreenSection";
import { mobileColors, mobileSpacing, mobileTypography, mobileRadius } from "../../theme/mobileTheme";
import { AlerteTresorerieCard } from "./AlerteTresorerieCard";
import { AnimauxPretsCard } from "./AnimauxPretsCard";
import { BesoinsAlimentCard } from "./BesoinsAlimentCard";
import { CommandeRecommandeeCard } from "./CommandeRecommandeeCard";
import { EvolutionCheptelCard } from "./EvolutionCheptelCard";
import { InsufficientDataCard } from "./InsufficientDataCard";
import { MeilleureVenteCard } from "./MeilleureVenteCard";
import { NaissancesPrevuesCard } from "./NaissancesPrevuesCard";
import { PredictiveAlertsCard } from "./PredictiveAlertsCard";
import { PredictiveSummaryCard } from "./PredictiveSummaryCard";
import { ProjectionDepensesCard } from "./ProjectionDepensesCard";
import { ProjectionPoidsCard } from "./ProjectionPoidsCard";
import { RentabilitePrevuCard } from "./RentabilitePrevuCard";
import { RevenusEstimesCard } from "./RevenusEstimesCard";
import { SailliesRecommandeesCard } from "./SailliesRecommandeesCard";
import { formatGeneratedAt, getPredictionPricePerKg } from "./predictionFormatters";

type PredictionsControl = ReturnType<typeof usePredictions>;

type Props = {
  farmId: string;
  menu: PredictionMenuKey;
  accessToken: string;
  activeProfileId?: string | null;
  title: string;
  farmName?: string;
  onStockOrderPress?: (feedTypeId: string, quantityKg: number) => void;
  /** Évite un second fetch quand les prévisions sont partagées avec un bloc recommandations. */
  predictionsControl?: PredictionsControl;
};

export function PredictionsSection({
  farmId,
  menu,
  accessToken,
  activeProfileId,
  title,
  farmName = "",
  onStockOrderPress,
  predictionsControl
}: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";
  const internal = usePredictions({
    farmId,
    menu,
    accessToken,
    activeProfileId,
    enabled: !predictionsControl
  });
  const { data, refreshing, refresh } = predictionsControl ?? internal;

  const generatedLabel = data?.generated_at
    ? t("predictions.generatedAt", {
        datetime: formatGeneratedAt(data.generated_at, locale) ?? ""
      })
    : null;

  const headerRight = (
    <Pressable
      onPress={refresh}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t("predictions.refresh")}
    >
      {refreshing ? (
        <ActivityIndicator size="small" color={mobileColors.accent} />
      ) : (
        <Ionicons name="refresh-outline" size={18} color={mobileColors.textSecondary} />
      )}
    </Pressable>
  );

  if (!data) {
    return null;
  }

  if (!data.sufficient_data) {
    return (
      <ScreenSection title={title} headerRight={headerRight}>
        <InsufficientDataCard data={data} />
      </ScreenSection>
    );
  }

  if (!data.predictions) {
    if (data.unavailable || data.gemini_error) {
      return (
        <ScreenSection title={title} headerRight={headerRight}>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {data.gemini_error ?? t("predictions.unavailable")}
            </Text>
          </View>
        </ScreenSection>
      );
    }
    return null;
  }

  const payload = data.predictions;
  const currency = data.currency ?? "XOF";
  const pricePerKg = getPredictionPricePerKg(payload);
  const cheptelPredictions = payload.cheptel_predictions;

  return (
    <ScreenSection title={title} headerRight={headerRight}>
      {generatedLabel ? (
        <Text style={styles.generated}>{generatedLabel}</Text>
      ) : null}
      <View style={styles.stack}>
        {menu === "cheptel" && cheptelPredictions ? (
          <>
            <AnimauxPretsCard
              payload={payload}
              currency={currency}
              locale={locale}
              pricePerKg={pricePerKg}
            />
            <ProjectionPoidsCard payload={payload} />
            <MeilleureVenteCard
              payload={payload}
              currency={currency}
              locale={locale}
            />
            <EvolutionCheptelCard payload={payload} />
          </>
        ) : null}
        {menu === "finance" ? (
          <>
            <RevenusEstimesCard
              payload={payload}
              currency={currency}
              locale={locale}
            />
            <ProjectionDepensesCard
              payload={payload}
              currency={currency}
              locale={locale}
            />
            <RentabilitePrevuCard
              payload={payload}
              currency={currency}
              locale={locale}
            />
            <AlerteTresorerieCard payload={payload} locale={locale} />
          </>
        ) : null}
        {menu === "stock" ? (
          <>
            <BesoinsAlimentCard payload={payload} locale={locale} />
            <CommandeRecommandeeCard
              payload={payload}
              locale={locale}
              onOrderPress={onStockOrderPress}
            />
          </>
        ) : null}
        {menu === "gestation" ? (
          <>
            <NaissancesPrevuesCard payload={payload} locale={locale} />
            <SailliesRecommandeesCard
              payload={payload}
              locale={locale}
              farmId={farmId}
              farmName={farmName}
            />
          </>
        ) : null}
        {menu === "summary" ? (
          <>
            <PredictiveSummaryCard
              payload={payload}
              currency={currency}
              locale={locale}
            />
            <PredictiveAlertsCard payload={payload} />
          </>
        ) : null}
      </View>
    </ScreenSection>
  );
}

const styles = StyleSheet.create({
  stack: { gap: mobileSpacing.md },
  generated: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.sm
  },
  errorBox: {
    padding: mobileSpacing.md,
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.sm
  },
  errorText: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  }
});
