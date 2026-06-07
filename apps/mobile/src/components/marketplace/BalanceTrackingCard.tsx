import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { formatMarketMoney } from "./MarketplaceListingCard";
import { CountdownBalance } from "./CountdownBalance";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  balanceAmount: number;
  currency: string;
  balanceDueAt: string | null;
  status: string;
  listingTitle?: string;
};

function daysUntil(dueAt: string | null): number | null {
  if (!dueAt) return null;
  const due = new Date(dueAt).getTime();
  if (Number.isNaN(due)) return null;
  return Math.ceil((due - Date.now()) / 86_400_000);
}

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
  listingTitle
}: Props) {
  const { t } = useTranslation();
  const days = daysUntil(balanceDueAt);
  const dueLabel =
    balanceDueAt != null
      ? new Date(balanceDueAt).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "short",
          year: "numeric"
        })
      : "—";

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
      <Text style={styles.due}>
        {t("marketScreen.credit.balance.dueOn", { date: dueLabel })}
        {days != null
          ? ` — ${t("marketScreen.credit.balance.inDays", { count: Math.max(0, days) })}`
          : ""}
      </Text>
      <CountdownBalance dueAt={balanceDueAt} />
      <Text style={styles.status}>{t(statusLabelKey(status))}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFF8E6",
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    borderWidth: 1,
    borderColor: "#F0D9A8",
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
    fontSize: 20,
    color: "#BA7517",
    fontWeight: "800"
  },
  due: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  status: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    marginTop: mobileSpacing.xs
  }
});
