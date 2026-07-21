import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { formatMarketMoney } from "./MarketplaceListingCard";
import { DeadlineNotice, merchantWarningOrderPalette } from "../orders";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { producerColors } from "../../theme/producerTheme";
import { marketplaceColors } from "../../theme/marketplaceTheme";

type Props = {
  balanceAmount: number;
  currency: string;
  balanceDueAt: string | null;
  status: string;
  /** Échéance/conséquence exposées par le DTO crédit (P-43). */
  deadlineAt?: string | null;
  timeoutOutcomeKey?: string | null;
  listingTitle?: string;
};

function statusLabelKey(status: string): string {
  switch (status) {
    case "balance_declared":
      return "marketScreen.credit.balance.statusDeclared";
    case "completed":
      return "marketScreen.credit.balance.statusPaid";
    case "arbitration":
      return "marketScreen.credit.balance.statusArbitration";
    default:
      return "marketScreen.credit.balance.statusPending";
  }
}

export function BalanceTrackingCard({
  balanceAmount,
  currency,
  balanceDueAt,
  status,
  deadlineAt,
  timeoutOutcomeKey,
  listingTitle
}: Props) {
  const { t } = useTranslation();
  const effectiveDeadline = deadlineAt ?? balanceDueAt;
  // Fallback fidèle au cron : le solde en attente déclenche un arbitrage.
  const outcomeKey =
    timeoutOutcomeKey ??
    (status === "balance_pending"
      ? "deadline.outcome.creditBalanceArbitration"
      : null);

  return (
    <View style={styles.card}>
      {listingTitle ? (
        <Text style={styles.title} numberOfLines={2}>
          {listingTitle}
        </Text>
      ) : null}
      <Text style={styles.label}>{t("marketScreen.credit.balance.remaining")}</Text>
      <Text style={styles.amount}>
        {formatMarketMoney(balanceAmount, currency)}
      </Text>
      {effectiveDeadline ? (
        <DeadlineNotice
          deadlineAt={effectiveDeadline}
          outcomeKey={outcomeKey}
          palette={merchantWarningOrderPalette}
        />
      ) : null}
      <Text style={styles.status}>{t(statusLabelKey(status))}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: producerColors.kpiAmber,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    borderWidth: 1,
    borderColor: marketplaceColors.warnAmberBorder,
    gap: mobileSpacing.xs
  },
  title: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    marginBottom: mobileSpacing.xs
  },
  label: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  amount: {
    ...mobileTypography.title,
    fontSize: mobileFontSize.xl,
    color: marketplaceColors.warnAmber,
    fontWeight: "800"
  },
  status: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    marginTop: mobileSpacing.xs
  }
});
