import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { mobileColors, mobileRadius, mobileSpacing } from "../../theme/mobileTheme";

type Props = {
  linkedExpenseId: string | null | undefined;
};

export function LinkedTransactionBadge({ linkedExpenseId }: Props) {
  const { t } = useTranslation();
  if (!linkedExpenseId) {
    return null;
  }
  return (
    <View
      style={{
        alignSelf: "flex-start",
        marginTop: mobileSpacing.xs,
        paddingHorizontal: mobileSpacing.sm,
        paddingVertical: 2,
        borderRadius: mobileRadius.pill,
        backgroundColor: mobileColors.accentSoft
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "600",
          color: mobileColors.accent
        }}
      >
        {t("financeStockLink.financeBadge")}
      </Text>
    </View>
  );
}
