import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet, View } from "react-native";
import { PigPriceIndex } from "../../../components/market/PigPriceIndex";
import { PigPriceIndexCard } from "../../../components/market/PigPriceIndexCard";
import { useSession } from "../../../context/SessionContext";
import { fetchPigPriceIndexDashboard } from "../../../lib/api";
import { mobileColors, mobileSpacing } from "../../../theme/mobileTheme";

type Props = {
  contentPaddingBottom: number;
};

/**
 * Onglet Indices : KPI PigPrice (carte + cours du porc), séparé des annonces.
 */
export function MarketplacePricesTab({ contentPaddingBottom }: Props) {
  const { accessToken, activeProfileId } = useSession();

  const pigDashboardQ = useQuery({
    queryKey: ["pigPriceDashboard", activeProfileId, "30d"],
    queryFn: () =>
      fetchPigPriceIndexDashboard(accessToken!, activeProfileId, "30d"),
    enabled: Boolean(accessToken),
    staleTime: 3_600_000
  });

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: contentPaddingBottom }
      ]}
      showsVerticalScrollIndicator={false}
      testID="marketplace-prices-tab"
    >
      <View style={styles.section}>
        <PigPriceIndexCard hybrid={pigDashboardQ.data?.hybrid ?? undefined} />
        <PigPriceIndex />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: mobileColors.canvas
  },
  content: {
    paddingTop: mobileSpacing.sm,
    gap: mobileSpacing.sm
  },
  section: {
    paddingHorizontal: mobileSpacing.lg,
    gap: mobileSpacing.md
  }
});
