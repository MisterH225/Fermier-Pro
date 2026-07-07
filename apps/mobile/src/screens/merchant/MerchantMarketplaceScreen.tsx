import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { MerchantMobileShell } from "../../components/layout/MerchantMobileShell";
import { useBottomInset } from "../../hooks/useBottomInset";
import { useSession } from "../../context/SessionContext";
import { fetchMerchantCatalog, fetchMerchantCategories } from "../../lib/api";
import { merchantColors, merchantRadius, merchantShadow } from "../../theme/merchantTheme";
import { mobileSpacing } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type SortKey = "recent" | "price_asc" | "price_desc" | "popular";

const SORTS: SortKey[] = ["recent", "price_asc", "price_desc", "popular"];

export function MerchantMarketplaceScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomInset = useBottomInset();
  const { accessToken } = useSession();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [sort, setSort] = useState<SortKey>("recent");
  const [debouncedQ, setDebouncedQ] = useState("");

  const catsQ = useQuery({
    queryKey: ["merchant-categories"],
    queryFn: () => fetchMerchantCategories(accessToken!),
    enabled: Boolean(accessToken)
  });

  const catalogQ = useInfiniteQuery({
    queryKey: ["merchant-catalog", categoryId, debouncedQ, sort],
    queryFn: ({ pageParam }) =>
      fetchMerchantCatalog(accessToken!, {
        categoryId,
        cursor: pageParam as string | undefined,
        q: debouncedQ || undefined,
        sort
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(accessToken)
  });

  const items = useMemo(
    () => catalogQ.data?.pages.flatMap((p) => p.items) ?? [],
    [catalogQ.data]
  );

  const header = (
    <View style={styles.header}>
      <Text style={styles.title}>{t("merchant.marketplace.title")}</Text>
      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={() => setDebouncedQ(search.trim())}
        placeholder={t("merchant.marketplace.search")}
        returnKeyType="search"
      />
      <View style={styles.filterRow}>
        <Pressable
          style={[styles.chip, !categoryId && styles.chipOn]}
          onPress={() => setCategoryId(undefined)}
        >
          <Text style={styles.chipTx}>{t("merchant.marketplace.allCategories")}</Text>
        </Pressable>
        {(catsQ.data ?? []).map((c) => (
          <Pressable
            key={c.id}
            style={[styles.chip, categoryId === c.id && styles.chipOn]}
            onPress={() => setCategoryId(c.id)}
          >
            <Text style={styles.chipTx}>{c.name}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.filterRow}>
        {SORTS.map((s) => (
          <Pressable
            key={s}
            style={[styles.chip, sort === s && styles.chipOn]}
            onPress={() => setSort(s)}
          >
            <Text style={styles.chipTx}>{t(`merchant.marketplace.sort.${s}`)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <MerchantMobileShell customHeader={header} omitBottomTabBar>
      {catalogQ.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={merchantColors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={{ padding: mobileSpacing.md, paddingBottom: bottomInset }}
          onEndReached={() => {
            if (catalogQ.hasNextPage && !catalogQ.isFetchingNextPage) {
              void catalogQ.fetchNextPage();
            }
          }}
          ListEmptyComponent={<Text style={styles.empty}>{t("merchant.catalog.empty")}</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.gridCard, merchantShadow.card]}
              onPress={() =>
                navigation.navigate("MerchantProductDetail", { productId: item.id })
              }
            >
              <Text style={styles.gridName} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={styles.gridPrice}>
                {item.price.toLocaleString("fr-FR")} {item.currency}
              </Text>
              <Text style={styles.gridMeta} numberOfLines={1}>
                {item.merchantName ?? ""}
              </Text>
            </Pressable>
          )}
        />
      )}
    </MerchantMobileShell>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.md,
    backgroundColor: merchantColors.canvas,
    gap: mobileSpacing.sm
  },
  title: { fontSize: 22, fontWeight: "800" },
  search: {
    borderWidth: 1,
    borderColor: merchantColors.border,
    borderRadius: merchantRadius.button,
    padding: mobileSpacing.sm,
    backgroundColor: merchantColors.cardBg
  },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: merchantRadius.pill,
    borderWidth: 1,
    borderColor: merchantColors.border,
    backgroundColor: merchantColors.cardBg
  },
  chipOn: { backgroundColor: merchantColors.primaryLight, borderColor: merchantColors.primary },
  chipTx: { fontSize: 12, fontWeight: "600" },
  gridRow: { gap: mobileSpacing.sm, marginBottom: mobileSpacing.sm },
  gridCard: {
    flex: 1,
    backgroundColor: merchantColors.cardBg,
    borderRadius: merchantRadius.card,
    padding: mobileSpacing.md,
    borderWidth: 1,
    borderColor: merchantColors.border,
    minHeight: 120
  },
  gridName: { fontWeight: "700", fontSize: 14 },
  gridPrice: { color: merchantColors.primary, fontWeight: "800", marginTop: 6 },
  gridMeta: { color: merchantColors.textSecondary, fontSize: 12, marginTop: 4 },
  empty: { textAlign: "center", marginTop: 40, color: merchantColors.textSecondary }
});
