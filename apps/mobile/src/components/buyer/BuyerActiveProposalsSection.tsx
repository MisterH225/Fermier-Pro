import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenSection } from "../layout";
import { useSession } from "../../context/SessionContext";
import {
  buildBuyerTrackedOffers,
  isBuyerActionableOffer,
  openBuyerOffersHub,
  openBuyerPendingItem
} from "../../lib/buyerMarketplacePending";
import { fetchMyMarketplaceOffers } from "../../lib/api";
import { offerStatusLabel } from "../../lib/marketplaceLabels";
import { buyerColors, buyerRadius } from "../../theme/buyerTheme";
import { mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

export function BuyerActiveProposalsSection() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken, activeProfileId } = useSession();

  const offersQ = useQuery({
    queryKey: ["marketplaceMyOffers", activeProfileId, "dashboard-active"],
    queryFn: () => fetchMyMarketplaceOffers(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const tracked = buildBuyerTrackedOffers(offersQ.data ?? []).slice(0, 3);
  if (tracked.length === 0) return null;

  return (
    <ScreenSection
      title={t("buyer.dashboard.activeProposals")}
      plain
      headerRight={
        <Pressable onPress={() => openBuyerOffersHub(navigation)} hitSlop={8}>
          <Text style={styles.allLink}>{t("buyer.dashboard.allProposals")}</Text>
        </Pressable>
      }
    >
      <View style={styles.list}>
        {tracked.map((offer) => {
          const actionable = isBuyerActionableOffer(offer);
          return (
            <Pressable
              key={offer.id}
              style={({ pressed }) => [
                styles.row,
                actionable && styles.rowActionable,
                pressed && { opacity: 0.9 }
              ]}
              onPress={() =>
                openBuyerPendingItem(navigation, {
                  kind: "offer",
                  id: `offer:${offer.id}`,
                  title: offer.listing.title,
                  subtitle: offer.status,
                  offer,
                  priority: 0,
                  createdAt: offer.createdAt
                })
              }
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {offer.listing.title}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {offerStatusLabel(offer.status)}
                  {offer.listing.farm?.name
                    ? ` · ${offer.listing.farm.name}`
                    : ""}
                </Text>
              </View>
              <Text style={styles.cta}>
                {actionable
                  ? t("buyer.pendingMarketplace.continue")
                  : t("buyer.pendingMarketplace.view")}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScreenSection>
  );
}

const styles = StyleSheet.create({
  allLink: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: buyerColors.primary
  },
  list: { gap: mobileSpacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    padding: mobileSpacing.md,
    borderRadius: buyerRadius.card,
    borderWidth: 1,
    borderColor: buyerColors.border,
    backgroundColor: buyerColors.cardBg
  },
  rowActionable: {
    borderColor: buyerColors.primary,
    backgroundColor: buyerColors.primaryLight
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: {
    ...mobileTypography.cardTitle,
    fontSize: mobileFontSize.md,
    color: buyerColors.textPrimary
  },
  rowMeta: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary,
    marginTop: 2
  },
  cta: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: buyerColors.primary
  }
});
