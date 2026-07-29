import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SurfaceCard } from "../common/SurfaceCard";
import { StatusBadge } from "../common/StatusBadge";
import { buyerPalette } from "../common/rolePalette";
import { formatMarketMoney } from "../../lib/formatMoney";
import type { BuyerCreditSituationDto } from "../../lib/api/buyer";
import { buyerColors } from "../../theme/buyerTheme";
import {
  mobileFontSize,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type Props = {
  data: BuyerCreditSituationDto | undefined;
  isLoading: boolean;
};

function formatDueDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale === "en" ? "en-US" : "fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function BuyerFinanceCreditsTab({ data, isLoading }: Props) {
  const { t, i18n } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const locale = i18n.language === "en" ? "en" : "fr";

  if (isLoading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={buyerColors.primary} />
      </View>
    );
  }

  const items = data?.items ?? [];
  const currency = data?.currency ?? "XOF";
  const empty = items.length === 0;

  return (
    <View style={styles.wrap} testID="buyer-finance-credits">
      <SurfaceCard palette={buyerPalette} style={styles.totalCard}>
        <Text style={styles.totalLabel}>{t("buyer.finance.creditTotal")}</Text>
        <Text style={styles.totalValue}>
          {formatMarketMoney(data?.totalDue ?? 0, currency)}
        </Text>
        {empty ? (
          <Text style={styles.empty}>{t("buyer.finance.creditsEmpty")}</Text>
        ) : null}
      </SurfaceCard>

      {items.map((item) => {
        const statusKey = item.financeStatus;
        const badgeTone =
          statusKey === "overdue"
            ? { bg: buyerColors.danger, fg: buyerColors.onPrimary }
            : statusKey === "settled"
              ? { bg: buyerColors.kpiGreen, fg: buyerColors.success }
              : { bg: buyerColors.kpiAmber, fg: buyerColors.warning };
        return (
          <SurfaceCard
            key={item.offerId}
            palette={buyerPalette}
            onPress={() => {
              if (item.transactionId) {
                navigation.navigate("MarketplaceTransaction", {
                  transactionId: item.transactionId
                });
                return;
              }
              navigation.navigate("MarketplaceList", {
                tab: "offers",
                offersSubTab: "sent",
                buyerView: true,
                highlightOfferId: item.offerId
              });
            }}
          >
            <View style={styles.rowTop}>
              <View style={styles.rowText}>
                <Text style={styles.seller} numberOfLines={1}>
                  {item.farmName?.trim() || item.sellerName}
                </Text>
                <Text style={styles.listing} numberOfLines={1}>
                  {item.listingTitle}
                </Text>
              </View>
              <StatusBadge
                label={t(`buyer.finance.creditStatus.${statusKey}`)}
                backgroundColor={badgeTone.bg}
                color={badgeTone.fg}
              />
            </View>
            <View style={styles.amounts}>
              <Text style={styles.amountLine}>
                {t("buyer.finance.creditInitial", {
                  amount: formatMarketMoney(
                    item.initialAmount,
                    item.currency || currency
                  )
                })}
              </Text>
              <Text style={styles.amountLine}>
                {t("buyer.finance.creditAdvance", {
                  amount: formatMarketMoney(
                    item.advanceAmount,
                    item.currency || currency
                  )
                })}
              </Text>
              <Text style={styles.dueAmount}>
                {t("buyer.finance.creditRemaining", {
                  amount: formatMarketMoney(
                    item.amountDue,
                    item.currency || currency
                  )
                })}
              </Text>
            </View>
            <Text style={styles.due}>
              {t("buyer.finance.creditDueAt", {
                when: formatDueDate(item.balanceDueAt, locale)
              })}
            </Text>
          </SurfaceCard>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.md },
  centered: {
    paddingVertical: mobileSpacing.xxl,
    alignItems: "center"
  },
  totalCard: {
    backgroundColor: buyerColors.primaryLight,
    gap: 4
  },
  totalLabel: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: buyerColors.primaryDark
  },
  totalValue: {
    fontSize: mobileFontSize.xxl,
    fontWeight: "900",
    color: buyerColors.primary
  },
  empty: {
    ...mobileTypography.body,
    color: buyerColors.textSecondary,
    marginTop: mobileSpacing.sm
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: mobileSpacing.sm
  },
  rowText: { flex: 1, minWidth: 0 },
  seller: {
    ...mobileTypography.cardTitle,
    fontSize: mobileFontSize.md,
    color: buyerColors.textPrimary
  },
  listing: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary,
    marginTop: 2
  },
  amounts: {
    marginTop: mobileSpacing.sm,
    gap: 2
  },
  amountLine: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary
  },
  dueAmount: {
    ...mobileTypography.body,
    fontWeight: "800",
    color: buyerColors.textPrimary,
    marginTop: 2
  },
  due: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary,
    marginTop: mobileSpacing.sm
  }
});
