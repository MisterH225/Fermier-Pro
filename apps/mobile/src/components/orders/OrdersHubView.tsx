import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSession } from "../../context/SessionContext";
import {
  fetchBuyerReviews,
  fetchMarketplaceOrders,
  fetchMarketplaceOrdersCounters,
  type MarketplaceOrderRole
} from "../../lib/api";
import {
  legacyBuyerHistoryTabToSegment,
  mapOrderProjectionToCardProps,
  orderDetailRoute,
  ordersHubSegmentToQuery,
  type OrdersHubUiSegment
} from "../../lib/ordersHub";
import { openBuyerOffersHub } from "../../lib/buyerMarketplacePending";
import { openProducerOffersHub } from "../../lib/producerMarketplacePending";
import { mobileRadius, mobileSpacing, mobileTypography, mobileColors, mobileFontSize } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";
import { OrderCard } from "./OrderCard";
import { ordersPalette, type OrderPalette } from "./orderTheme";
import { uiNamedColors } from "../../theme/uiNamedColors";

const SEGMENTS: OrdersHubUiSegment[] = [
  "action_required",
  "active",
  "disputed",
  "closed"
];

type Props = {
  role: MarketplaceOrderRole;
  /** Segment initial (ou dérivé d’un ancien onglet BuyerHistory). */
  initialSegment?: OrdersHubUiSegment;
  legacyInitialTab?: string;
  palette?: OrderPalette;
  contentContainerStyle?: object | object[];
  /** Affiche le lien avis (acheteur uniquement). */
  showReviewsLink?: boolean;
};

