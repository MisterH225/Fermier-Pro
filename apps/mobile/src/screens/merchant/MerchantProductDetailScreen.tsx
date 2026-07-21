import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
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
  MarketplacePaymentMethodPicker,
  type MarketplacePaymentMethodChoice
} from "../../components/buyer/MarketplacePaymentMethodPicker";
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
  fetchMerchantCatalogOrder,
  fetchMerchantCatalogProduct,
  fetchUserWallet,
  purchaseMerchantProduct
} from "../../lib/api";
import { formatApiError } from "../../lib/apiErrors";
import { openPaymentCheckout } from "../../lib/paymentCheckout";
import type { RootStackParamList } from "../../types/navigation";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { merchantColors, merchantRadius } from "../../theme/merchantTheme";

type Props = NativeStackScreenProps<RootStackParamList, "MerchantProductDetail">;

const HERO_HEIGHT = 280;

type PendingPayment = {
  orderId: string;
  providerRef: string;
  paymentUrl: string | null;
};

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
  const { accessToken, clientFeatures } = useSession();
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);
  const [paymentMethod, setPaymentMethod] =
    useState<MarketplacePaymentMethodChoice>("mobile_money");
  const userPickedPaymentMethod = useRef(false);
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
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

  const quantity = Number.parseInt(qty, 10);
  const totalAmount =
    product && Number.isFinite(quantity) && quantity >= 1
      ? Math.round(product.price * quantity)
      : 0;

  const walletQ = useQuery({
    queryKey: ["user-wallet", "merchant-product-detail"],
    queryFn: () => fetchUserWallet(accessToken!),
    enabled: Boolean(accessToken && clientFeatures.wallet)
  });

  const walletBalance = Number(walletQ.data?.balance ?? 0);
  const walletEnabled = clientFeatures.wallet;
  const canPayWithWallet = walletEnabled && walletBalance >= totalAmount;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: product?.name?.trim() || t("navigation.screenTitles.merchantProduct")
    });
  }, [navigation, product?.name, t]);

  useEffect(() => {
    if (userPickedPaymentMethod.current) {
      return;
    }
    setPaymentMethod("mobile_money");
  }, [totalAmount]);

  useEffect(() => {
    if (paymentMethod === "wallet" && !canPayWithWallet) {
      setPaymentMethod("mobile_money");
    }
  }, [paymentMethod, canPayWithWallet]);

  const completePurchase = useCallback(
    (orderId: string) => {
      setPendingPayment(null);
      void q.refetch();
      Alert.alert(t("merchant.purchase.success"), t("merchant.purchase.trackHint"), [
        { text: t("common.ok"), style: "cancel" },
        {
          text: t("merchant.purchase.trackCta"),
          onPress: () =>
            navigation.navigate("MerchantOrderDetail", { orderId })
        }
      ]);
    },
    [navigation, q, t]
  );

  const trySilentConfirm = useCallback(async () => {
    if (!accessToken || !pendingPayment) {
      return;
    }
    try {
      const order = await confirmMerchantOrderPayment(
        accessToken,
        pendingPayment.orderId,
        pendingPayment.providerRef
      );
      if (order.status === "paid" || order.status === "completed") {
        completePurchase(order.id);
      }
    } catch {
      // Webhook ou prochain poll confirmera la commande.
    }
  }, [accessToken, pendingPayment, completePurchase]);

  const syncPaymentStatus = useCallback(async () => {
    if (!accessToken || !pendingPayment) {
      return;
    }
    try {
      const order = await fetchMerchantCatalogOrder(
        accessToken,
        pendingPayment.orderId
      );
      if (order.status === "paid" || order.status === "completed") {
        completePurchase(order.id);
        return;
      }
    } catch {
      // ignore
    }
    await trySilentConfirm();
  }, [accessToken, pendingPayment, completePurchase, trySilentConfirm]);

  useEffect(() => {
    if (!pendingPayment) {
      return;
    }
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void syncPaymentStatus();
      }
    });
    return () => sub.remove();
  }, [pendingPayment, syncPaymentStatus]);

  useEffect(() => {
    if (!pendingPayment) {
      return;
    }
    const timer = setInterval(() => {
      void syncPaymentStatus();
    }, 5_000);
    return () => clearInterval(timer);
  }, [pendingPayment, syncPaymentStatus]);

  const onBuy = async () => {
    if (!accessToken || !product) return;
    if (!Number.isFinite(quantity) || quantity < 1) return;
    if (paymentMethod === "wallet" && !canPayWithWallet) {
      return;
    }
    setBusy(true);
    try {
      const init = await purchaseMerchantProduct(accessToken, product.id, {
        quantity,
        paymentMethod
      });
      if (paymentMethod === "mobile_money") {
        setPendingPayment({
          orderId: init.orderId,
          providerRef: init.providerRef,
          paymentUrl: init.paymentUrl
        });
        setBusy(false);
        if (init.paymentUrl) {
          await openPaymentCheckout(init.paymentUrl);
        } else {
          Alert.alert(t("common.error"), t("merchant.purchase.paymentLinkMissing"));
        }
        return;
      }
      const order = await confirmMerchantOrderPayment(
        accessToken,
        init.orderId,
        init.providerRef
      );
      if (order.status === "paid" || order.status === "completed") {
        completePurchase(order.id);
      }
    } catch (e) {
      Alert.alert(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const openPaymentLink = async () => {
    if (!pendingPayment?.paymentUrl) {
      Alert.alert(t("common.error"), t("merchant.purchase.paymentLinkMissing"));
      return;
    }
    await openPaymentCheckout(pendingPayment.paymentUrl);
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

  if (pendingPayment) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <View style={styles.waitingWrap}>
          <ActivityIndicator size="large" color={merchantColors.primary} />
          <Text style={styles.waitingTitle}>
            {t("merchant.purchase.paymentWaitingTitle")}
          </Text>
          <Text style={styles.waitingBody}>
            {t("merchant.purchase.paymentWaitingBody")}
          </Text>
        </View>
        <View style={[styles.pendingActions, { paddingBottom: bottomChromePad }]}>
          {pendingPayment.paymentUrl ? (
            <Pressable
              style={styles.btn}
              onPress={() => void openPaymentLink()}
              testID="merchant-product-detail-reopen-payment"
            >
              <Text style={styles.btnTx}>{t("merchant.purchase.reopenPaymentCta")}</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.secondary}
            onPress={() => setPendingPayment(null)}
            testID="merchant-product-detail-cancel-payment"
          >
            <Text style={styles.secondaryTx}>{t("common.cancel")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const descriptionText = product.description?.trim();
  const shopDescriptionText = product.shopDescription?.trim();

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomChromePad + mobileSpacing.lg }
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          testID="merchant-product-detail-scroll"
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
            {product.unitLabel?.trim()
              ? ` / ${product.unitLabel.trim()}`
              : ""}
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

          <DetailCard style={styles.purchaseCard}>
            <DetailSectionLabel>{t("merchant.purchase.quantity")}</DetailSectionLabel>
            <TextInput
              style={styles.input}
              value={qty}
              onChangeText={setQty}
              keyboardType="number-pad"
              placeholder="1"
              testID="merchant-product-detail-quantity"
            />
            {totalAmount > 0 ? (
              <View style={styles.paymentBlock}>
                <MarketplacePaymentMethodPicker
                  amount={totalAmount}
                  currency={product.currency}
                  walletBalance={walletBalance}
                  value={paymentMethod}
                  onChange={(method) => {
                    userPickedPaymentMethod.current = true;
                    setPaymentMethod(method);
                  }}
                  walletEnabled={walletEnabled}
                />
                <Text style={styles.escrowHint}>
                  {t("merchant.purchase.escrowHint")}
                </Text>
              </View>
            ) : null}
            <Pressable
              style={[
                styles.btn,
                (busy || (paymentMethod === "wallet" && !canPayWithWallet)) &&
                  styles.btnDisabled
              ]}
              onPress={() => void onBuy()}
              disabled={busy || (paymentMethod === "wallet" && !canPayWithWallet)}
              testID="merchant-product-detail-buy"
            >
              {busy ? (
                <ActivityIndicator color={mobileColors.background} />
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
          </DetailCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: mobileColors.surfaceMuted },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  waitingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: mobileSpacing.lg,
    gap: mobileSpacing.md
  },
  waitingTitle: {
    fontSize: mobileFontSize.xl,
    fontWeight: "800",
    color: mobileColors.textPrimary,
    textAlign: "center"
  },
  waitingBody: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    textAlign: "center",
    lineHeight: 22
  },
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
    color: mobileColors.background,
    fontWeight: "700",
    fontSize: mobileFontSize.sm
  },
  firstCard: {
    marginTop: mobileSpacing.md
  },
  purchaseCard: {
    gap: mobileSpacing.sm
  },
  paymentBlock: {
    gap: mobileSpacing.sm
  },
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
    marginBottom: mobileSpacing.xs
  },
  stock: {
    fontSize: mobileFontSize.md,
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
    fontSize: mobileFontSize.md
  },
  shopAboutBlock: {
    marginTop: mobileSpacing.md,
    gap: mobileSpacing.xs
  },
  pendingActions: {
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.md,
    backgroundColor: mobileColors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mobileColors.border,
    gap: mobileSpacing.sm
  },
  escrowHint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    lineHeight: 18
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: 12,
    backgroundColor: mobileColors.background,
    fontSize: mobileFontSize.lg
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
  btnTx: { color: mobileColors.background, fontWeight: "700", fontSize: mobileFontSize.lg },
  secondary: { alignItems: "center", paddingVertical: mobileSpacing.sm },
  secondaryTx: { color: merchantColors.primary, fontWeight: "600" }
});
