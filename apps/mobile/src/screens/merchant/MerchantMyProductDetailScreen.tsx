import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLayoutEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Dimensions,
  Image,
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
import { useSession } from "../../context/SessionContext";
import { useBottomChromePad } from "../../hooks/useBottomInset";
import { fetchMerchantProduct } from "../../lib/api";
import { formatMarketMoney } from "../../lib/formatMoney";
import type { RootStackParamList } from "../../types/navigation";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { merchantColors, merchantRadius } from "../../theme/merchantTheme";

type Props = NativeStackScreenProps<RootStackParamList, "MerchantMyProductDetail">;

const HERO_HEIGHT = 240;

function statusLabel(t: (k: string) => string, status: string) {
  const key = `merchant.products.status.${status}`;
  const translated = t(key);
  return translated === key ? status : translated;
}

export function MerchantMyProductDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const bottomChromePad = useBottomChromePad();
  const { accessToken, activeProfileId } = useSession();
  const productId = route.params.productId;
  const screenW = Dimensions.get("window").width;

  const q = useQuery({
    queryKey: ["merchant-product-mine", activeProfileId, productId],
    queryFn: () =>
      fetchMerchantProduct(accessToken!, activeProfileId!, productId),
    enabled: Boolean(accessToken && activeProfileId && productId)
  });

  const product = q.data;
  const photos = useMemo(
    () => (product?.photoUrls ?? []).filter((url) => url.trim().length > 0),
    [product?.photoUrls]
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: product?.name?.trim() || t("navigation.screenTitles.merchantProduct")
    });
  }, [navigation, product?.name, t]);

  if (q.isLoading || !product) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={merchantColors.primary} />
      </View>
    );
  }

  const descriptionText = product.description?.trim();
  const unit = product.unitLabel?.trim();

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomChromePad + mobileSpacing.lg }
        ]}
        showsVerticalScrollIndicator={false}
        testID="merchant-my-product-detail-scroll"
      >
        <View style={styles.heroWrap}>
          {photos.length > 0 ? (
            <Image
              source={{ uri: photos[0] }}
              style={[styles.heroImg, { width: screenW }]}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.heroImg, styles.placeholder, { width: screenW }]}>
              <Ionicons name="cube-outline" size={56} color={merchantColors.textMuted} />
            </View>
          )}
          <View style={styles.statusPill}>
            <Text style={styles.statusTx}>{statusLabel(t, product.status)}</Text>
          </View>
        </View>

        <DetailCard style={styles.firstCard}>
          <Text style={styles.title}>{product.name}</Text>
          <Text style={styles.price}>
            {formatMarketMoney(product.price, product.currency || "XOF")}
            {unit ? ` / ${unit}` : ""}
          </Text>
          <Text style={styles.stock}>
            {t("merchant.products.stockLabel", { count: product.stock })}
          </Text>
          {product.categoryName ? (
            <Text style={styles.meta}>{product.categoryName}</Text>
          ) : null}
          {product.shopName ? (
            <Text style={styles.meta}>{product.shopName}</Text>
          ) : null}
        </DetailCard>

        <DetailCard>
          <DetailSectionLabel>
            {t("merchant.products.stats.title")}
          </DetailSectionLabel>
          <View style={styles.statsGrid}>
            <View style={styles.statCell}>
              <Ionicons name="eye-outline" size={20} color={merchantColors.primary} />
              <Text style={styles.statValue}>{product.viewCount ?? 0}</Text>
              <Text style={styles.statLabel}>
                {t("merchant.products.stats.views")}
              </Text>
            </View>
            <View style={styles.statCell}>
              <Ionicons name="heart-outline" size={20} color={merchantColors.primary} />
              <Text style={styles.statValue}>{product.favoriteCount ?? 0}</Text>
              <Text style={styles.statLabel}>
                {t("merchant.products.stats.likes")}
              </Text>
            </View>
            <View style={styles.statCell}>
              <Ionicons name="cart-outline" size={20} color={merchantColors.primary} />
              <Text style={styles.statValue}>{product.purchaseCount ?? 0}</Text>
              <Text style={styles.statLabel}>
                {t("merchant.products.stats.purchases")}
              </Text>
            </View>
            <View style={styles.statCell}>
              <Ionicons name="layers-outline" size={20} color={merchantColors.primary} />
              <Text style={styles.statValue}>{product.unitsSold ?? 0}</Text>
              <Text style={styles.statLabel}>
                {t("merchant.products.stats.unitsSold")}
              </Text>
            </View>
          </View>
          <Text style={styles.statsHint}>{t("merchant.products.stats.hint")}</Text>
        </DetailCard>

        <DetailCard>
          <DetailSectionLabel>{t("merchant.catalog.description")}</DetailSectionLabel>
          <Text style={styles.bodyText}>
            {descriptionText || t("merchant.catalog.noDescription")}
          </Text>
          {unit ? (
            <DetailRow
              label={t("merchant.product.fields.unit")}
              value={unit}
            />
          ) : null}
        </DetailCard>

        <Pressable
          style={styles.editBtn}
          onPress={() =>
            navigation.navigate("MerchantProductForm", {
              productId: product.id,
              shopId: product.shopId
            })
          }
          testID="merchant-my-product-detail-edit"
        >
          <Text style={styles.editBtnTx}>{t("merchant.products.edit")}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: mobileColors.surfaceMuted },
  scrollContent: { flexGrow: 1 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  heroWrap: { position: "relative" },
  heroImg: {
    height: HERO_HEIGHT,
    backgroundColor: merchantColors.primaryLight
  },
  placeholder: { alignItems: "center", justifyContent: "center" },
  statusPill: {
    position: "absolute",
    top: mobileSpacing.md,
    right: mobileSpacing.lg,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: merchantRadius.pill
  },
  statusTx: {
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
  bodyText: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    lineHeight: 22
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
  editBtn: {
    marginHorizontal: mobileSpacing.lg,
    marginTop: mobileSpacing.sm,
    backgroundColor: merchantColors.primary,
    padding: 14,
    borderRadius: merchantRadius.pill,
    alignItems: "center"
  },
  editBtnTx: { color: mobileColors.background, fontWeight: "700", fontSize: mobileFontSize.lg }
});
