import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { MarketplaceListingFarmInfo, ProducerScoreDto } from "../../lib/api";
import { DetailCard, DetailSectionLabel } from "../marketplace/listingDetailUi";
import { ProducerScoreBadge } from "../marketplace/ProducerScoreBadge";
import { FarmPublicProfileModal } from "./FarmPublicProfileModal";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  farmInfo: MarketplaceListingFarmInfo | null | undefined;
  sellerProducerScore?: ProducerScoreDto | null;
  onViewFarmListings: (farmInfo: MarketplaceListingFarmInfo) => void;
};

export function FarmInfoCard({
  farmInfo,
  sellerProducerScore,
  onViewFarmListings
}: Props) {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);

  if (!farmInfo) {
    return null;
  }

  const initials = farmInfo.farmName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <>
      <Pressable
        onPress={() => setModalOpen(true)}
        accessibilityRole="button"
      >
        <DetailCard style={styles.card}>
          <DetailSectionLabel>
            {t("marketScreen.detail.farm.sectionTitle")}
          </DetailSectionLabel>
          <View style={styles.topRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarTx}>{initials || "?"}</Text>
            </View>
            <View style={styles.center}>
              <Text style={styles.farmName} numberOfLines={2}>
                {farmInfo.farmName}
              </Text>
              {farmInfo.farmLocation ? (
                <Text style={styles.location} numberOfLines={1}>
                  📍 {farmInfo.farmLocation}
                </Text>
              ) : null}
            </View>
            {farmInfo.farmRating != null && farmInfo.farmRatingCount > 0 ? (
              <Text style={styles.rating}>
                ⭐ {farmInfo.farmRating.toFixed(1)}
              </Text>
            ) : null}
          </View>
          <View style={styles.divider} />
          <View style={styles.bottomRow}>
            <Text style={styles.producerLabel}>
              {t("marketScreen.detail.farm.producer")}
            </Text>
            <Text style={styles.producerValue}>
              {farmInfo.producerDisplayName}
            </Text>
          </View>
          {sellerProducerScore ? (
            <ProducerScoreBadge
              score={sellerProducerScore}
              prefix={t("producerScore.badgePrefix")}
            />
          ) : null}
          {farmInfo.farmTotalSales > 0 ? (
            <Text style={styles.sales}>
              {t("marketScreen.detail.farm.salesCount", {
                count: farmInfo.farmTotalSales
              })}
            </Text>
          ) : null}
        </DetailCard>
      </Pressable>
      <FarmPublicProfileModal
        visible={modalOpen}
        farmInfo={farmInfo}
        onClose={() => setModalOpen(false)}
        onViewListings={() => {
          setModalOpen(false);
          onViewFarmListings(farmInfo);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {},
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.md
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: mobileColors.accentSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarTx: {
    fontSize: 16,
    fontWeight: "800",
    color: mobileColors.accent
  },
  center: { flex: 1, minWidth: 0 },
  farmName: {
    fontSize: 16,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  location: {
    fontSize: 13,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  rating: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: mobileColors.border,
    marginVertical: mobileSpacing.md
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm
  },
  producerLabel: {
    fontSize: 13,
    color: mobileColors.textSecondary
  },
  producerValue: {
    fontSize: 13,
    fontWeight: "600",
    color: mobileColors.textPrimary,
    flex: 1
  },
  sales: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm
  }
});
