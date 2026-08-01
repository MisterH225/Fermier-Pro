import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  DetailCard,
  DetailRow,
  DetailSectionLabel
} from "../../components/marketplace/listingDetailUi";
import { FeedIngredientIcon } from "../../components/merchant/FeedIngredientIcon";
import { MerchantProductsSalesSection } from "../../components/merchant/MerchantProductsSalesSection";
import { useSession } from "../../context/SessionContext";
import { useBottomChromePad } from "../../hooks/useBottomInset";
import {
  deactivateMillIngredientOffer,
  fetchMerchantProduct,
  fetchMerchantSellerOrders,
  fetchMillIngredientOffers,
  updateMillIngredientOffer
} from "../../lib/api";
import { formatApiError } from "../../lib/apiErrors";
import { formatMarketMoney } from "../../lib/formatMoney";
import type { RootStackParamList } from "../../types/navigation";
import {
  mobileColors,
  mobileFontSize,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { merchantColors, merchantRadius } from "../../theme/merchantTheme";

type Props = NativeStackScreenProps<
  RootStackParamList,
  "MillIngredientOfferDetail"
>;

export function MillIngredientOfferDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const bottomChromePad = useBottomChromePad();
  const queryClient = useQueryClient();
  const { accessToken, activeProfileId } = useSession();
  const offerId = route.params.offerId;

  const offersQ = useQuery({
    queryKey: ["mill-offers", activeProfileId],
    queryFn: () => fetchMillIngredientOffers(accessToken!, activeProfileId!),
    enabled: Boolean(accessToken && activeProfileId)
  });

  const offer = useMemo(
    () => (offersQ.data ?? []).find((o) => o.id === offerId) ?? null,
    [offersQ.data, offerId]
  );

  const productId = offer?.merchantProductId ?? null;

  const productQ = useQuery({
    queryKey: ["merchant-product-mine", activeProfileId, productId],
    queryFn: () =>
      fetchMerchantProduct(accessToken!, activeProfileId!, productId!),
    enabled: Boolean(accessToken && activeProfileId && productId)
  });

  const ordersQ = useQuery({
    queryKey: ["merchant-seller-orders", activeProfileId],
    queryFn: () => fetchMerchantSellerOrders(accessToken!, activeProfileId!),
    enabled: Boolean(accessToken && activeProfileId && productId)
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      title:
        offer?.feedIngredientName?.trim() ||
        t("merchant.millIngredients.detailTitle")
    });
  }, [navigation, offer?.feedIngredientName, t]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["mill-offers", activeProfileId]
    });
    await queryClient.invalidateQueries({
      queryKey: ["merchant-products", activeProfileId]
    });
    if (productId) {
      await queryClient.invalidateQueries({
        queryKey: ["merchant-product-mine", activeProfileId, productId]
      });
    }
  };

  const togglePublic = useMutation({
    mutationFn: () =>
      updateMillIngredientOffer(accessToken!, activeProfileId!, offerId, {
        isPubliclyListed: !offer!.isPubliclyListed
      }),
    onSuccess: () => void invalidate(),
    onError: (e) => Alert.alert(formatApiError(e))
  });

  const deactivate = useMutation({
    mutationFn: () =>
      deactivateMillIngredientOffer(accessToken!, activeProfileId!, offerId),
    onSuccess: () => {
      void invalidate();
      navigation.goBack();
    },
    onError: (e) => Alert.alert(formatApiError(e))
  });

  if (offersQ.isLoading || !offer) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={merchantColors.primary} />
      </View>
    );
  }

  const product = productQ.data;
  const packagingLabel = t(
    `merchant.millIngredients.packagingLabels.${offer.packaging}`
  );

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomChromePad + mobileSpacing.lg }
        ]}
        showsVerticalScrollIndicator={false}
        testID="mill-ingredient-offer-detail-scroll"
      >
        <View style={styles.hero}>
          <FeedIngredientIcon
            imageUrl={offer.feedIngredientImageUrl}
            iconKey={offer.feedIngredientIconKey}
            category={offer.feedIngredientCategory}
            canonicalName={offer.feedIngredientName}
            size={72}
          />
          <View style={styles.badgePill}>
            <Text style={styles.badgeTx}>
              {offer.isPubliclyListed
                ? t("merchant.millIngredients.publicBadge")
                : t("merchant.millIngredients.privateBadge")}
            </Text>
          </View>
        </View>

        <DetailCard style={styles.firstCard}>
          <Text style={styles.title}>
            {offer.feedIngredientName ?? offer.feedIngredientId}
          </Text>
          <Text style={styles.price}>
            {formatMarketMoney(Number(offer.pricePerUnit), "XOF")}
            {` / ${packagingLabel}`}
          </Text>
          <Text style={styles.stock}>
            {t("merchant.millIngredients.stockLabel", {
              qty: offer.stockQuantity
            })}
          </Text>
          {offer.pricePerKg != null ? (
            <Text style={styles.meta}>
              {formatMarketMoney(Number(offer.pricePerKg), "XOF")} / kg
            </Text>
          ) : null}
          {offer.feedIngredientCategory ? (
            <Text style={styles.meta}>{offer.feedIngredientCategory}</Text>
          ) : null}
        </DetailCard>

        <DetailCard>
          <DetailSectionLabel>
            {t("merchant.products.stats.title")}
          </DetailSectionLabel>
          {productId && product ? (
            <>
              <View style={styles.statsGrid}>
                <View style={styles.statCell}>
                  <Ionicons
                    name="eye-outline"
                    size={20}
                    color={merchantColors.primary}
                  />
                  <Text style={styles.statValue}>{product.viewCount ?? 0}</Text>
                  <Text style={styles.statLabel}>
                    {t("merchant.products.stats.views")}
                  </Text>
                </View>
                <View style={styles.statCell}>
                  <Ionicons
                    name="heart-outline"
                    size={20}
                    color={merchantColors.primary}
                  />
                  <Text style={styles.statValue}>
                    {product.favoriteCount ?? 0}
                  </Text>
                  <Text style={styles.statLabel}>
                    {t("merchant.products.stats.likes")}
                  </Text>
                </View>
                <View style={styles.statCell}>
                  <Ionicons
                    name="cart-outline"
                    size={20}
                    color={merchantColors.primary}
                  />
                  <Text style={styles.statValue}>
                    {product.purchaseCount ?? 0}
                  </Text>
                  <Text style={styles.statLabel}>
                    {t("merchant.products.stats.purchases")}
                  </Text>
                </View>
                <View style={styles.statCell}>
                  <Ionicons
                    name="layers-outline"
                    size={20}
                    color={merchantColors.primary}
                  />
                  <Text style={styles.statValue}>{product.unitsSold ?? 0}</Text>
                  <Text style={styles.statLabel}>
                    {t("merchant.products.stats.unitsSold")}
                  </Text>
                </View>
              </View>
              <Text style={styles.statsHint}>
                {t("merchant.products.stats.hint")}
              </Text>
            </>
          ) : (
            <Text style={styles.statsHint}>
              {t("merchant.millIngredients.statsPrivateHint")}
            </Text>
          )}
        </DetailCard>

        {productId ? (
          <View style={styles.salesPad}>
            <MerchantProductsSalesSection
              orders={ordersQ.data}
              loading={ordersQ.isLoading}
              productId={productId}
              showRecentSales
              subtitle={t("merchant.products.sales.productSubtitle")}
            />
          </View>
        ) : null}

        <DetailCard>
          <DetailSectionLabel>
            {t("merchant.millIngredients.packaging")}
          </DetailSectionLabel>
          <DetailRow
            label={t("merchant.millIngredients.packaging")}
            value={packagingLabel}
          />
          {offer.mixingCostPerKg != null ? (
            <DetailRow
              label={t("merchant.millIngredients.mixingCost")}
              value={formatMarketMoney(Number(offer.mixingCostPerKg), "XOF")}
            />
          ) : null}
          {product?.status ? (
            <DetailRow
              label={t("merchant.products.stats.title")}
              value={(() => {
                const key = `merchant.products.status.${product.status}`;
                const translated = t(key);
                return translated === key ? product.status : translated;
              })()}
            />
          ) : null}
        </DetailCard>

        <View style={styles.actions}>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => togglePublic.mutate()}
            disabled={togglePublic.isPending}
            testID="mill-offer-detail-toggle-public"
          >
            <Text style={styles.primaryBtnTx}>
              {offer.isPubliclyListed
                ? t("merchant.millIngredients.unlist")
                : t("merchant.millIngredients.listPublic")}
            </Text>
          </Pressable>
          {productId ? (
            <Pressable
              style={styles.secondaryBtn}
              onPress={() =>
                navigation.navigate("MerchantMyProductDetail", {
                  productId
                })
              }
            >
              <Text style={styles.secondaryBtnTx}>
                {t("merchant.millIngredients.openLinkedProduct")}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.dangerBtn}
            onPress={() =>
              Alert.alert(
                t("merchant.millIngredients.deactivate"),
                undefined,
                [
                  { text: t("common.cancel"), style: "cancel" },
                  {
                    text: t("merchant.millIngredients.deactivate"),
                    style: "destructive",
                    onPress: () => deactivate.mutate()
                  }
                ]
              )
            }
            disabled={deactivate.isPending}
          >
            <Text style={styles.dangerBtnTx}>
              {t("merchant.millIngredients.deactivate")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: mobileColors.surfaceMuted },
  scrollContent: { flexGrow: 1 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: {
    height: 160,
    backgroundColor: merchantColors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  badgePill: {
    position: "absolute",
    top: mobileSpacing.md,
    right: mobileSpacing.lg,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: merchantRadius.pill
  },
  badgeTx: {
    fontSize: mobileFontSize.sm,
    fontWeight: "700",
    color: merchantColors.primary
  },
  firstCard: { marginTop: mobileSpacing.md },
  title: {
    fontSize: mobileFontSize.xl,
    fontWeight: "800",
    color: mobileColors.textPrimary,
    marginBottom: mobileSpacing.xs
  },
  price: {
    fontSize: mobileFontSize.xl,
    fontWeight: "800",
    color: merchantColors.primary,
    marginBottom: 4
  },
  stock: {
    fontSize: mobileFontSize.md,
    fontWeight: "600",
    color: merchantColors.textSecondary
  },
  meta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 4
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.sm
  },
  statCell: {
    width: "47%",
    backgroundColor: merchantColors.primaryLight,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    alignItems: "center",
    gap: 4
  },
  statValue: {
    fontSize: mobileFontSize.xl,
    fontWeight: "800",
    color: merchantColors.primaryDark
  },
  statLabel: {
    fontSize: mobileFontSize.xs,
    fontWeight: "600",
    color: merchantColors.textSecondary,
    textAlign: "center"
  },
  statsHint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm,
    lineHeight: 16
  },
  salesPad: {
    paddingHorizontal: mobileSpacing.lg
  },
  actions: {
    marginHorizontal: mobileSpacing.lg,
    marginTop: mobileSpacing.sm,
    gap: 10
  },
  primaryBtn: {
    backgroundColor: merchantColors.primary,
    padding: 14,
    borderRadius: merchantRadius.pill,
    alignItems: "center"
  },
  primaryBtnTx: {
    color: mobileColors.background,
    fontWeight: "700",
    fontSize: mobileFontSize.lg
  },
  secondaryBtn: {
    backgroundColor: merchantColors.cardBg,
    borderWidth: 1,
    borderColor: merchantColors.primary,
    padding: 14,
    borderRadius: merchantRadius.pill,
    alignItems: "center"
  },
  secondaryBtnTx: {
    color: merchantColors.primary,
    fontWeight: "700",
    fontSize: mobileFontSize.lg
  },
  dangerBtn: {
    padding: 12,
    alignItems: "center"
  },
  dangerBtnTx: {
    color: "#B91C1C",
    fontWeight: "700",
    fontSize: mobileFontSize.md
  }
});
