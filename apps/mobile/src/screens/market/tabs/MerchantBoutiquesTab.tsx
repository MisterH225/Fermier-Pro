import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSession } from "../../../context/SessionContext";
import { fetchMerchantCatalog } from "../../../lib/api";
import { mobileColors, mobileSpacing } from "../../../theme/mobileTheme";
import type { RootStackParamList } from "../../../types/navigation";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
  contentPaddingBottom: number;
};

export function MerchantBoutiquesTab({ navigation, contentPaddingBottom }: Props) {
  const { t } = useTranslation();
  const { accessToken } = useSession();
  const q = useQuery({
    queryKey: ["merchant-catalog"],
    queryFn: () => fetchMerchantCatalog(accessToken!),
    enabled: Boolean(accessToken)
  });

  if (q.isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={mobileColors.accent} />
      </View>
    );
  }

  return (
    <FlatList
      data={q.data?.items ?? []}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingBottom: contentPaddingBottom, padding: mobileSpacing.md }}
      ListEmptyComponent={<Text>{t("merchant.catalog.empty")}</Text>}
      renderItem={({ item }) => (
        <Pressable
          style={styles.card}
          onPress={() =>
            navigation.navigate("MerchantProductDetail", { productId: item.id })
          }
        >
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>
            {item.merchantName ?? ""} · {item.price.toLocaleString("fr-FR")} {item.currency}
          </Text>
          <Text style={styles.stock}>
            {t("merchant.catalog.stock", { count: item.stock })}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 200 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.sm,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  name: { fontWeight: "700", fontSize: 16 },
  meta: { color: mobileColors.textSecondary, marginTop: 4 },
  stock: { marginTop: 4, color: mobileColors.accent }
});
