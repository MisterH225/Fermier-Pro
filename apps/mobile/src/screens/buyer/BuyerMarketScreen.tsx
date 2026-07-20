import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";
import { BuyerAlertsPanel } from "../../components/buyer/BuyerAlertsPanel";
import { BuyerFavoritesPanel } from "../../components/buyer/BuyerFavoritesPanel";
import { BuyerMobileShell } from "../../components/layout/BuyerMobileShell";
import { MarketplaceBrowseListings } from "../../components/marketplace/MarketplaceBrowseListings";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { useBottomChromePad, useBottomInset } from "../../hooks/useBottomInset";
import { buyerColors } from "../../theme/buyerTheme";
import { mobileSpacing } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type Route = RouteProp<RootStackParamList, "BuyerMarket">;
type Segment = "listings" | "favorites" | "alerts";

const SEG_PALETTE = {
  track: buyerColors.primaryLight,
  activeBg: buyerColors.cardBg,
  activeLabel: buyerColors.textPrimary,
  inactiveLabel: buyerColors.textSecondary,
  trackRadius: 14,
  pillRadius: 11
} as const;

function resolveSegment(
  params: RootStackParamList["BuyerMarket"]
): Segment {
  if (
    params?.segment === "favorites" ||
    params?.segment === "alerts" ||
    params?.segment === "listings"
  ) {
    return params.segment;
  }
  if (params?.favoritesOnly) return "favorites";
  return "listings";
}

export function BuyerMarketScreen() {
  const { t } = useTranslation();
  const route = useRoute<Route>();
  const bottomInset = useBottomInset();
  const bottomChromePad = useBottomChromePad();

  const [segment, setSegment] = useState<Segment>(() =>
    resolveSegment(route.params)
  );

  useEffect(() => {
    setSegment(resolveSegment(route.params));
  }, [route.params]);

  const segments = useMemo(
    () => [
      { key: "listings", label: t("buyer.market.segmentListings") },
      { key: "favorites", label: t("buyer.market.segmentFavorites") },
      { key: "alerts", label: t("buyer.market.segmentAlerts") }
    ],
    [t]
  );

  return (
    <BuyerMobileShell>
      <View style={[styles.wrap, { paddingBottom: bottomChromePad }]}>
        <SegmentedControl
          items={segments}
          activeKey={segment}
          onChange={(key) => setSegment(key as Segment)}
          palette={SEG_PALETTE}
        />

        {segment === "listings" ? (
          <MarketplaceBrowseListings
            enabled
            buyerTheme
            contentPaddingBottom={bottomInset}
            initialSearch={route.params?.searchQuery ?? ""}
            searchPlaceholder={t("buyer.market.searchPlaceholder")}
            emptyTitle={t("buyer.market.emptyListings")}
            emptyHint={t("buyer.market.emptyListingsHint")}
          />
        ) : null}

        {segment === "favorites" ? (
          <ScrollView
            style={styles.panelScroll}
            contentContainerStyle={[
              styles.panelPad,
              { paddingBottom: bottomInset }
            ]}
            showsVerticalScrollIndicator={false}
          >
            <BuyerFavoritesPanel onExplore={() => setSegment("listings")} />
          </ScrollView>
        ) : null}

        {segment === "alerts" ? (
          <ScrollView
            style={styles.panelScroll}
            contentContainerStyle={[
              styles.panelPad,
              { paddingBottom: bottomInset }
            ]}
            showsVerticalScrollIndicator={false}
          >
            <BuyerAlertsPanel showFab={false} />
          </ScrollView>
        ) : null}
      </View>
    </BuyerMobileShell>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: mobileSpacing.md,
    paddingTop: mobileSpacing.xs,
    gap: mobileSpacing.sm
  },
  panelScroll: { flex: 1 },
  panelPad: { paddingTop: mobileSpacing.xs, gap: mobileSpacing.md }
});
