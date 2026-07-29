import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { limitFeatureLine } from "../../lib/subscriptionLimitsUi";
import { merchantColors, merchantRadius } from "../../theme/merchantTheme";
import { mobileColors, mobileFontSize, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { producerColors } from "../../theme/producerTheme";

export type PlanChoiceRole = "producer" | "merchant";

export type PlanChoiceLimits = {
  standardMaxFarms?: number | null;
  premiumMaxFarms?: number | null;
  standardMaxShops?: number | null;
  standardMaxProductsPerShop?: number | null;
  premiumMaxShops?: number | null;
  premiumMaxProductsPerShop?: number | null;
};

type Props = {
  role: PlanChoiceRole;
  limits: PlanChoiceLimits | null;
  loading?: boolean;
  busy?: boolean;
  onChooseStandard: () => void;
  onChoosePremium: () => void;
  onChooseLater: () => void;
};

export function PlanChoiceCards({
  role,
  limits,
  loading = false,
  busy = false,
  onChooseStandard,
  onChoosePremium,
  onChooseLater
}: Props) {
  const { t } = useTranslation();
  const accent = role === "merchant" ? merchantColors.primary : producerColors.primary;
  const accentSoft =
    role === "merchant" ? merchantColors.primaryLight : producerColors.primaryMuted;

  const standardFeatures =
    role === "producer"
      ? [
          limitFeatureLine(
            t,
            "subscriptionLimits.producer.farms",
            limits?.standardMaxFarms
          ),
          t("subscriptionLimits.producer.solo")
        ]
      : [
          limitFeatureLine(
            t,
            "subscriptionLimits.merchant.shops",
            limits?.standardMaxShops
          ),
          limitFeatureLine(
            t,
            "subscriptionLimits.merchant.products",
            limits?.standardMaxProductsPerShop
          )
        ];

  const premiumFeatures =
    role === "producer"
      ? [
          limitFeatureLine(
            t,
            "subscriptionLimits.producer.farms",
            limits?.premiumMaxFarms
          ),
          t("subscriptionLimits.producer.team"),
          t("subscriptionLimits.producer.invites")
        ]
      : [
          limitFeatureLine(
            t,
            "subscriptionLimits.merchant.shops",
            limits?.premiumMaxShops
          ),
          limitFeatureLine(
            t,
            "subscriptionLimits.merchant.products",
            limits?.premiumMaxProductsPerShop
          )
        ];

  if (loading) {
    return (
      <View style={styles.loadingWrap} testID="plan-choice-loading">
        <ActivityIndicator color={accent} />
      </View>
    );
  }

  return (
    <View style={styles.wrap} testID={`plan-choice-${role}`}>
      <Text style={styles.title}>{t("subscriptionLimits.planChoice.title")}</Text>
      <Text style={styles.subtitle}>
        {t("subscriptionLimits.planChoice.subtitle")}
      </Text>

      <View style={styles.row}>
        <Pressable
          style={[styles.card, { borderColor: accent }]}
          onPress={onChooseStandard}
          disabled={busy}
          testID="plan-choice-standard"
        >
          <Text style={[styles.badge, { backgroundColor: accentSoft, color: accent }]}>
            {t("subscriptionLimits.planChoice.defaultBadge")}
          </Text>
          <Text style={styles.cardTitle}>
            {t("subscriptionLimits.planChoice.standardTitle")}
          </Text>
          <Text style={[styles.price, { color: accent }]}>
            {t("subscriptionLimits.planChoice.standardPrice")}
          </Text>
          {standardFeatures.map((line) => (
            <View key={line} style={styles.featureRow}>
              <Ionicons name="checkmark" size={16} color={accent} />
              <Text style={styles.featureTx}>{line}</Text>
            </View>
          ))}
          <Text style={[styles.ctaInline, { color: accent }]}>
            {t("subscriptionLimits.planChoice.chooseStandard")}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.card, styles.cardPremium, { borderColor: accent }]}
          onPress={onChoosePremium}
          disabled={busy}
          testID="plan-choice-premium"
        >
          <Text style={styles.cardTitle}>
            {t("subscriptionLimits.planChoice.premiumTitle")}
          </Text>
          <Text style={[styles.price, { color: accent }]}>
            {t("subscriptionLimits.planChoice.premiumPriceHint")}
          </Text>
          {premiumFeatures.map((line) => (
            <View key={line} style={styles.featureRow}>
              <Ionicons name="checkmark" size={16} color={accent} />
              <Text style={styles.featureTx}>{line}</Text>
            </View>
          ))}
          <Text style={[styles.ctaInline, { color: accent }]}>
            {t("subscriptionLimits.planChoice.choosePremium")}
          </Text>
        </Pressable>
      </View>

      <Pressable
        style={styles.laterBtn}
        onPress={onChooseLater}
        disabled={busy}
        testID="plan-choice-later"
      >
        {busy ? (
          <ActivityIndicator color={mobileColors.textSecondary} />
        ) : (
          <Text style={styles.laterTx}>
            {t("subscriptionLimits.planChoice.chooseLater")}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.md },
  loadingWrap: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    ...mobileTypography.title,
    color: mobileColors.textPrimary,
    fontSize: mobileFontSize.xl
  },
  subtitle: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.sm
  },
  row: {
    flexDirection: "row",
    gap: mobileSpacing.sm
  },
  card: {
    flex: 1,
    backgroundColor: mobileColors.background,
    borderWidth: 1.5,
    borderRadius: merchantRadius.card,
    padding: mobileSpacing.md,
    gap: 6
  },
  cardPremium: {
    backgroundColor: mobileColors.canvas
  },
  badge: {
    alignSelf: "flex-start",
    fontSize: mobileFontSize.xs,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden"
  },
  cardTitle: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    marginTop: 4
  },
  price: {
    fontSize: mobileFontSize.md,
    fontWeight: "700",
    marginBottom: 4
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 2
  },
  featureTx: {
    flex: 1,
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  ctaInline: {
    marginTop: mobileSpacing.sm,
    fontWeight: "700",
    fontSize: mobileFontSize.sm
  },
  laterBtn: {
    alignItems: "center",
    paddingVertical: mobileSpacing.md
  },
  laterTx: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textDecorationLine: "underline"
  }
});
