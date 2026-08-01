import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SmartChart, type SmartChartLine, type SmartChartPeriod } from "../charts";
import { ScreenSection } from "../layout/ScreenSection";
import { formatMarketMoney } from "../../lib/formatMoney";
import {
  buildSalesSeriesFromOrders,
  isCountedSaleStatus,
  type SalesOrderLike
} from "../../lib/merchantProductInsights";
import { merchantColors } from "../../theme/merchantTheme";
import {
  mobileFontSize,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type OrderWithProduct = SalesOrderLike & {
  productId?: string;
  productName?: string | null;
  quantity?: number;
  unitPrice?: number;
};

type Props = {
  orders: OrderWithProduct[] | undefined;
  loading?: boolean;
  /** Filtrer la série / l’historique sur un seul produit. */
  productId?: string;
  /** Afficher les dernières ventes sous le graphique. */
  showRecentSales?: boolean;
  title?: string;
  subtitle?: string;
};

export function MerchantProductsSalesSection({
  orders,
  loading,
  productId,
  showRecentSales = false,
  title,
  subtitle
}: Props) {
  const { t, i18n } = useTranslation();
  const [period, setPeriod] = useState<SmartChartPeriod>("6M");
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";

  const scopedOrders = useMemo(() => {
    const list = orders ?? [];
    if (!productId) return list;
    return list.filter((o) => o.productId === productId);
  }, [orders, productId]);

  const series = useMemo(
    () => buildSalesSeriesFromOrders(scopedOrders, { months: 12 }),
    [scopedOrders]
  );

  const recentSales = useMemo(() => {
    if (!showRecentSales) return [];
    return [...scopedOrders]
      .filter((o) => isCountedSaleStatus(o.status))
      .sort((a, b) => {
        const ta = new Date(a.paidAt ?? a.completedAt ?? a.createdAt).getTime();
        const tb = new Date(b.paidAt ?? b.completedAt ?? b.createdAt).getTime();
        return tb - ta;
      })
      .slice(0, 8);
  }, [scopedOrders, showRecentSales]);

  const hasSales = series.some((p) => p.value > 0);

  const lines: SmartChartLine[] = useMemo(
    () => [
      {
        key: "revenue",
        label: t("merchant.products.sales.seriesLabel"),
        color: merchantColors.primary,
        data: series.map((p) => ({ month: p.month, value: p.value }))
      }
    ],
    [series, t]
  );

  const monthLabel = (key: string) => {
    const [y, mo] = key.split("-").map(Number);
    if (!y || !mo) return key;
    return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString(locale, {
      month: "short"
    });
  };

  return (
    <ScreenSection
      title={title ?? t("merchant.products.sales.title")}
      style={styles.section}
      cardStyle={styles.card}
    >
      <Text style={styles.subtitle}>
        {subtitle ?? t("merchant.products.sales.subtitle")}
      </Text>
      {loading ? (
        <ActivityIndicator
          color={merchantColors.primary}
          style={{ marginVertical: mobileSpacing.lg }}
        />
      ) : !hasSales ? (
        <View style={styles.emptyBox}>
          <Text style={styles.empty}>{t("merchant.products.sales.empty")}</Text>
        </View>
      ) : (
        <SmartChart
          lines={lines}
          period={period}
          onPeriodChange={setPeriod}
          unit="XOF"
          monthLabel={monthLabel}
          formatValue={(v) => formatMarketMoney(v, "XOF")}
          emptyLabel={t("merchant.products.sales.empty")}
          height={200}
        />
      )}
      {showRecentSales && recentSales.length > 0 ? (
        <View style={styles.recentWrap}>
          <Text style={styles.recentTitle}>
            {t("merchant.products.sales.recentTitle")}
          </Text>
          {recentSales.map((order, idx) => {
            const when = new Date(
              order.paidAt ?? order.completedAt ?? order.createdAt
            );
            const amount = order.sellerNet ?? order.totalAmount;
            return (
              <View
                key={`${order.createdAt}-${idx}`}
                style={styles.recentRow}
              >
                <View style={styles.recentMain}>
                  <Text style={styles.recentName} numberOfLines={1}>
                    {order.productName?.trim() ||
                      t("merchant.products.sales.unnamedProduct")}
                  </Text>
                  <Text style={styles.recentMeta}>
                    {Number.isNaN(when.getTime())
                      ? "—"
                      : when.toLocaleDateString(locale, {
                          day: "numeric",
                          month: "short",
                          year: "numeric"
                        })}
                    {order.quantity != null
                      ? ` · ×${order.quantity}`
                      : ""}
                  </Text>
                </View>
                <Text style={styles.recentAmount}>
                  {formatMarketMoney(amount, "XOF")}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </ScreenSection>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: mobileSpacing.md },
  card: { backgroundColor: merchantColors.cardBg },
  subtitle: {
    ...mobileTypography.meta,
    color: merchantColors.textSecondary,
    marginBottom: mobileSpacing.sm
  },
  emptyBox: {
    paddingVertical: mobileSpacing.lg,
    alignItems: "center"
  },
  empty: {
    ...mobileTypography.body,
    color: merchantColors.textSecondary,
    textAlign: "center"
  },
  recentWrap: {
    marginTop: mobileSpacing.md,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: merchantColors.border,
    paddingTop: mobileSpacing.md
  },
  recentTitle: {
    fontSize: mobileFontSize.sm,
    fontWeight: "800",
    color: merchantColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  recentMain: { flex: 1, minWidth: 0 },
  recentName: {
    fontSize: mobileFontSize.md,
    fontWeight: "700",
    color: merchantColors.textPrimary
  },
  recentMeta: {
    ...mobileTypography.meta,
    color: merchantColors.textSecondary,
    marginTop: 1
  },
  recentAmount: {
    fontSize: mobileFontSize.md,
    fontWeight: "800",
    color: merchantColors.primary
  }
});
