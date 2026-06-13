import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";
import {
  fetchLinkedTransactionForMovement,
  type FeedStockMovementDto
} from "../../lib/api";
import { mobileColors, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type Props = {
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  movement: FeedStockMovementDto;
  currencyCode?: string;
};

export function LinkedFinanceSection({
  farmId,
  accessToken,
  activeProfileId,
  movement,
  currencyCode = "XOF"
}: Props) {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["linkedFinance", farmId, movement.id],
    queryFn: () =>
      fetchLinkedTransactionForMovement(
        accessToken,
        farmId,
        movement.id,
        activeProfileId
      ),
    enabled: Boolean(accessToken) && Boolean(movement.linkedExpenseId)
  });

  if (!movement.linkedExpenseId) {
    return null;
  }

  return (
    <View style={{ marginTop: mobileSpacing.sm }}>
      <Text
        style={{
          ...mobileTypography.meta,
          fontWeight: "700",
          color: mobileColors.textSecondary
        }}
      >
        {t("financeStockLink.linkedFinanceTitle")}
      </Text>
      {q.isPending ? (
        <ActivityIndicator size="small" color={mobileColors.accent} />
      ) : q.data?.expense ? (
        <Text style={{ ...mobileTypography.body, marginTop: mobileSpacing.xs }}>
          {q.data.expense.label} — {q.data.expense.amount} {q.data.expense.currency || currencyCode}
        </Text>
      ) : null}
    </View>
  );
}
