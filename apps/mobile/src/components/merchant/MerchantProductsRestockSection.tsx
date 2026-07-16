import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenSection } from "../layout/ScreenSection";
import {
  buildRestockRecommendations,
  type RestockOrderLike,
  type RestockPriority,
  type RestockProductLike,
  type RestockRecommendation
} from "../../lib/merchantProductInsights";
import { merchantColors, merchantRadius } from "../../theme/merchantTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type Props = {
  products: RestockProductLike[] | undefined;
  orders: RestockOrderLike[] | undefined;
  loading?: boolean;
  onProductPress?: (productId: string) => void;
};

const ACCENT: Record<RestockPriority, string> = {
  critical: merchantColors.danger,
  warning: merchantColors.warning,
  info: merchantColors.primary
};

function RestockCard({
  item,
  onPress
}: {
  item: RestockRecommendation;
  onPress?: () => void;
}) {
  const { t } = useTranslation();
  const accent = ACCENT[item.priority];

  return (
    <Pressable
      style={[styles.card, { borderLeftColor: accent }]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
    >
      <View style={styles.head}>
        <Text style={styles.badge}>✨ {t("merchant.products.restock.badge")}</Text>
        <Text style={[styles.priority, { color: accent }]}>
          {t(`merchant.products.restock.priority.${item.priority}`)}
        </Text>
      </View>
      <Text style={styles.title}>{item.productName}</Text>
      <Text style={styles.message}>
        {t(`merchant.products.restock.reason.${item.reason}`, {
          stock: item.stock,
          sold: item.unitsSold30d,
          days:
            item.daysOfStock == null
              ? "—"
              : String(Math.max(0, Math.round(item.daysOfStock))),
          qty: item.suggestedQty
        })}
      </Text>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>
          {t("merchant.products.restock.suggest", { count: item.suggestedQty })}
        </Text>
        {onPress ? (
          <View style={styles.cta}>
            <Text style={styles.ctaTx}>{t("merchant.products.edit")}</Text>
            <Ionicons name="chevron-forward" size={14} color={merchantColors.primary} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export function MerchantProductsRestockSection({
  products,
  orders,
  loading,
  onProductPress
}: Props) {
  const { t } = useTranslation();

  const recommendations = useMemo(
    () => buildRestockRecommendations(products ?? [], orders ?? []),
    [products, orders]
  );

  return (
    <ScreenSection
      title={t("merchant.products.restock.title")}
      plain
      style={styles.section}
    >
      <Text style={styles.subtitle}>{t("merchant.products.restock.subtitle")}</Text>
      {loading ? (
        <ActivityIndicator
          color={merchantColors.primary}
          style={{ marginVertical: mobileSpacing.md }}
        />
      ) : recommendations.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.empty}>{t("merchant.products.restock.empty")}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {recommendations.slice(0, 6).map((item) => (
            <RestockCard
              key={item.productId}
              item={item}
              onPress={
                onProductPress ? () => onProductPress(item.productId) : undefined
              }
            />
          ))}
        </View>
      )}
    </ScreenSection>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: mobileSpacing.md },
  subtitle: {
    ...mobileTypography.meta,
    color: merchantColors.textSecondary,
    marginBottom: mobileSpacing.sm
  },
  list: { gap: mobileSpacing.sm },
  card: {
    backgroundColor: merchantColors.cardBg,
    borderRadius: merchantRadius.button,
    padding: mobileSpacing.md,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: merchantColors.border
  },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4
  },
  badge: {
    fontSize: 11,
    fontWeight: "700",
    color: merchantColors.primary
  },
  priority: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    color: merchantColors.textPrimary,
    marginBottom: 4
  },
  message: {
    ...mobileTypography.meta,
    color: merchantColors.textSecondary,
    lineHeight: 18
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: mobileSpacing.sm
  },
  meta: {
    fontSize: 12,
    fontWeight: "700",
    color: merchantColors.primaryDark
  },
  cta: { flexDirection: "row", alignItems: "center", gap: 2 },
  ctaTx: {
    fontSize: 12,
    fontWeight: "700",
    color: merchantColors.primary
  },
  emptyBox: {
    backgroundColor: merchantColors.cardBg,
    borderRadius: merchantRadius.button,
    padding: mobileSpacing.lg,
    borderWidth: 1,
    borderColor: merchantColors.border
  },
  empty: {
    ...mobileTypography.body,
    color: merchantColors.textSecondary,
    textAlign: "center"
  }
});
