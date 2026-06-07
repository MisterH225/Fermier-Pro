import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  fetchLinkedStockForExpense,
  type FinanceMergedTransactionDto,
  type LinkedStockMovementSummaryDto
} from "../../lib/api";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  transaction: FinanceMergedTransactionDto;
  onOpenStock?: () => void;
};

export function LinkedStockSection({
  farmId,
  accessToken,
  activeProfileId,
  transaction,
  onOpenStock
}: Props) {
  const { t } = useTranslation();
  const ids = transaction.linkedStockMovementIds ?? [];
  const q = useQuery({
    queryKey: ["linkedStock", farmId, transaction.id],
    queryFn: () =>
      fetchLinkedStockForExpense(
        accessToken,
        farmId,
        transaction.id,
        activeProfileId
      ),
    enabled: Boolean(accessToken && ids.length > 0)
  });

  if (ids.length === 0) {
    return null;
  }

  return (
    <View style={{ marginTop: mobileSpacing.md }}>
      <Text
        style={{
          ...mobileTypography.meta,
          fontWeight: "700",
          color: mobileColors.textSecondary,
          marginBottom: mobileSpacing.xs
        }}
      >
        {t("financeStockLink.linkedStockTitle")}
      </Text>
      {q.isPending ? (
        <ActivityIndicator size="small" color={mobileColors.accent} />
      ) : (
        <View style={{ gap: mobileSpacing.xs }}>
          {(q.data?.movements ?? []).map((m: LinkedStockMovementSummaryDto) => (
            <Text key={m.id} style={{ ...mobileTypography.body }}>
              {m.feedTypeName} — {m.quantityKg ?? "0"} kg
              {m.unitPrice
                ? ` · ${t("financeStockLink.unitPrice", { price: m.unitPrice })}`
                : ""}
            </Text>
          ))}
        </View>
      )}
      {onOpenStock ? (
        <Pressable onPress={onOpenStock} style={{ marginTop: mobileSpacing.sm }}>
          <Text style={{ color: mobileColors.accent, fontWeight: "700" }}>
            {t("financeStockLink.openStock")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
