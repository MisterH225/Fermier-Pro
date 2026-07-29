import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { DashboardPeriodPills } from "../common/DashboardPeriodPills";
import { SurfaceCard } from "../common/SurfaceCard";
import { buyerPalette } from "../common/rolePalette";
import { ScreenSection } from "../layout";
import { formatMarketMoney } from "../../lib/formatMoney";
import type {
  BuyerDashboardPeriodKey,
  BuyerDashboardPurchasesDto
} from "../../lib/api/buyer";
import { buyerColors } from "../../theme/buyerTheme";
import {
  mobileFontSize,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type Props = {
  purchases?: BuyerDashboardPurchasesDto;
  isLoading?: boolean;
};

export function BuyerPurchasesPeriodCard({ purchases, isLoading }: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [period, setPeriod] = useState<BuyerDashboardPeriodKey>("month");

  const options = useMemo(
    () =>
      [
        { key: "month" as const, label: t("buyer.dashboard.periodMonth") },
        { key: "quarter" as const, label: t("buyer.dashboard.periodQuarter") },
        { key: "year" as const, label: t("buyer.dashboard.periodYear") }
      ] as const,
    [t]
  );

  const slice = purchases?.[period];
  const currency = purchases?.currency ?? "XOF";
  const empty =
    !isLoading &&
    purchases != null &&
    slice != null &&
    slice.total === 0 &&
    slice.previousTotal === 0;

  const delta = slice?.deltaPct;
  const deltaPositive = delta != null && delta > 0;
  const deltaNegative = delta != null && delta < 0;
  const deltaLabel =
    delta == null
      ? t("buyer.dashboard.purchasesNoBaseline")
      : delta === 0
        ? t("buyer.dashboard.purchasesDeltaFlat")
        : t("buyer.dashboard.purchasesDelta", {
            value: `${delta > 0 ? "+" : ""}${delta}`
          });

  return (
    <ScreenSection title={t("buyer.dashboard.purchasesTitle")} plain>
      <SurfaceCard
        palette={buyerPalette}
        onPress={() =>
          navigation.navigate("BuyerHistory", { initialSegment: "closed" })
        }
        style={styles.hero}
        testID="buyer-purchases-period-card"
      >
        <View style={styles.header}>
          <Text style={styles.subtitle}>
            {t("buyer.dashboard.purchasesSubtitle")}
          </Text>
          <DashboardPeriodPills
            options={options}
            value={period}
            onChange={setPeriod}
            activeBackground={buyerColors.primary}
            activeColor={buyerColors.onPrimary}
            idleBackground={buyerColors.primaryLight}
            idleColor={buyerColors.primaryDark}
          />
        </View>

        {isLoading && !purchases ? (
          <Text style={styles.muted}>{t("common.loading")}</Text>
        ) : empty ? (
          <Text style={styles.muted}>
            {t("buyer.dashboard.purchasesEmpty")}
          </Text>
        ) : (
          <>
            <Text style={styles.mainValue}>
              {formatMarketMoney(slice?.total ?? 0, currency)}
            </Text>
            <Text
              style={[
                styles.delta,
                deltaPositive && styles.deltaUp,
                deltaNegative && styles.deltaDown
              ]}
            >
              {deltaLabel}
            </Text>
            <Text style={styles.meta}>
              {t("buyer.dashboard.purchasesMeta", {
                count: slice?.count ?? 0,
                previous: formatMarketMoney(slice?.previousTotal ?? 0, currency)
              })}
            </Text>
            <Text style={styles.cta}>
              {t("buyer.dashboard.viewPurchases")} →
            </Text>
          </>
        )}
      </SurfaceCard>
    </ScreenSection>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: buyerColors.primaryLight,
    borderColor: buyerColors.border
  },
  header: { gap: mobileSpacing.sm },
  subtitle: {
    ...mobileTypography.cardTitle,
    fontWeight: "800",
    color: buyerColors.textPrimary
  },
  mainValue: {
    marginTop: mobileSpacing.md,
    fontSize: mobileFontSize.xxl,
    fontWeight: "900",
    color: buyerColors.primaryDark
  },
  delta: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: buyerColors.textSecondary,
    marginTop: 4
  },
  deltaUp: { color: buyerColors.success },
  deltaDown: { color: buyerColors.danger },
  meta: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary,
    marginTop: mobileSpacing.sm
  },
  muted: {
    ...mobileTypography.body,
    color: buyerColors.textSecondary,
    marginTop: mobileSpacing.md
  },
  cta: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: buyerColors.primary,
    marginTop: mobileSpacing.sm
  }
});
