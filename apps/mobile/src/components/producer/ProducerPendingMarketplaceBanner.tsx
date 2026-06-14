import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSession } from "../../context/SessionContext";
import {
  buildProducerPendingMarketplaceItems,
  openProducerPendingItem
} from "../../lib/producerMarketplacePending";
import {
  fetchMarketplaceTransactions,
  fetchReceivedMarketplaceOffers
} from "../../lib/api";
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
  style?: object;
};

export function ProducerPendingMarketplaceBanner({ farmId, style }: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken, activeProfileId, authMe, clientFeatures } = useSession();
  const sellerUserId = authMe?.user.id;

  const offersQ = useQuery({
    queryKey: [
      "marketplaceOffersReceived",
      activeProfileId,
      farmId ?? "all",
      "pending-banner"
    ],
    queryFn: () =>
      fetchReceivedMarketplaceOffers(
        accessToken!,
        activeProfileId,
        farmId ?? undefined
      ),
    enabled: Boolean(
      clientFeatures.marketplace && accessToken && sellerUserId
    ),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true
  });

  const txQ = useQuery({
    queryKey: ["marketplaceTransactions", activeProfileId, "producer-banner"],
    queryFn: () => fetchMarketplaceTransactions(accessToken!, activeProfileId),
    enabled: Boolean(
      clientFeatures.marketplace && accessToken && sellerUserId
    ),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true
  });

  if (!clientFeatures.marketplace || !sellerUserId) return null;

  const items = buildProducerPendingMarketplaceItems(
    offersQ.data ?? [],
    txQ.data ?? [],
    sellerUserId
  );
  if (items.length === 0) return null;

  const first = items[0];
  const subtitle =
    first.kind === "offer"
      ? `${offerStatusLabel(first.offer.status)} · ${first.title}`
      : t(`producer.pendingMarketplace.tx.${first.transaction.status}`, {
          defaultValue: first.transaction.status
        });

  return (
    <Pressable
      onPress={() =>
        openProducerPendingItem(navigation, first, txQ.data ?? [])
      }
      style={({ pressed }) => [
        styles.banner,
        style,
        pressed && { opacity: 0.92 }
      ]}
      accessibilityRole="button"
      accessibilityLabel={t("producer.pendingMarketplace.bannerA11y", {
        count: items.length
      })}
    >
      <View style={styles.iconBox}>
        <Ionicons name="pricetag" size={20} color={mobileColors.onAccent} />
      </View>
      <View style={styles.txCol}>
        <Text style={styles.title} numberOfLines={1}>
          {items.length > 1
            ? t("producer.pendingMarketplace.bannerCount", {
                count: items.length
              })
            : t("producer.pendingMarketplace.bannerOne")}
        </Text>
        <Text style={styles.body} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={mobileColors.onAccent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.md,
    backgroundColor: mobileColors.accent,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.lg,
    marginBottom: mobileSpacing.sm
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center"
  },
  txCol: { flex: 1, minWidth: 0 },
  title: {
    ...mobileTypography.body,
    color: mobileColors.onAccent,
    fontWeight: "700"
  },
  body: {
    ...mobileTypography.meta,
    color: "rgba(255,255,255,0.92)"
  }
});
