import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import type { MerchantProductDto } from "../../lib/api";
import { formatMarketMoney } from "../../lib/formatMoney";
import { merchantColors, merchantRadius, merchantShadow } from "../../theme/merchantTheme";
import { mobileSpacing, mobileTypography, mobileStatusSurfaces, mobileFontSize } from "../../theme/mobileTheme";

type Props = {
  product: MerchantProductDto;
  width: number;
  onPress: () => void;
  onTogglePublish?: () => void;
  onSwap?: () => void;
  onDelete?: () => void;
  showSwap?: boolean;
  publishBusy?: boolean;
  atFreeLimit?: boolean;
  style?: StyleProp<ViewStyle>;
};

function statusLabel(t: (k: string) => string, status: string) {
  const key = `merchant.products.status.${status}`;
  const translated = t(key);
  return translated === key ? status : translated;
}

export function MerchantProductGridCard({
  product,
  width,
  onPress,
  onTogglePublish,
  onSwap,
  onDelete,
  showSwap,
  publishBusy,
  atFreeLimit,
  style
}: Props) {
  const { t } = useTranslation();
  const photo = product.photoUrls?.find((u) => u.trim().length > 0);
  const stockLow = product.stock <= 5;
  const stockOut = product.stock <= 0;

  return (
    <View style={[styles.card, merchantShadow.card, { width }, style]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={product.name}
      >
        <View style={styles.imageWrap}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="cube-outline" size={36} color={merchantColors.textMuted} />
            </View>
          )}
          <View style={styles.statusPill}>
            <Text style={styles.statusTx} numberOfLines={1}>
              {statusLabel(t, product.status)}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={2}>
            {product.name}
          </Text>
          <Text style={styles.price} numberOfLines={1}>
            {formatMarketMoney(product.price, product.currency || "XOF")}
            {product.unitLabel?.trim()
              ? ` / ${product.unitLabel.trim()}`
              : ""}
          </Text>
          <View
            style={[
              styles.stockBadge,
              stockOut && styles.stockBadgeOut,
              !stockOut && stockLow && styles.stockBadgeLow
            ]}
          >
            <Text
              style={[
                styles.stockTx,
                stockOut && styles.stockTxOut,
                !stockOut && stockLow && styles.stockTxLow
              ]}
            >
              {t("merchant.products.stockLabel", { count: product.stock })}
            </Text>
          </View>
          <View style={styles.statsRow} testID="merchant-product-card-stats">
            <View style={styles.statItem}>
              <Ionicons
                name="eye-outline"
                size={12}
                color={merchantColors.textMuted}
              />
              <Text style={styles.statTx}>{product.viewCount ?? 0}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons
                name="heart-outline"
                size={12}
                color={merchantColors.textMuted}
              />
              <Text style={styles.statTx}>{product.favoriteCount ?? 0}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons
                name="cart-outline"
                size={12}
                color={merchantColors.textMuted}
              />
              <Text style={styles.statTx}>{product.purchaseCount ?? 0}</Text>
            </View>
          </View>
        </View>
      </Pressable>

      <View style={styles.footer}>
        <View style={styles.actions}>
          {product.status !== "moderated_removed" &&
          product.status !== "resubmission_review" &&
          onTogglePublish ? (
            <Pressable
              style={styles.actionBtn}
              disabled={publishBusy}
              onPress={onTogglePublish}
              hitSlop={6}
            >
              <Text style={styles.actionTx}>
                {product.status === "published"
                  ? t("merchant.products.unpublish")
                  : t("merchant.products.publish")}
              </Text>
            </Pressable>
          ) : null}
          {showSwap && onSwap ? (
            <Pressable style={styles.actionBtn} onPress={onSwap} hitSlop={6}>
              <Text style={styles.actionTx}>{t("merchant.products.swap")}</Text>
            </Pressable>
          ) : null}
          {onDelete ? (
            <Pressable
              style={[styles.actionBtn, styles.actionBtnDanger]}
              onPress={onDelete}
              hitSlop={6}
              accessibilityLabel={t("merchant.products.delete")}
            >
              <Text style={[styles.actionTx, styles.actionTxDanger]}>
                {t("merchant.products.delete")}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {atFreeLimit && product.status === "draft" ? (
          <Text style={styles.hint}>{t("merchant.products.freeLimitHint")}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: merchantColors.cardBg,
    borderRadius: merchantRadius.card,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: merchantColors.border
  },
  imageWrap: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: merchantColors.primaryLight,
    position: "relative"
  },
  image: { width: "100%", height: "100%" },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  statusPill: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: merchantRadius.pill,
    maxWidth: "70%"
  },
  statusTx: {
    fontSize: mobileFontSize.xs,
    fontWeight: "700",
    color: merchantColors.primary
  },
  body: {
    paddingHorizontal: mobileSpacing.sm,
    paddingTop: mobileSpacing.sm,
    gap: 4
  },
  name: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: merchantColors.textPrimary,
    minHeight: 36
  },
  price: {
    fontSize: mobileFontSize.md,
    fontWeight: "800",
    color: merchantColors.primaryDark
  },
  stockBadge: {
    alignSelf: "flex-start",
    backgroundColor: merchantColors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: merchantRadius.pill,
    marginTop: 2
  },
  stockBadgeLow: { backgroundColor: mobileStatusSurfaces.warningBg },
  stockBadgeOut: { backgroundColor: merchantColors.roseSoftBg },
  stockTx: {
    fontSize: mobileFontSize.xs,
    fontWeight: "700",
    color: merchantColors.primary
  },
  stockTxLow: { color: merchantColors.warning },
  stockTxOut: { color: merchantColors.danger },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3
  },
  statTx: {
    fontSize: mobileFontSize.xs,
    fontWeight: "600",
    color: merchantColors.textSecondary
  },
  footer: {
    paddingHorizontal: mobileSpacing.sm,
    paddingBottom: mobileSpacing.sm,
    paddingTop: 4
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  actionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: merchantRadius.button,
    borderWidth: 1,
    borderColor: merchantColors.primary
  },
  actionBtnDanger: {
    borderColor: merchantColors.danger
  },
  actionTx: {
    color: merchantColors.primary,
    fontWeight: "700",
    fontSize: mobileFontSize.xs
  },
  actionTxDanger: {
    color: merchantColors.danger
  },
  hint: {
    fontSize: mobileFontSize.xs,
    color: merchantColors.warning,
    marginTop: 2
  }
});
