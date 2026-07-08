import { Ionicons } from "@expo/vector-icons";
import { useLayoutEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  DetailCard,
  DetailRow,
  DetailSectionLabel
} from "../../components/marketplace/listingDetailUi";
import { useSession } from "../../context/SessionContext";
import { useBottomChromePad } from "../../hooks/useBottomInset";
import {
  confirmMerchantOrderPayment,
  ensureDirectChatRoom,
  fetchMerchantCatalogProduct,
  purchaseMerchantProduct
} from "../../lib/api";
import { formatApiError } from "../../lib/apiErrors";
import type { RootStackParamList } from "../../types/navigation";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { merchantColors, merchantRadius } from "../../theme/merchantTheme";

type Props = NativeStackScreenProps<RootStackParamList, "MerchantProductDetail">;

const HERO_HEIGHT = 280;

function ProductPhotoPlaceholder() {
  return (
    <View style={styles.photoPlaceholder}>
      <Ionicons name="cube-outline" size={56} color={merchantColors.textMuted} />
    </View>
  );
}

export function MerchantProductDetailScreen({ route }: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomChromePad = useBottomChromePad();
  const { accessToken } = useSession();
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);
  const screenW = Dimensions.get("window").width;

  const q = useQuery({
    queryKey: ["merchant-product", route.params.productId],
    queryFn: () => fetchMerchantCatalogProduct(accessToken!, route.params.productId),
    enabled: Boolean(accessToken)
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

  const onBuy = async () => {
    if (!accessToken || !product) return;
    const quantity = Number.parseInt(qty, 10);
    if (!Number.isFinite(quantity) || quantity < 1) return;
    setBusy(true);
    try {
      const init = await purchaseMerchantProduct(accessToken, product.id, {
        quantity,
        paymentMethod: "wallet"
      });
      await confirmMerchantOrderPayment(
        accessToken,
        init.orderId,
        init.providerRef
      );
      Alert.alert(t("merchant.purchase.success"));
    } catch (e) {
      Alert.alert(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const onContact = async () => {
    if (!accessToken || !product?.sellerUserId) return;
    try {
      const room = await ensureDirectChatRoom(
        accessToken,
        product.sellerUserId,
        undefined,
        undefined,
        product.id
      );
      navigation.navigate("ChatRoom", { roomId: room.id });
    } catch (e) {
      Alert.alert(formatApiError(e));
    }
  };

  if (q.isLoading || !product) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={mobileColors.accent} />
      </View>
    );
  }

  const descriptionText = product.description?.trim();
  const shopDescriptionText = product.shopDescription?.trim();

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomChromePad + 160 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroWrap}>
          {photos.length > 1 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              testID="merchant-product-detail-photos"
            >
              {photos.map((uri) => (
                <Image
                  key={uri}
                  source={{ uri }}
                  style={[styles.heroImg, { width: screenW }]}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          ) : photos.length === 1 ? (
            <Image
              source={{ uri: photos[0] }}
              style={[styles.heroImg, { width: screenW, height: HERO_HEIGHT }]}
              resizeMode="cover"
              testID="merchant-product-detail-photo"
            />
          ) : (
            <ProductPhotoPlaceholder />
          )}
          {product.categoryName ? (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeTx}>{product.categoryName}</Text>
            </View>
          ) : null}
        </View>

        <DetailCard style={styles.firstCard}>
          <Text style={styles.title}>{product.name}</Text>
          <Text style={styles.price}>
            {product.price.toLocaleString("fr-FR")} {product.currency}
          </Text>
          <Text style={styles.stock} testID="merchant-product-detail-stock">
            {t("merchant.catalog.stock", { count: product.stock })}
          </Text>
        </DetailCard>

        <DetailCard>
          <DetailSectionLabel>{t("merchant.catalog.description")}</DetailSectionLabel>
          <Text style={styles.bodyText}>
            {descriptionText || t("merchant.catalog.noDescription")}
          </Text>
        </DetailCard>

        <DetailCard>
          <DetailSectionLabel>{t("merchant.catalog.shopSection")}</DetailSectionLabel>
          {product.shopName ? (
            <DetailRow
              label={t("merchant.catalog.shopName")}
              value={product.shopName}
            />
          ) : null}
          {product.merchantName ? (
            <DetailRow
              label={t("merchant.catalog.seller")}
              value={product.merchantName}
            />
          ) : null}
          {product.shopLocation ? (
            <View style={styles.locationRow}>
              <Ionicons
                name="location-outline"
                size={16}
                color={merchantColors.primary}
              />
              <View style={styles.locationText}>
                <Text style={styles.rowLabel}>{t("merchant.catalog.location")}</Text>
                <Text style={styles.rowValue}>{product.shopLocation}</Text>
              </View>
            </View>
          ) : null}
          {shopDescriptionText ? (
            <View style={styles.shopAboutBlock}>
              <Text style={styles.rowLabel}>{t("merchant.catalog.shopAbout")}</Text>
              <Text style={styles.bodyText}>{shopDescriptionText}</Text>
            </View>
          ) : null}
        </DetailCard>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomChromePad }]}>
        <Text style={styles.qtyLabel}>{t("merchant.purchase.quantity")}</Text>
        <TextInput
          style={styles.input}
          value={qty}
          onChangeText={setQty}
          keyboardType="number-pad"
          placeholder="1"
          testID="merchant-product-detail-quantity"
        />
        <Pressable
          style={[styles.btn, busy && styles.btnDisabled]}
          onPress={() => void onBuy()}
          disabled={busy}
          testID="merchant-product-detail-buy"
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnTx}>{t("merchant.purchase.buy")}</Text>
          )}
        </Pressable>
        <Pressable
          style={styles.secondary}
          onPress={() => void onContact()}
          testID="merchant-product-detail-contact"
        >
          <Text style={styles.secondaryTx}>{t("merchant.purchase.contact")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: mobileColors.surfaceMuted },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  heroWrap: {
    position: "relative",
    backgroundColor: mobileColors.surfaceMuted
  },
  heroImg: {
    height: HERO_HEIGHT,
    backgroundColor: mobileColors.surfaceMuted
  },
  photoPlaceholder: {
    height: HERO_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: merchantColors.primaryLight
  },
  categoryBadge: {
    position: "absolute",
    left: mobileSpacing.lg,
    bottom: mobileSpacing.md,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: merchantRadius.pill
  },
  categoryBadgeTx: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12
  },
  firstCard: {
    marginTop: mobileSpacing.md
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: mobileColors.textPrimary,
    marginBottom: mobileSpacing.xs
  },
  price: {
    fontSize: 22,
    fontWeight: "800",
    color: merchantColors.primary,
    marginBottom: mobileSpacing.xs
  },
  stock: {
    fontSize: 14,
    fontWeight: "600",
    color: merchantColors.textSecondary
  },
  bodyText: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    lineHeight: 22
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing.sm,
    marginTop: mobileSpacing.sm
  },
  locationText: {
    flex: 1,
    gap: 2
  },
  rowLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  rowValue: {
    color: mobileColors.textPrimary,
    fontWeight: "600",
    fontSize: 15
  },
  shopAboutBlock: {
    marginTop: mobileSpacing.md,
    gap: mobileSpacing.xs
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.md,
    backgroundColor: mobileColors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mobileColors.border,
    gap: mobileSpacing.sm
  },
  qtyLabel: {
    ...mobileTypography.meta,
    fontWeight: "600",
    color: mobileColors.textSecondary
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: 12,
    backgroundColor: "#fff",
    fontSize: 16
  },
  btn: {
    backgroundColor: merchantColors.primary,
    padding: 14,
    borderRadius: merchantRadius.pill,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center"
  },
  btnDisabled: { opacity: 0.7 },
  btnTx: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondary: { alignItems: "center", paddingVertical: mobileSpacing.sm },
  secondaryTx: { color: merchantColors.primary, fontWeight: "600" }
});
