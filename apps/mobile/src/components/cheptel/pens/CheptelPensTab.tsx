import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { useSession } from "../../../context/SessionContext";
import { mobileSpacing, mobileTypography, mobileColors } from "../../../theme/mobileTheme";
import { PenGrid } from "./PenGrid";

type Props = {
  farmId: string;
  occupancyRate: number | null;
  availablePens: number;
  onInvalidateOverview?: () => void;
};

export function CheptelPensTab({
  farmId,
  occupancyRate,
  availablePens,
  onInvalidateOverview
}: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();

  if (!accessToken) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.meta}>
        {t("cheptel.pensOccupancyHint", {
          rate: occupancyRate != null ? `${occupancyRate}%` : "—",
          available: availablePens
        })}
      </Text>
      <PenGrid
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        onInvalidateOverview={onInvalidateOverview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.md, paddingBottom: 80 },
  meta: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary
  }
});