export function OrdersHubView({
  role,
  initialSegment,
  legacyInitialTab,
  palette = ordersPalette,
  contentContainerStyle,
  showReviewsLink = false
}: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken, activeProfileId } = useSession();
  const [segment, setSegment] = useState<OrdersHubUiSegment>(
    () =>
      initialSegment ??
      legacyBuyerHistoryTabToSegment(legacyInitialTab)
  );
  const [showReviews, setShowReviews] = useState(
    () => legacyInitialTab === "reviews"
  );

  const querySegment = ordersHubSegmentToQuery(segment);

  const countersQ = useQuery({
    queryKey: ["marketplace-orders-counters", role, activeProfileId],
    queryFn: () =>
      fetchMarketplaceOrdersCounters(accessToken!, role, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const ordersQ = useQuery({
    queryKey: [
      "marketplace-orders",
      role,
      querySegment,
      activeProfileId
    ],
    queryFn: () =>
      fetchMarketplaceOrders(
        accessToken!,
        { role, segment: querySegment, limit: 50 },
        activeProfileId
      ),
    enabled: Boolean(accessToken)
  });

  const reviewsQ = useQuery({
    queryKey: ["buyerReviews", activeProfileId, "hub"],
    queryFn: () => fetchBuyerReviews(accessToken!, activeProfileId),
    enabled: Boolean(accessToken && showReviewsLink && showReviews)
  });

  const cards = useMemo(
    () =>
      (ordersQ.data?.items ?? []).map((item) => ({
        item,
        props: mapOrderProjectionToCardProps(item, role)
      })),
    [ordersQ.data?.items, role]
  );

  const pendingProposals = countersQ.data?.pendingProposals ?? 0;
  const actionRequired = countersQ.data?.actionRequired ?? 0;

  const refresh = () => {
    void countersQ.refetch();
    void ordersQ.refetch();
    if (showReviews) void reviewsQ.refetch();
  };

  const openProposals = () => {
    if (role === "buyer") {
      openBuyerOffersHub(navigation);
      return;
    }
    openProducerOffersHub(navigation);
  };

  const emptyKey = `orders.hub.empty.${segment}`;

  return (
    <ScrollView
      contentContainerStyle={[styles.scroll, contentContainerStyle]}
      refreshControl={
        <RefreshControl
          refreshing={
            (ordersQ.isFetching || countersQ.isFetching) &&
            !ordersQ.isLoading
          }
          onRefresh={refresh}
          tintColor={palette.primary}
        />
      }
    >
      {pendingProposals > 0 ? (
        <Pressable
          style={[
            styles.proposalsBanner,
            {
              backgroundColor: palette.primaryLight,
              borderColor: palette.border
            }
          ]}
          onPress={openProposals}
          accessibilityRole="button"
        >
          <Text style={[styles.proposalsText, { color: palette.primaryDark }]}>
            {t("orders.hub.pendingProposals", { count: pendingProposals })}
          </Text>
          <Text style={[styles.proposalsCta, { color: palette.primary }]}>
            {t("orders.hub.viewProposals")}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.chips}>
        {SEGMENTS.map((key) => {
          const active = segment === key;
          const count =
            key === "action_required"
              ? actionRequired
              : key === "active"
                ? countersQ.data?.active
                : key === "disputed"
                  ? countersQ.data?.disputed
                  : undefined;
          return (
            <Pressable
              key={key}
              style={[
                styles.chip,
                {
                  borderColor: active ? palette.primary : palette.border,
                  backgroundColor: active
                    ? palette.primary
                    : palette.cardBg
                }
              ]}
              onPress={() => setSegment(key)}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: active ? palette.onPrimary : palette.textSecondary }
                ]}
              >
                {t(`orders.hub.segments.${key}`)}
              </Text>
              {key === "action_required" && (count ?? 0) > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{count}</Text>
                </View>
              ) : count != null && count > 0 && key !== "action_required" ? (
                <Text
                  style={[
                    styles.chipCount,
                    {
                      color: active
                        ? palette.onPrimary
                        : palette.textSecondary
                    }
                  ]}
                >
                  {count}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {ordersQ.isLoading ? (
        <ActivityIndicator color={palette.primary} style={styles.loader} />
      ) : ordersQ.error ? (
        <Text style={[styles.error, { color: palette.danger }]}>
          {(ordersQ.error as Error).message}
        </Text>
      ) : cards.length === 0 ? (
        <Text style={[styles.empty, { color: palette.textSecondary }]}>
          {t(emptyKey)}
        </Text>
      ) : (
        <View style={styles.list}>
          {cards.map(({ item, props }) => (
            <OrderCard
              key={`${item.type}-${item.id}`}
              {...props}
              palette={palette}
              onPress={() => {
                const route = orderDetailRoute(item);
                if (route.screen === "MerchantOrderDetail") {
                  navigation.navigate("MerchantOrderDetail", route.params);
                  return;
                }
                navigation.navigate("MarketplaceTransaction", route.params);
              }}
            />
          ))}
        </View>
      )}

      {showReviewsLink ? (
        <View style={styles.reviewsBlock}>
          <Pressable
            onPress={() => setShowReviews((v) => !v)}
            hitSlop={8}
          >
            <Text style={[styles.reviewsLink, { color: palette.primary }]}>
              {showReviews
                ? t("orders.hub.hideReviews")
                : t("orders.hub.showReviews")}
            </Text>
          </Pressable>
          {showReviews ? (
            reviewsQ.isLoading ? (
              <ActivityIndicator color={palette.primary} />
            ) : (reviewsQ.data ?? []).length === 0 ? (
              <Text style={[styles.empty, { color: palette.textSecondary }]}>
                {t("buyer.history.noReviews")}
              </Text>
            ) : (
              <View style={styles.reviewsList}>
                {(reviewsQ.data ?? []).map((review) => (
                  <View
                    key={review.id}
                    style={[
                      styles.reviewRow,
                      {
                        borderColor: palette.border,
                        backgroundColor: palette.cardBg
                      }
                    ]}
                  >
                    <Text
                      style={[styles.reviewTitle, { color: palette.textPrimary }]}
                    >
                      {review.farmName}
                    </Text>
                    <Text
                      style={[
                        styles.reviewMeta,
                        { color: palette.textSecondary }
                      ]}
                    >
                      {"★".repeat(Math.min(5, Math.max(0, review.score)))}
                      {review.comment ? ` · ${review.comment}` : ""}
                    </Text>
                  </View>
                ))}
              </View>
            )
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: mobileSpacing.lg,
    gap: mobileSpacing.md,
    paddingBottom: mobileSpacing.xxl
  },
  proposalsBanner: {
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing.sm
  },
  proposalsText: {
    ...mobileTypography.meta,
    fontWeight: "700",
    flex: 1
  },
  proposalsCta: {
    ...mobileTypography.meta,
    fontWeight: "800"
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.sm
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 8,
    borderRadius: mobileRadius.pill,
    borderWidth: 1
  },
  chipText: {
    ...mobileTypography.meta,
    fontWeight: "700"
  },
  chipCount: {
    ...mobileTypography.meta,
    fontWeight: "700"
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: mobileRadius.sm,
    paddingHorizontal: 5,
    backgroundColor: uiNamedColors.cDC2626,
    alignItems: "center",
    justifyContent: "center"
  },
  badgeText: {
    color: mobileColors.background,
    fontSize: mobileFontSize.xs,
    fontWeight: "800"
  },
  loader: { marginTop: mobileSpacing.xl },
  empty: {
    ...mobileTypography.body,
    textAlign: "center",
    marginTop: mobileSpacing.xl,
    paddingHorizontal: mobileSpacing.lg
  },
  error: {
    ...mobileTypography.body,
    textAlign: "center",
    marginTop: mobileSpacing.lg
  },
  list: { gap: mobileSpacing.md },
  reviewsBlock: {
    marginTop: mobileSpacing.lg,
    gap: mobileSpacing.sm,
    alignItems: "center"
  },
  reviewsLink: {
    ...mobileTypography.meta,
    fontWeight: "700",
    textDecorationLine: "underline"
  },
  reviewsList: { width: "100%", gap: mobileSpacing.sm },
  reviewRow: {
    borderWidth: 1,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    gap: 4
  },
  reviewTitle: {
    ...mobileTypography.cardTitle,
    fontSize: mobileFontSize.md
  },
  reviewMeta: {
    ...mobileTypography.meta
  }
});
