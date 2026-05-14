import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from "react-native";
import { MarketplaceModuleGate } from "../components/MarketplaceModuleGate";
import { EventListFilter } from "../components/lists/EventListFilter";
import type { FilterPill } from "../components/lists/types";
import { useSession } from "../context/SessionContext";
import type { MarketplaceListingListItem } from "../lib/api";
import { fetchMarketplaceListings } from "../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing,
  mobileTypography
} from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "MarketplaceList">;

const LIST_BG = "#F5F5F5";
const PILL_ACTIVE = "#C2410C";

type CatKey = "all" | "piglet" | "breeder" | "butcher" | "reformed";

const CATEGORY_PILLS: { id: CatKey; label: string }[] = [
  { id: "all", label: "Tout" },
  { id: "piglet", label: "Porcelets" },
  { id: "breeder", label: "Reproducteurs" },
  { id: "butcher", label: "Charcutiers" },
  { id: "reformed", label: "Truies réformées" }
];

function parseNum(v: string | number | null | undefined): number | null {
  if (v === undefined || v === null) return null;
  const n = typeof v === "string" ? Number.parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatMoney(n: number, currency: string): string {
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} ${currency}`;
}

function isNewListing(publishedAt: string | null): boolean {
  if (!publishedAt) return false;
  const t = new Date(publishedAt).getTime();
  return Date.now() - t < 48 * 60 * 60 * 1000;
}

function categoryLabel(cat: string | null | undefined): string {
  switch (cat) {
    case "piglet":
      return "Porcelet";
    case "breeder":
      return "Reproducteur";
    case "butcher":
      return "Charcutier";
    case "reformed":
      return "Truie réformée";
    default:
      return "Lot";
  }
}

export function MarketplaceListScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const { accessToken, activeProfileId, clientFeatures } = useSession();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CatKey>("all");
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const cardW = useMemo(
    () => Math.floor((width - mobileSpacing.lg * 3) / 2),
    [width]
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Market",
      headerRight: clientFeatures.marketplace
        ? () => (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <TouchableOpacity
                onPress={() => navigation.navigate("MarketplaceMyListings")}
                style={{ paddingHorizontal: 6 }}
                hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
                  Mes annonces
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate("MarketplaceMyOffers")}
                style={{ paddingHorizontal: 6 }}
                hitSlop={{ top: 10, bottom: 10, left: 4, right: 8 }}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
                  Mes offres
                </Text>
              </TouchableOpacity>
            </View>
          )
        : undefined
    });
  }, [navigation, clientFeatures.marketplace]);

  const qTrim = search.trim();
  const searchParam = qTrim.length >= 2 ? qTrim : undefined;

  const listingsQuery = useQuery({
    queryKey: ["marketplaceListings", activeProfileId, category, searchParam],
    queryFn: () =>
      fetchMarketplaceListings(accessToken, activeProfileId, {
        mine: false,
        ...(category !== "all" ? { category } : {}),
        ...(searchParam ? { q: searchParam } : {})
      }),
    enabled: clientFeatures.marketplace
  });

  const err =
    listingsQuery.error instanceof Error
      ? listingsQuery.error.message
      : listingsQuery.error
        ? String(listingsQuery.error)
        : null;

  const pills: FilterPill[] = useMemo(
    () => CATEGORY_PILLS.map((p) => ({ id: p.id, label: p.label })),
    []
  );

  const toggleFav = (id: string) => {
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!clientFeatures.marketplace) {
    return (
      <MarketplaceModuleGate>
        <View />
      </MarketplaceModuleGate>
    );
  }

  if (listingsQuery.isPending) {
    return (
      <MarketplaceModuleGate>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={mobileColors.accent} />
        </View>
      </MarketplaceModuleGate>
    );
  }

  if (err) {
    return (
      <MarketplaceModuleGate>
        <View style={styles.centered}>
          <Text style={styles.error}>{err}</Text>
        </View>
      </MarketplaceModuleGate>
    );
  }

  const list = listingsQuery.data ?? [];
  const emptyMessage =
    list.length === 0
      ? "Aucune annonce publiée pour le moment."
      : "Aucun résultat. Essaie d’autres mots-clés ou filtres.";

  const renderCard = ({ item }: { item: MarketplaceListingListItem }) => {
    const photos = Array.isArray(item.photoUrls) ? item.photoUrls : [];
    const uri = typeof photos[0] === "string" && photos[0].length > 0 ? photos[0] : null;
    const wKg = parseNum(item.totalWeightKg);
    const pKg = parseNum(item.pricePerKg);
    const total = parseNum(item.totalPrice);
    const cur = item.currency || "XOF";
    const views = item.viewsCount ?? 0;
    const consults = item.consultationsCount ?? 0;
    const isNew = isNewListing(item.publishedAt ?? null);

    return (
      <TouchableOpacity
        style={[styles.card, { width: cardW }]}
        activeOpacity={0.92}
        onPress={() =>
          navigation.navigate("MarketplaceListingDetail", {
            listingId: item.id,
            headline: item.title
          })
        }
      >
        <View style={styles.photoWrap}>
          {uri ? (
            <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
          ) : (
            <View style={[styles.photo, styles.photoPh]}>
              <Text style={styles.photoPhTx}>📸</Text>
            </View>
          )}
          <View style={[styles.badgeCat, { maxWidth: cardW - 56 }]}>
            <Text style={styles.badgeCatTx} numberOfLines={1}>
              {categoryLabel(item.category)}
            </Text>
          </View>
          {isNew ? (
            <View style={styles.badgeNew}>
              <Text style={styles.badgeNewTx}>Nouveau</Text>
            </View>
          ) : null}
          <Pressable
            style={styles.favBtn}
            hitSlop={10}
            onPress={() => toggleFav(item.id)}
          >
            <Text style={styles.favTx}>{favorites[item.id] ? "❤️" : "🤍"}</Text>
          </Pressable>
        </View>
        <View style={styles.cardBody}>
          {wKg != null ? (
            <Text style={styles.lineMuted}>
              Poids total :{" "}
              {`${wKg.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg`}
            </Text>
          ) : (
            <Text style={styles.lineMuted}>Poids total : —</Text>
          )}
          {pKg != null ? (
            <Text style={styles.lineMuted}>Prix/kg : {formatMoney(pKg, cur)}</Text>
          ) : item.unitPrice != null ? (
            <Text style={styles.lineMuted}>
              Prix : {formatMoney(parseNum(item.unitPrice) ?? 0, cur)}
            </Text>
          ) : (
            <Text style={styles.lineMuted}>Prix/kg : —</Text>
          )}
          <Text style={styles.totalLine}>
            Prix total :{" "}
            {total != null
              ? formatMoney(total, cur)
              : pKg != null && wKg != null
                ? formatMoney(pKg * wKg, cur)
                : "—"}
          </Text>
          <View style={styles.statsRow}>
            <Text style={styles.statsTx}>👁 {views}</Text>
            <Text style={styles.statsTx}>💬 {consults}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <MarketplaceModuleGate>
      <View style={styles.root}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Ferme, lieu, race…"
            placeholderTextColor={mobileColors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.filterAdv}
            onPress={() => {}}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.filterAdvTx}>🎛️</Text>
          </TouchableOpacity>
        </View>
        <EventListFilter
          pills={pills}
          activeId={category}
          onChange={(id) => setCategory(id as CatKey)}
          activeBackground="#C2410C"
        />
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.colWrap}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={listingsQuery.isFetching}
              onRefresh={() => void listingsQuery.refetch()}
              tintColor={mobileColors.accent}
            />
          }
          ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>}
          renderItem={renderCard}
        />
      </View>
    </MarketplaceModuleGate>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LIST_BG,
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.sm
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: LIST_BG
  },
  error: { color: mobileColors.error, padding: mobileSpacing.lg },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    marginBottom: mobileSpacing.sm
  },
  search: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    ...mobileTypography.body,
    color: mobileColors.textPrimary
  },
  filterAdv: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  filterAdvTx: { fontSize: 20 },
  colWrap: {
    justifyContent: "space-between",
    marginBottom: mobileSpacing.md
  },
  listContent: {
    paddingBottom: mobileSpacing.xxl,
    paddingTop: mobileSpacing.xs
  },
  empty: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    textAlign: "center",
    marginTop: mobileSpacing.xl
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    ...mobileShadows.card
  },
  photoWrap: {
    position: "relative",
    height: 140,
    backgroundColor: "#E8E8E8"
  },
  photo: {
    width: "100%",
    height: 140,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16
  },
  photoPh: {
    alignItems: "center",
    justifyContent: "center"
  },
  photoPhTx: { fontSize: 36, opacity: 0.35 },
  badgeCat: {
    position: "absolute",
    left: 8,
    top: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  badgeCatTx: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700"
  },
  badgeNew: {
    position: "absolute",
    left: 8,
    bottom: 8,
    backgroundColor: PILL_ACTIVE,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  badgeNewTx: { color: "#fff", fontSize: 10, fontWeight: "800" },
  favBtn: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,215,128,0.95)",
    alignItems: "center",
    justifyContent: "center"
  },
  favTx: { fontSize: 16 },
  cardBody: {
    padding: mobileSpacing.sm
  },
  lineMuted: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  totalLine: {
    ...mobileTypography.body,
    fontWeight: "800",
    color: mobileColors.textPrimary,
    marginTop: mobileSpacing.xs
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: mobileSpacing.sm
  },
  statsTx: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  }
});
