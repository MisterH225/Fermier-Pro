import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MerchantOnboardingNudgeBanner } from "../../components/merchant/MerchantOnboardingNudgeBanner";
import { useSession } from "../../context/SessionContext";
import {
  fetchMerchantMe,
  fetchMerchantProducts,
  fetchMerchantSellerOrders
} from "../../lib/api";
import type { RootStackParamList } from "../../types/navigation";
import { mobileColors, mobileSpacing } from "../../theme/mobileTheme";

export function MerchantDashboardScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken, activeProfileId } = useSession();

  const meQ = useQuery({
    queryKey: ["merchant-me", activeProfileId],
    queryFn: () => fetchMerchantMe(accessToken!, activeProfileId!),
    enabled: Boolean(accessToken && activeProfileId)
  });

  const productsQ = useQuery({
    queryKey: ["merchant-products", activeProfileId],
    queryFn: () => fetchMerchantProducts(accessToken!, activeProfileId!),
    enabled: Boolean(accessToken && activeProfileId)
  });

  const ordersQ = useQuery({
    queryKey: ["merchant-orders-seller", activeProfileId],
    queryFn: () => fetchMerchantSellerOrders(accessToken!, activeProfileId!),
    enabled: Boolean(accessToken && activeProfileId)
  });

  const me = meQ.data;

  if (meQ.isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={mobileColors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t("merchant.dashboard.title")}</Text>
        <Text style={styles.meta}>
          {t("merchant.dashboard.tier", {
            tier: me?.subscriptionTier ?? t("merchant.dashboard.tierNone")
          })}
        </Text>

        {me?.needsShopNudge ? (
          <MerchantOnboardingNudgeBanner
            variant="shop"
            onPress={() => navigation.navigate("MerchantShop")}
          />
        ) : null}
        {me?.needsProductNudge ? (
          <MerchantOnboardingNudgeBanner
            variant="product"
            onPress={() => navigation.navigate("MerchantProductForm")}
          />
        ) : null}

        <Pressable
          style={styles.card}
          onPress={() => navigation.navigate("MerchantShop")}
        >
          <Text style={styles.cardTitle}>{t("merchant.dashboard.shops")}</Text>
          <Text>{me?.shopCount ?? 0}</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("merchant.dashboard.products")}</Text>
          <FlatList
            data={productsQ.data ?? []}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ListEmptyComponent={
              <Text>{t("merchant.dashboard.noProducts")}</Text>
            }
            renderItem={({ item }) => (
              <Text>
                {item.name} — {item.status} — {item.stock} {t("merchant.dashboard.stock")}
              </Text>
            )}
          />
          <Pressable onPress={() => navigation.navigate("MerchantProductForm")}>
            <Text style={styles.link}>{t("merchant.dashboard.addProduct")}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("merchant.dashboard.orders")}</Text>
          {(ordersQ.data as Array<{ id: string; productName?: string; status: string }> | undefined)?.map(
            (o) => (
              <Text key={o.id}>
                {o.productName ?? o.id} — {o.status}
              </Text>
            )
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: mobileColors.background },
  scroll: { padding: mobileSpacing.lg, gap: mobileSpacing.md },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "800" },
  meta: { color: mobileColors.textSecondary },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: mobileSpacing.md,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  cardTitle: { fontWeight: "700", marginBottom: 8 },
  link: { color: mobileColors.accent, fontWeight: "600", marginTop: 8 }
});
