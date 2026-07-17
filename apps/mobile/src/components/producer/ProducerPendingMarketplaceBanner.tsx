import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSession } from "../../context/SessionContext";
import { fetchMarketplaceOrdersCounters } from "../../lib/api";
import { openProducerSalesHub } from "../../lib/producerMarketplacePending";
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

export function ProducerPendingMarketplaceBanner({ farmId: _farmId, style }: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken, activeProfileId, authMe, clientFeatures } = useSession();
  const sellerUserId = authMe?.user.id;

  const countersQ = useQuery({
    queryKey: [
      "marketplace-orders-counters",
      "seller",
      activeProfileId,
      "pending-banner"
    ],
    queryFn: () =>
      fetchMarketplaceOrdersCounters(accessToken!, "seller", activeProfileId),
    enabled: Boolean(
      clientFeatures.marketplace && accessToken && sellerUserId
    ),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true
  });

  if (!clientFeatures.marketplace || !sellerUserId) return null;

  const actionRequired = countersQ.data?.actionRequired ?? 0;
  const pendingProposals = countersQ.data?.pendingProposals ?? 0;
  const total = actionRequired + pendingProposals;
  if (total === 0) return null;

  return (
    <Pressable
      onPress={() =>
        openProducerSalesHub(navigation, {
          ordersSegment: actionRequired > 0 ? "action_required" : undefined,
          preferProposals: actionRequired === 0 && pendingProposals > 0
        })
      }
      style={({ pressed }) => [
        styles.banner,
        style,
        pressed && { opacity: 0.92 }
      ]}
      accessibilityRole="button"
      accessibilityLabel={t("producer.pendingMarketplace.bannerA11y", {
        count: total
      })}
    >
      <View style={styles.iconBox}>
        <Ionicons name="pricetag" size={20} color={mobileColors.onAccent} />
      </View>
      <View style={styles.txCol}>
        <Text style={styles.title} numberOfLines={1}>
          {total > 1
            ? t("producer.pendingMarketplace.bannerCount", {
                count: total
              })
            : t("producer.pendingMarketplace.bannerOne")}
        </Text>
        <Text style={styles.body} numberOfLines={1}>
          {actionRequired > 0
            ? t("producer.pendingMarketplace.bannerSalesHint", {
                count: actionRequired,
                defaultValue: "{{count}} vente(s) à traiter"
              })
            : t("producer.pendingMarketplace.bannerProposalsHint", {
                count: pendingProposals,
                defaultValue: "{{count}} proposition(s) en attente"
              })}
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
