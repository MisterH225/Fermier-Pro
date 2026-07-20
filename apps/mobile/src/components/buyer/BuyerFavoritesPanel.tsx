import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { ProfileSectionEmpty } from "../layout";
import { useSession } from "../../context/SessionContext";
import {
  fetchBuyerFavorites,
  removeBuyerFavorite,
  removeBuyerMerchantFavorite,
  type BuyerFavoriteListingDto
} from "../../lib/api";
import { getUserFacingError } from "../../lib/userFacingError";
import { buyerColors, buyerRadius, buyerShadow } from "../../theme/buyerTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

function photoUrl(item: BuyerFavoriteListingDto): string | null {
  const photos = item.photoUrls;
  if (!Array.isArray(photos) || photos.length === 0) return null;
  const first = photos[0];
  return typeof first === "string" && first.length > 0 ? first : null;
}

function isMerchantFavorite(item: BuyerFavoriteListingDto): boolean {
  return item.kind === "merchant";
}

function priceLabel(item: BuyerFavoriteListingDto): string | null {
  if (isMerchantFavorite(item)) {
    if (!item.totalPrice) return null;
    const currency = item.currency?.trim() || "XOF";
    return `${item.totalPrice} ${currency}`;
  }
  return item.pricePerKg ? `${item.pricePerKg} / kg` : null;
}

type Props = {
  onExplore?: () => void;
};

export function BuyerFavoritesPanel({ onExplore }: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken, activeProfileId } = useSession();
  const qc = useQueryClient();

  const favoritesQ = useQuery({
    queryKey: ["buyerFavorites", activeProfileId],
    queryFn: () => fetchBuyerFavorites(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const removeMut = useMutation({
    mutationFn: (item: BuyerFavoriteListingDto) => {
      if (isMerchantFavorite(item)) {
        return removeBuyerMerchantFavorite(
          accessToken!,
          activeProfileId,
          item.id
        );
      }
      return removeBuyerFavorite(accessToken!, activeProfileId, item.id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["buyerFavorites"] });
      void qc.invalidateQueries({ queryKey: ["buyerFavoritesList"] });
      void qc.invalidateQueries({ queryKey: ["buyerFavoriteIds"] });
      void qc.invalidateQueries({ queryKey: ["buyerDashboard"] });
    },
    onError: (e: Error) =>
      Alert.alert(t("buyer.favorites.errorTitle"), getUserFacingError(e, t))
  });

  const items = favoritesQ.data ?? [];

  if (favoritesQ.isLoading) {
    return <ActivityIndicator color={buyerColors.primary} style={styles.loader} />;
  }
  if (favoritesQ.error) {
    return (
      <ProfileSectionEmpty>
        {(favoritesQ.error as Error).message}
      </ProfileSectionEmpty>
    );
  }
  if (items.length === 0) {
    return (
      <View style={[styles.emptyCard, buyerShadow.card]}>
        <Text style={styles.emptyTitle}>{t("buyer.favorites.emptyTitle")}</Text>
        <Text style={styles.emptyBody}>{t("buyer.favorites.emptyBody")}</Text>
        <Pressable
          style={styles.exploreBtn}
          onPress={onExplore ?? (() => navigation.navigate("BuyerMarket"))}
        >
          <Text style={styles.exploreTx}>{t("buyer.favorites.explore")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {items.map((item) => {
        const uri = photoUrl(item);
        const merchant = isMerchantFavorite(item);
        const price = priceLabel(item);
        return (
          <Pressable
            key={item.favoriteId}
            style={[styles.card, buyerShadow.card]}
            onPress={() =>
              merchant
                ? navigation.navigate("MerchantProductDetail", {
                    productId: item.id
                  })
                : navigation.navigate("MarketplaceListingDetail", {
                    listingId: item.id,
                    headline: item.title
                  })
            }
          >
            <View style={styles.cardRow}>
              {uri ? (
                <Image source={{ uri }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPh]}>
                  <Ionicons
                    name="image-outline"
                    size={22}
                    color={buyerColors.textMuted}
                  />
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.cardMeta}>
                  {item.farmName ?? "—"}
                  {merchant ? ` · ${t("buyer.favorites.merchantBadge")}` : ""}
                </Text>
                {price ? <Text style={styles.cardPrice}>{price}</Text> : null}
              </View>
              <Pressable
                hitSlop={12}
                onPress={() => removeMut.mutate(item)}
                accessibilityLabel={t("buyer.favorites.remove")}
              >
                <Ionicons name="heart" size={24} color={buyerColors.primary} />
              </Pressable>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { marginVertical: mobileSpacing.lg },
  list: { gap: mobileSpacing.md },
  emptyCard: {
    backgroundColor: buyerColors.cardBg,
    borderRadius: buyerRadius.card,
    padding: mobileSpacing.lg,
    gap: mobileSpacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: buyerColors.border
  },
  emptyTitle: { ...mobileTypography.cardTitle, color: buyerColors.textPrimary },
  emptyBody: { ...mobileTypography.body, color: buyerColors.textSecondary },
  exploreBtn: {
    marginTop: mobileSpacing.sm,
    alignSelf: "flex-start",
    backgroundColor: buyerColors.primary,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: buyerRadius.button
  },
  exploreTx: { color: buyerColors.onPrimary, fontWeight: "700" },
  card: {
    backgroundColor: buyerColors.cardBg,
    borderRadius: buyerRadius.card,
    padding: mobileSpacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: buyerColors.border
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: mobileSpacing.sm },
  thumb: { width: 64, height: 64, borderRadius: buyerRadius.button },
  thumbPh: {
    backgroundColor: buyerColors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: {
    ...mobileTypography.body,
    fontWeight: "600",
    color: buyerColors.textPrimary
  },
  cardMeta: { ...mobileTypography.meta, color: buyerColors.textSecondary },
  cardPrice: {
    ...mobileTypography.meta,
    color: buyerColors.primary,
    fontWeight: "700"
  }
});
