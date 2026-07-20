import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  flatListingUnitPrice,
  isFlatPriceListing,
  listingDisplayHeadcount
} from "./listingPricing";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MarketplaceListingListItem } from "../../lib/api";
import { formatListingWeightWithBasis } from "../../lib/marketplaceListingForm";
import { formatMarketMoney } from "../../lib/formatMoney";
import { ListingImage } from "./ListingImage";
import { ListingShareButton } from "./ListingShareButton";
import type { RootStackParamList } from "../../types/navigation";
import { marketplaceColors } from "../../theme/marketplaceTheme";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing,
  mobileStatusSurfaces,
  mobileTypography
} from "../../theme/mobileTheme";

const HEALTH_VERIFIED_MS = 30 * 24 * 60 * 60 * 1000;

/** Jours écoulés depuis healthVerifiedAt si < 30 j, sinon null. */
export function healthVerifiedDaysAgo(
  healthVerifiedAt: string | null | undefined
): number | null {
  if (!healthVerifiedAt) return null;
  const at = new Date(healthVerifiedAt).getTime();
  if (!Number.isFinite(at)) return null;
  const elapsed = Date.now() - at;
  if (elapsed < 0 || elapsed >= HEALTH_VERIFIED_MS) return null;
  return Math.max(0, Math.floor(elapsed / (24 * 60 * 60 * 1000)));
}

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
  showShare?: boolean;
  navigation?: NativeStackNavigationProp<RootStackParamList>;
};

export function MarketplaceListingCard({
  item,
  width,
  onPress,
  showFavorite,
  isFavorite,
  onToggleFavorite,
  farmRating,
  style,
  showShare,
  navigation
}: Props) {
  const { t } = useTranslation();
  const wKg = parseMarketNum(item.totalWeightKg);
  const pKg = parseMarketNum(item.pricePerKg);
  const total = parseMarketNum(item.totalPrice);
  const unit = parseMarketNum(item.unitPrice);
  const cur = item.currency || "XOF";
  const views = item.viewsCount ?? 0;
  const consults = item.consultationsCount ?? 0;
  const stock = item.stock ?? item.quantity ?? null;
  const isMerchant = item.kind === "merchant";
  const isNew = isNewListing(item.publishedAt ?? null);
  const expired = !isMerchant && isListingExpired(item.status, item.expiresAt);
  const sold = !isMerchant && item.status === "sold";
  const healthDays = !isMerchant
    ? healthVerifiedDaysAgo(item.healthVerifiedAt)
    : null;
  const statusBadgeTopRight = Boolean(isNew || sold || expired);

  const totalDisplay = isMerchant
    ? unit != null
      ? formatMarketMoney(unit, cur)
      : total != null
        ? formatMarketMoney(total, cur)
        : "—"
    : total != null
      ? formatMarketMoney(total, cur)
      : pKg != null && wKg != null
        ? formatMarketMoney(pKg * wKg, cur)
        : "—";

  const categoryKey = item.category ?? "unknown";
  const categoryLabel =
    item.categoryLabel ??
    t(`marketScreen.categories.${categoryKey}`, {
      defaultValue: t("marketScreen.categories.unknown")
    });
  const flatPrice = isFlatPriceListing(item.category);
  const headcount = listingDisplayHeadcount(item);
  const perHead = flatPrice ? flatListingUnitPrice(item) : null;

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
            {categoryLabel}
          </Text>
        </View>
        {!isMerchant && sold ? (
          <View style={styles.badgeSold}>
            <Text style={styles.badgeSoldTx}>{t("marketScreen.badgeSold")}</Text>
          </View>
        ) : !isMerchant && expired ? (
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
        {!isMerchant && !sold && (item.activeOfferCount ?? 0) >= 1 ? (
          <View style={styles.badgeOffers}>
            <Text style={styles.badgeOffersTx}>
              {t("marketScreen.badgeActiveOffers", {
                count: item.activeOfferCount
              })}
            </Text>
          </View>
        ) : null}
        {healthDays != null ? (
          <View
            style={[
              styles.badgeHealth,
              statusBadgeTopRight && styles.badgeHealthBesideStatus
            ]}
          >
            <Text style={styles.badgeHealthTx} numberOfLines={1}>
              {t("marketScreen.badgeHealthVerifiedDays", { days: healthDays })}
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
        {showShare && navigation && (isMerchant || item.status === "published") ? (
          <ListingShareButton
            listing={{ ...item, kind: item.kind ?? "listing" }}
            navigation={navigation}
            size={18}
            style={[
              styles.shareBtn,
              showFavorite ? styles.shareBtnWithFav : null
            ]}
          />
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
        {isMerchant ? (
          <>
            {unit != null ? (
              <Text style={styles.lineMuted}>
                {t("marketScreen.pricePerUnit", {
                  amount: formatMarketMoney(unit, cur)
                })}
              </Text>
            ) : null}
            {stock != null ? (
              <Text style={styles.lineMuted}>
                {t("merchant.catalog.stock", { count: stock })}
              </Text>
            ) : null}
          </>
        ) : (
          <>
        {wKg != null ? (
          <Text style={styles.lineMuted}>
            {t("marketScreen.totalWeight")}{" "}
            {formatListingWeightWithBasis(wKg, item.weightBasis, t)}
          </Text>
        ) : null}
        {flatPrice && perHead != null ? (
          <Text style={styles.lineMuted}>
            {headcount > 1
              ? t("marketScreen.flatLotPricing", {
                  perHead: formatMarketMoney(perHead, cur),
                  count: headcount
                })
              : t("marketScreen.pricePerHeadShort", {
                  amount: formatMarketMoney(perHead, cur)
                })}
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
          </>
        )}
        <Text style={styles.totalLine}>
          {isMerchant
            ? t("marketScreen.price")
            : t("marketScreen.totalPrice")}{" "}
          {totalDisplay}
        </Text>
        <View style={styles.statsRow}>
          <Text style={styles.statsTx}>👁 {views}</Text>
          <Text style={styles.statsTx}>
            {isMerchant
              ? t("merchant.catalog.stockShort", { count: stock ?? 0 })
              : `💬 ${consults}`}
          </Text>
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
    backgroundColor: marketplaceColors.pending,
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
  badgeHealth: {
    position: "absolute",
    top: mobileSpacing.sm,
    right: mobileSpacing.sm,
    backgroundColor: mobileStatusSurfaces.successBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: mobileRadius.pill,
    maxWidth: "55%"
  },
  /** À côté de badgeNew / sold / expired (même bandeau haut-droite). */
  badgeHealthBesideStatus: {
    right: mobileSpacing.sm + 72
  },
  badgeHealthTx: {
    ...mobileTypography.meta,
    color: mobileStatusSurfaces.successText,
    fontWeight: "700",
    fontSize: 10
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
  shareBtn: {
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
  shareBtnWithFav: {
    right: mobileSpacing.sm + 36
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
