import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenSection } from "../layout";
import { useSession } from "../../context/SessionContext";
import {
  buildProducerTrackedOffers,
  isProducerActionableOffer,
  openProducerOffersHub,
  openProducerPendingItem
} from "../../lib/producerMarketplacePending";
import { fetchMarketplaceTransactions, fetchReceivedMarketplaceOffers } from "../../lib/api";
import { offerStatusLabel } from "../../lib/marketplaceLabels";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type Props = {
  farmId?: string | null;
};

export function ProducerActiveProposalsSection({ farmId }: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken, activeProfileId, clientFeatures } = useSession();

  const offersQ = useQuery({
    queryKey: [
      "marketplaceOffersReceived",
      activeProfileId,
      farmId ?? "all",
      "dashboard-active"
    ],
    queryFn: () =>
      fetchReceivedMarketplaceOffers(
        accessToken!,
        activeProfileId,
        farmId ?? undefined
      ),
    enabled: Boolean(clientFeatures.marketplace && accessToken)
  });

  const txQ = useQuery({
    queryKey: ["marketplaceTransactions", activeProfileId, "producer-active"],
    queryFn: () => fetchMarketplaceTransactions(accessToken!, activeProfileId),
    enabled: Boolean(clientFeatures.marketplace && accessToken)
  });

  const tracked = buildProducerTrackedOffers(offersQ.data ?? []).slice(0, 3);
  if (!clientFeatures.marketplace || tracked.length === 0) return null;

  return (
    <ScreenSection
      title={t("producer.dashboard.receivedProposals")}
      plain
      headerRight={
        <Pressable onPress={() => openProducerOffersHub(navigation)} hitSlop={8}>
          <Text style={styles.allLink}>
            {t("producer.dashboard.allProposals")}
          </Text>
        </Pressable>
      }
    >
      <View style={styles.list}>
        {tracked.map((offer) => {
          const actionable = isProducerActionableOffer(offer);
          const buyerLabel =
            offer.buyer.fullName?.trim() || t("producer.dashboard.anonymousBuyer");
          return (
            <Pressable
              key={offer.id}
              style={({ pressed }) => [
                styles.row,
                actionable && styles.rowActionable,
                pressed && { opacity: 0.9 }
              ]}
              onPress={() =>
                openProducerPendingItem(
                  navigation,
                  {
                    kind: "offer",
                    id: `offer:${offer.id}`,
                    title: offer.listing.title,
                    subtitle: offer.status,
                    offer,
                    priority: 0,
                    createdAt: offer.createdAt
                  },
                  txQ.data ?? []
                )
              }
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {offer.listing.title}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {offerStatusLabel(offer.status)} · {buyerLabel}
                </Text>
              </View>
              <Text style={styles.cta}>
                {actionable
                  ? t("producer.pendingMarketplace.continue")
                  : t("producer.pendingMarketplace.view")}
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
    color: mobileColors.accent
  },
  list: { gap: mobileSpacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.lg,
    borderWidth: 1,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.background
  },
  rowActionable: {
    borderColor: mobileColors.accent,
    backgroundColor: "rgba(46, 125, 50, 0.08)"
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: {
    ...mobileTypography.cardTitle,
    fontSize: 15,
    color: mobileColors.textPrimary
  },
  rowMeta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  cta: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: mobileColors.accent
  }
});
