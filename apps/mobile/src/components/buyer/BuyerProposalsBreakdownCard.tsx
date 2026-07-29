import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { ScreenSection } from "../layout";
import { SurfaceCard } from "../common/SurfaceCard";
import { StatusBadge } from "../common/StatusBadge";
import { buyerPalette } from "../common/rolePalette";
import { openBuyerOffersHub } from "../../lib/buyerMarketplacePending";
import { formatMarketMoney } from "../../lib/formatMoney";
import type { BuyerDashboardProposalsDto } from "../../lib/api/buyer";
import { buyerColors } from "../../theme/buyerTheme";
import {
  mobileFontSize,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type Props = {
  proposals?: BuyerDashboardProposalsDto;
  isLoading?: boolean;
};

const STATUS_KEYS = [
  "pending",
  "countered",
  "accepted",
  "rejected"
] as const;

const STATUS_TONE: Record<
  (typeof STATUS_KEYS)[number],
  { bg: string; fg: string }
> = {
  pending: { bg: buyerColors.kpiAmber, fg: buyerColors.warning },
  countered: { bg: buyerColors.kpiBlue, fg: buyerColors.primaryDark },
  accepted: { bg: buyerColors.kpiGreen, fg: buyerColors.success },
  rejected: { bg: buyerColors.kpiRose, fg: buyerColors.danger }
};

export function BuyerProposalsBreakdownCard({ proposals, isLoading }: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const totalCount = proposals
    ? STATUS_KEYS.reduce((sum, k) => sum + proposals[k].count, 0)
    : 0;
  const empty = !isLoading && totalCount === 0;

  return (
    <ScreenSection title={t("buyer.dashboard.proposalsTitle")} plain>
      <SurfaceCard
        palette={buyerPalette}
        onPress={() => openBuyerOffersHub(navigation)}
        testID="buyer-proposals-breakdown-card"
      >
        {isLoading && !proposals ? (
          <Text style={styles.muted}>{t("common.loading")}</Text>
        ) : empty ? (
          <Text style={styles.muted}>
            {t("buyer.dashboard.proposalsEmpty")}
          </Text>
        ) : (
          <View style={styles.list}>
            {STATUS_KEYS.map((key) => {
              const bucket = proposals?.[key] ?? { count: 0, amount: 0 };
              const tone = STATUS_TONE[key];
              return (
                <View key={key} style={styles.row}>
                  <View style={styles.rowMain}>
                    <StatusBadge
                      label={t(`buyer.dashboard.proposalStatus.${key}`)}
                      backgroundColor={tone.bg}
                      color={tone.fg}
                    />
                    <Text style={styles.count}>
                      {t("buyer.dashboard.proposalCount", {
                        count: bucket.count
                      })}
                    </Text>
                  </View>
                  <Text style={styles.amount}>
                    {formatMarketMoney(bucket.amount, "XOF")}
                  </Text>
                </View>
              );
            })}
            <Text style={styles.cta}>
              {t("buyer.dashboard.viewProposals")} →
            </Text>
          </View>
        )}
      </SurfaceCard>
    </ScreenSection>
  );
}

const styles = StyleSheet.create({
  list: { gap: mobileSpacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing.sm
  },
  rowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    flexWrap: "wrap"
  },
  count: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary
  },
  amount: {
    fontSize: mobileFontSize.md,
    fontWeight: "800",
    color: buyerColors.textPrimary
  },
  muted: {
    ...mobileTypography.body,
    color: buyerColors.textSecondary
  },
  cta: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: buyerColors.primary,
    marginTop: mobileSpacing.xs
  }
});
