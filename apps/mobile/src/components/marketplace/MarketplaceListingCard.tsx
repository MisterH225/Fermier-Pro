import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { isFlatPriceListing } from "./listingPricing";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import type { MarketplaceListingListItem } from "../../lib/api";
import { formatMarketMoney } from "../../lib/formatMoney";
import { ListingImage } from "./ListingImage";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

export function parseMarketNum(
  v: string | number | null | undefined
): number | null {
  if (v === undefined || v === null) return null;
  const n = typeof v === "string" ? Number.parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
}

export { formatMarketMoney } from "../../lib/formatMoney";

export function isNewListing(publishedAt: string | null): boolean {
  if (!publishedAt) return false;
  return Date.now() - new Date(publishedAt).getTime() < 48 * 60 * 60 * 1000;
}

export function isListingExpired(
  status: string,
  expiresAt: string | null | undefined
): boolean {
  if (status === "expired") return true;
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

type Props = {
  item: MarketplaceListingListItem;
  width: number;
  onPress: () => void;
  showFavorite?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  farmRating?: number | null;
  style?: StyleProp<ViewStyle>;
};

export function MarketplaceListingCard({
  item,
  width,
  onPress,
  showFavorite,
  isFavorite,
  onToggleFavorite,
  farmRating,
  style
}: Props) {
  const { t } = useTranslation();
  const wKg = parseMarketNum(item.totalWeightKg);
  const pKg = parseMarketNum(item.pricePerKg);
  const total = parseMarketNum(item.totalPrice);
  const cur = item.currency || "XOF";
  const views = item.viewsCount ?? 0;
  const consults = item.consultationsCount ?? 0;
  const isNew = isNewListing(item.publishedAt ?? null);
  const expired = isListingExpired(item.status, item.expiresAt);
  const sold = item.status === "sold";

  const totalDisplay =
    total != null
      ? formatMarketMoney(total, cur)
      : pKg != null && wKg != null
        ? formatMarketMoney(pKg * wKg, cur)
        : "—";

  const categoryKey = item.category ?? "unknown";
  const flatPrice = isFlatPriceListing(item.category);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { width },
        pressed && { opacity: 0.92 },
        style
      ]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.photoWrap}>
        <ListingImage
          photos={item.photoUrls}
          fallbackPhotoUrl={item.fallbackPhotoUrl}
          animal={item.animal}
          height={Math.round(width / 1.15)}
          borderRadius={{
            topLeft: mobileRadius.lg,
            topRight: mobileRadius.lg
          }}
        />
        <View style={[styles.badgeCat, { maxWidth: width - 56 }]}>
          <Text style={styles.badgeCatTx} numberOfLines={1}>
            {t(`marketScreen.categories.${categoryKey}`, {
              defaultValue: t("marketScreen.categories.unknown")
            })}
          </Text>
        </View>
        {sold ? (
          <View style={styles.badgeSold}>
            <Text style={styles.badgeSoldTx}>{t("marketScreen.badgeSold")}</Text>
          </View>
        ) : expired ? (
          <View style={styles.badgeExpired}>
            <Text style={styles.badgeExpiredTx}>
              {t("marketScreen.badgeExpired")}
            </Text>
          </View>
        ) : isNew ? (
          <View style={styles.badgeNew}>
            <Text style={styles.badgeNewTx}>{t("marketScreen.badgeNew")}</Text>
          </View>
        ) : null}
        {!sold && (item.activeOfferCount ?? 0) >= 1 ? (
          <View style={styles.badgeOffers}>
            <Text style={styles.badgeOffersTx}>
              {t("marketScreen.badgeActiveOffers", {
                count: item.activeOfferCount
              })}
            </Text>
          </View>
        ) : null}
        {showFavorite ? (
          <Pressable
            style={styles.favBtn}
            hitSlop={10}
            onPress={(e) => {
              e.stopPropagation?.();
              onToggleFavorite?.();
            }}
          >
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={18}
              color={isFavorite ? mobileColors.error : mobileColors.textPrimary}
            />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        {item.farm?.name ? (
          <Text style={styles.farmLine} numberOfLines={1}>
            {item.farm.name}
            {item.locationLabel ? ` · ${item.locationLabel}` : ""}
          </Text>
        ) : item.locationLabel ? (
          <Text style={styles.farmLine} numberOfLines={1}>
            {item.locationLabel}
          </Text>
        ) : null}
        {farmRating != null && farmRating > 0 ? (
          <Text style={styles.ratingLine}>
            ⭐ {farmRating.toFixed(1)}
          </Text>
        ) : null}
        {wKg != null ? (
          <Text style={styles.lineMuted}>
            {t("marketScreen.totalWeight")}{" "}
            {`${wKg.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg`}
          </Text>
        ) : null}
        {flatPrice && total != null ? (
          <Text style={styles.lineMuted}>
            {t("marketScreen.flatPriceLabel")}
          </Text>
        ) : pKg != null ? (
          <Text style={styles.lineMuted}>
            {t("marketScreen.pricePerKg")} {formatMarketMoney(pKg, cur)}
          </Text>
        ) : parseMarketNum(item.unitPrice) != null ? (
          <Text style={styles.lineMuted}>
            {t("marketScreen.price")}{" "}
            {formatMarketMoney(parseMarketNum(item.unitPrice)!, cur)}
          </Text>
        ) : null}
        <Text style={styles.totalLine}>
          {t("marketScreen.totalPrice")} {totalDisplay}
        </Text>
        <View style={styles.statsRow}>
          <Text style={styles.statsTx}>👁 {views}</Text>
          <Text style={styles.statsTx}>💬 {consults}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function MarketplaceListingCardSkeleton({ width }: { width: number }) {
  return (
    <View style={[styles.card, styles.skeleton, { width }]}>
      <View style={[styles.skeletonPhoto, styles.skeletonBlock]} />
      <View style={styles.cardBody}>
        <View style={[styles.skeletonLine, { width: "85%" }]} />
        <View style={[styles.skeletonLine, { width: "60%", marginTop: 8 }]} />
        <View style={[styles.skeletonLine, { width: "70%", marginTop: 12 }]} />
        <View style={[styles.skeletonLine, { width: "50%", marginTop: 8 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    overflow: "hidden",
    ...mobileShadows.card
  },
  photoWrap: { position: "relative" },
  badgeCat: {
    position: "absolute",
    top: mobileSpacing.sm,
    left: mobileSpacing.sm,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: mobileRadius.sm
  },
  badgeCatTx: {
    ...mobileTypography.meta,
    color: mobileColors.onAccent,
    fontWeight: "600",
    fontSize: 11
  },
  badgeNew: {
    position: "absolute",
    top: mobileSpacing.sm,
    right: mobileSpacing.sm,
    backgroundColor: mobileColors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: mobileRadius.sm
  },
  badgeNewTx: {
    ...mobileTypography.meta,
    color: mobileColors.onAccent,
    fontWeight: "700",
    fontSize: 11
  },
  badgeOffers: {
    position: "absolute",
    bottom: mobileSpacing.sm,
    left: mobileSpacing.sm,
    backgroundColor: "#D97706",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: mobileRadius.sm,
    maxWidth: "70%"
  },
  badgeOffersTx: {
    ...mobileTypography.meta,
    color: mobileColors.onAccent,
    fontWeight: "700",
    fontSize: 11
  },
  badgeSold: {
    position: "absolute",
    top: mobileSpacing.sm,
    right: mobileSpacing.sm,
    backgroundColor: mobileColors.textSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: mobileRadius.sm
  },
  badgeSoldTx: {
    ...mobileTypography.meta,
    color: mobileColors.onAccent,
    fontWeight: "700",
    fontSize: 11
  },
  badgeExpired: {
    position: "absolute",
    top: mobileSpacing.sm,
    right: mobileSpacing.sm,
    backgroundColor: mobileColors.error,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: mobileRadius.sm
  },
  badgeExpiredTx: {
    ...mobileTypography.meta,
    color: mobileColors.onAccent,
    fontWeight: "700",
    fontSize: 11
  },
  favBtn: {
    position: "absolute",
    bottom: mobileSpacing.sm,
    right: mobileSpacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: mobileColors.background,
    alignItems: "center",
    justifyContent: "center"
  },
  cardBody: {
    padding: mobileSpacing.sm,
    gap: 2
  },
  title: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    lineHeight: 18
  },
  farmLine: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontSize: 12
  },
  ratingLine: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontSize: 12
  },
  lineMuted: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontSize: 12
  },
  totalLine: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    marginTop: 2
  },
  statsRow: {
    flexDirection: "row",
    gap: mobileSpacing.sm,
    marginTop: 4
  },
  statsTx: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontSize: 11
  },
  skeleton: { opacity: 0.7 },
  skeletonPhoto: {
    width: "100%",
    aspectRatio: 1.15
  },
  skeletonBlock: {
    backgroundColor: mobileColors.surfaceMuted
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: mobileColors.surfaceMuted
  }
});
