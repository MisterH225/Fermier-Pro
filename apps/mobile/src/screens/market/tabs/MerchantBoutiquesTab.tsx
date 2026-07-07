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
import { useSession } from "../../../context/SessionContext";
import { fetchMerchantCatalog, fetchMerchantCategories } from "../../../lib/api";
import { mobileColors, mobileRadius, mobileShadows, mobileSpacing } from "../../../theme/mobileTheme";
import type { RootStackParamList } from "../../../types/navigation";

type SortKey = "recent" | "price_asc" | "price_desc" | "popular";

const SORTS: SortKey[] = ["recent", "price_asc", "price_desc", "popular"];

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
  contentPaddingBottom: number;
};

export function MerchantBoutiquesTab({ navigation, contentPaddingBottom }: Props) {
  const { t } = useTranslation();
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

  const listHeader = (
    <View style={styles.header}>
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
          <Text style={[styles.chipTx, !categoryId && styles.chipTxOn]}>
            {t("merchant.marketplace.allCategories")}
          </Text>
        </Pressable>
        {(catsQ.data ?? []).map((c) => (
          <Pressable
            key={c.id}
            style={[styles.chip, categoryId === c.id && styles.chipOn]}
            onPress={() => setCategoryId(c.id)}
          >
            <Text style={[styles.chipTx, categoryId === c.id && styles.chipTxOn]}>
              {c.name}
            </Text>
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
            <Text style={[styles.chipTx, sort === s && styles.chipTxOn]}>
              {t(`merchant.marketplace.sort.${s}`)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  if (catalogQ.isLoading && !catalogQ.data) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={mobileColors.accent} />
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={styles.gridRow}
      ListHeaderComponent={listHeader}
      contentContainerStyle={{
        padding: mobileSpacing.md,
        paddingBottom: contentPaddingBottom
      }}
      onEndReached={() => {
        if (catalogQ.hasNextPage && !catalogQ.isFetchingNextPage) {
          void catalogQ.fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.4}
      ListFooterComponent={
        catalogQ.isFetchingNextPage ? (
          <ActivityIndicator style={{ marginVertical: 12 }} color={mobileColors.accent} />
        ) : null
      }
      ListEmptyComponent={<Text style={styles.empty}>{t("merchant.catalog.empty")}</Text>}
      renderItem={({ item }) => (
        <Pressable
          style={[styles.gridCard, mobileShadows.card]}
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
          <Text style={styles.gridStock}>
            {t("merchant.catalog.stock", { count: item.stock })}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 200 },
  header: { gap: mobileSpacing.sm, marginBottom: mobileSpacing.sm },
  search: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.sm,
    backgroundColor: "#fff"
  },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border,
    backgroundColor: "#fff"
  },
  chipOn: { borderColor: mobileColors.accent, backgroundColor: "#E8F5EE" },
  chipTx: { fontSize: 12, fontWeight: "600", color: mobileColors.textSecondary },
  chipTxOn: { color: mobileColors.accent },
  gridRow: { gap: mobileSpacing.sm, marginBottom: mobileSpacing.sm },
  gridCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    borderWidth: 1,
    borderColor: mobileColors.border,
    minHeight: 120
  },
  gridName: { fontWeight: "700", fontSize: 14 },
  gridPrice: { color: mobileColors.accent, fontWeight: "800", marginTop: 6 },
  gridMeta: { color: mobileColors.textSecondary, fontSize: 12, marginTop: 4 },
  gridStock: { fontSize: 11, color: mobileColors.textSecondary, marginTop: 2 },
  empty: { textAlign: "center", marginTop: 40, color: mobileColors.textSecondary }
});
