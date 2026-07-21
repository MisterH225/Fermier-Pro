import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { BaseModal } from "../modals/BaseModal";
import { PrimaryButton } from "../ui/PrimaryButton";
import type { MarketplaceListingFarmInfo } from "../../lib/api";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";

type Props = {
  visible: boolean;
  farmInfo: MarketplaceListingFarmInfo | null;
  onClose: () => void;
  onViewListings: () => void;
};

export function FarmPublicProfileModal({
  visible,
  farmInfo,
  onClose,
  onViewListings
}: Props) {
  const { t } = useTranslation();
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
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={farmInfo.farmName}
      footerPrimary={
        <PrimaryButton
          label={t("marketScreen.detail.farm.viewListings")}
          onPress={onViewListings}
        />
      }
    >
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTx}>{initials || "?"}</Text>
        </View>
        <View style={styles.heroBody}>
          {farmInfo.farmLocation ? (
            <Text style={styles.loc}>📍 {farmInfo.farmLocation}</Text>
          ) : null}
          {farmInfo.farmRating != null && farmInfo.farmRatingCount > 0 ? (
            <Text style={styles.rating}>
              ⭐ {farmInfo.farmRating.toFixed(1)} · {farmInfo.farmRatingCount}{" "}
              {t("marketScreen.detail.reviews")}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.statGrid}>
        <Stat
          label={t("marketScreen.detail.farm.activeListings")}
          value={String(farmInfo.activeListingsCount)}
        />
        <Stat
          label={t("marketScreen.detail.farm.totalSales")}
          value={String(farmInfo.farmTotalSales)}
        />
      </View>

      <View style={styles.producerRow}>
        <Text style={styles.producerLabel}>
          {t("marketScreen.detail.farm.producer")}
        </Text>
        <Text style={styles.producerValue}>
          {farmInfo.producerDisplayName}
        </Text>
      </View>
    </BaseModal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.md,
    marginBottom: mobileSpacing.lg
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: mobileRadius.xl,
    backgroundColor: mobileColors.accentSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarTx: {
    fontSize: mobileFontSize.xl,
    fontWeight: "800",
    color: mobileColors.accent
  },
  heroBody: { flex: 1, gap: 4 },
  loc: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary
  },
  rating: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  statGrid: {
    flexDirection: "row",
    gap: mobileSpacing.md,
    marginBottom: mobileSpacing.lg
  },
  stat: {
    flex: 1,
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    alignItems: "center"
  },
  statValue: {
    ...mobileTypography.title,
    fontSize: mobileFontSize.xl,
    color: mobileColors.textPrimary
  },
  statLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textAlign: "center",
    marginTop: 4
  },
  producerRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mobileColors.border,
    paddingTop: mobileSpacing.md
  },
  producerLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: 4
  },
  producerValue: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary
  }
});
