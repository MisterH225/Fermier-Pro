import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { ScreenSection } from "../layout";
import { SurfaceCard } from "../common/SurfaceCard";
import { StatusBadge } from "../common/StatusBadge";
import { buyerPalette } from "../common/rolePalette";
import { formatMarketMoney } from "../../lib/formatMoney";
import type { BuyerDashboardCreditDuesDto } from "../../lib/api/buyer";
import { buyerColors, buyerRadius } from "../../theme/buyerTheme";
import {
  mobileFontSize,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type Props = {
  creditDues?: BuyerDashboardCreditDuesDto;
};

function formatDueDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale === "en" ? "en-US" : "fr-FR", {
    day: "numeric",
    month: "short"
  });
}

/**
 * Section crédits : absente si aucune dette (items vides).
 */
export function BuyerCreditDuesSection({ creditDues }: Props) {
  const { t, i18n } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const locale = i18n.language === "en" ? "en" : "fr";

  const items = creditDues?.items ?? [];
  if (items.length === 0) {
    return null;
  }

  const currency = creditDues?.currency ?? "XOF";

  return (
    <ScreenSection title={t("buyer.dashboard.creditTitle")} plain>
      <SurfaceCard palette={buyerPalette} padded={false} style={styles.wrap}>
        <View style={styles.totalBlock}>
          <Text style={styles.totalLabel}>
            {t("buyer.dashboard.creditTotal")}
          </Text>
          <Text style={styles.totalValue}>
            {formatMarketMoney(creditDues?.totalDue ?? 0, currency)}
          </Text>
        </View>

        <View style={styles.list}>
          {items.map((item) => (
            <SurfaceCard
              key={item.offerId}
              palette={buyerPalette}
              style={styles.rowCard}
              onPress={() => {
                if (item.transactionId) {
                  navigation.navigate("MarketplaceTransaction", {
                    transactionId: item.transactionId
                  });
                  return;
                }
                navigation.navigate("MarketplaceList", {
                  tab: "offers",
                  offersSubTab: "sent",
                  buyerView: true,
                  fromDashboard: true,
                  highlightOfferId: item.offerId
                });
              }}
            >
              <View style={styles.rowTop}>
                <View style={styles.rowText}>
                  <Text style={styles.seller} numberOfLines={1}>
                    {item.farmName?.trim() || item.sellerName}
                  </Text>
                  <Text style={styles.listing} numberOfLines={1}>
                    {item.listingTitle}
                  </Text>
                </View>
                <Text style={styles.amount}>
                  {formatMarketMoney(item.amountDue, item.currency || currency)}
                </Text>
              </View>
              <View style={styles.rowBottom}>
                <Text style={styles.due}>
                  {t("buyer.dashboard.creditDueAt", {
                    when: formatDueDate(item.balanceDueAt, locale)
                  })}
                </Text>
                {item.overdue ? (
                  <StatusBadge
                    label={t("buyer.dashboard.creditOverdue")}
                    backgroundColor={buyerColors.danger}
                    color={buyerColors.onPrimary}
                  />
                ) : null}
              </View>
            </SurfaceCard>
          ))}
        </View>
      </SurfaceCard>
    </ScreenSection>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    borderRadius: buyerRadius.card
  },
  totalBlock: {
    padding: mobileSpacing.lg,
    backgroundColor: buyerColors.primaryLight,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: buyerColors.border,
    gap: 4
  },
  totalLabel: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: buyerColors.primaryDark
  },
  totalValue: {
    fontSize: mobileFontSize.xxl,
    fontWeight: "900",
    color: buyerColors.primary
  },
  list: {
    padding: mobileSpacing.md,
    gap: mobileSpacing.sm
  },
  rowCard: {
    marginBottom: 0
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: mobileSpacing.sm
  },
  rowText: { flex: 1, minWidth: 0 },
  seller: {
    ...mobileTypography.cardTitle,
    fontSize: mobileFontSize.md,
    color: buyerColors.textPrimary
  },
  listing: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary,
    marginTop: 2
  },
  amount: {
    fontSize: mobileFontSize.md,
    fontWeight: "800",
    color: buyerColors.textPrimary
  },
  rowBottom: {
    marginTop: mobileSpacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing.sm
  },
  due: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary
  }
});
