import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
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
import { useSession } from "../../context/SessionContext";
import {
  confirmMerchantOrderPayment,
  ensureDirectChatRoom,
  fetchMerchantCatalogProduct,
  purchaseMerchantProduct
} from "../../lib/api";
import { formatApiError } from "../../lib/apiErrors";
import type { RootStackParamList } from "../../types/navigation";
import { mobileColors, mobileSpacing } from "../../theme/mobileTheme";
import { merchantColors } from "../../theme/merchantTheme";

type Props = NativeStackScreenProps<RootStackParamList, "MerchantProductDetail">;

export function MerchantProductDetailScreen({ route }: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken } = useSession();
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["merchant-product", route.params.productId],
    queryFn: () => fetchMerchantCatalogProduct(accessToken!, route.params.productId),
    enabled: Boolean(accessToken)
  });

  const product = q.data;

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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{product.name}</Text>
        <Text style={styles.price}>
          {product.price.toLocaleString("fr-FR")} {product.currency}
        </Text>
        <Text style={styles.desc}>{product.description}</Text>
        <Text style={styles.meta}>{product.merchantName}</Text>
        <TextInput
          style={styles.input}
          value={qty}
          onChangeText={setQty}
          keyboardType="number-pad"
          placeholder={t("merchant.purchase.quantity")}
        />
        <Pressable style={styles.btn} onPress={() => void onBuy()} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTx}>{t("merchant.purchase.buy")}</Text>}
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => void onContact()}>
          <Text style={styles.secondaryTx}>{t("merchant.purchase.contact")}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: mobileColors.background },
  scroll: { padding: mobileSpacing.lg, gap: mobileSpacing.md },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "800" },
  price: { fontSize: 18, fontWeight: "700", color: merchantColors.primary },
  desc: { color: mobileColors.textSecondary },
  meta: { fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff"
  },
  btn: {
    backgroundColor: merchantColors.primary,
    padding: 14,
    borderRadius: 10,
    alignItems: "center"
  },
  btnTx: { color: "#fff", fontWeight: "700" },
  secondary: { alignItems: "center", padding: 12 },
  secondaryTx: { color: merchantColors.primary, fontWeight: "600" }
});
