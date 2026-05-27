import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { EventList } from "../../components/lists/EventList";
import type { EventItem } from "../../components/lists/types";
import { ActiveProfileSwitcherModal } from "../../components/account/ActiveProfileSwitcherModal";
import { BuyerMobileShell } from "../../components/layout/BuyerMobileShell";
import { useBuyerBottomChromePad } from "../../context/BuyerBottomChromeContext";
import { useSession } from "../../context/SessionContext";
import {
  fetchBuyerDashboard,
  fetchBuyerPersonalizedListings,
  fetchBuyerProposals
} from "../../lib/api";
import { resolveActiveProfileAvatarUrl } from "../../lib/profileAvatar";
import { welcomeFirstName } from "../../lib/userDisplay";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { buyerColors, buyerRadius, buyerShadow } from "../../theme/buyerTheme";
import type { RootStackParamList } from "../../types/navigation";

export function BuyerDashboardScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomPad = useBuyerBottomChromePad();
  const { accessToken, activeProfileId, authMe, refreshAuthMe } = useSession();
  const [profileOpen, setProfileOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const dashQ = useQuery({
    queryKey: ["buyerDashboard", activeProfileId],
    queryFn: () => fetchBuyerDashboard(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const offersQ = useQuery({
    queryKey: ["buyerOffers", activeProfileId],
    queryFn: () => fetchBuyerPersonalizedListings(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const proposalsQ = useQuery({
    queryKey: ["buyerProposals", activeProfileId, "pending"],
    queryFn: () => fetchBuyerProposals(accessToken!, activeProfileId, "pending"),
    enabled: Boolean(accessToken)
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAuthMe();
      await Promise.all([dashQ.refetch(), offersQ.refetch(), proposalsQ.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshAuthMe, dashQ, offersQ, proposalsQ]);

  useFocusEffect(
    useCallback(() => {
      void refreshAuthMe();
    }, [refreshAuthMe])
  );

  const displayName = welcomeFirstName(authMe?.user ?? null) ?? t("buyer.dashboard.defaultName");
  const kpis = dashQ.data?.kpis;

  const proposalEvents: EventItem[] = useMemo(
    () =>
      (proposalsQ.data ?? []).slice(0, 5).map((p) => ({
        id: p.id,
        title: p.listing.title,
        subtitle: `${p.status} · ${p.offeredPrice}`,
        date: new Date(p.createdAt).toLocaleDateString(),
        valueType: "neutral" as const,
        iconType: "custom" as const,
        customIcon: "paper-plane-outline",
        iconColor: buyerColors.primary
      })),
    [proposalsQ.data]
  );

  return (
    <BuyerMobileShell hideTopBar>
      <ScrollView
        contentContainerStyle={[styles.wrap, { paddingBottom: bottomPad + mobileSpacing.xl }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={buyerColors.primary}
          />
        }
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.headerLeft} onPress={() => setProfileOpen(true)}>
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="cart" size={24} color={buyerColors.primary} />
            </View>
            <Text style={styles.greeting}>
              {t("buyer.dashboard.welcome", { name: displayName })}
            </Text>
          </Pressable>
          <View style={styles.headerRight}>
            <Pressable onPress={() => navigation.navigate("BuyerMarket")}>
              <Ionicons name="search-outline" size={24} color={buyerColors.primary} />
            </Pressable>
          </View>
        </View>

        <TextInput
          style={styles.search}
          placeholder={t("buyer.dashboard.searchPlaceholder")}
          placeholderTextColor={buyerColors.textMuted}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() =>
            navigation.navigate("BuyerMarket", { searchQuery: search.trim() || undefined })
          }
        />

        <Text style={styles.sectionTitle}>{t("buyer.dashboard.offersForYou")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(offersQ.data ?? []).slice(0, 8).map((o) => (
            <Pressable
              key={o.id}
              style={[styles.offerCard, buyerShadow.card]}
              onPress={() =>
                navigation.navigate("MarketplaceListingDetail", {
                  listingId: o.id,
                  headline: o.title
                })
              }
            >
              <Text style={styles.offerTitle} numberOfLines={2}>
                {o.title}
              </Text>
              <Text style={styles.offerMeta}>{o.farmName}</Text>
              {o.pricePerKg ? (
                <Text style={styles.offerPrice}>{o.pricePerKg} / kg</Text>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
        <Pressable onPress={() => navigation.navigate("BuyerMarket")}>
          <Text style={styles.link}>{t("buyer.dashboard.allOffers")}</Text>
        </Pressable>

        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, { backgroundColor: buyerColors.primaryLight }]}>
            <Text style={styles.kpiValue}>{kpis?.pendingProposals ?? 0}</Text>
            <Text style={styles.kpiLabel}>{t("buyer.kpi.pending")}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: "#E8F5E9" }]}>
            <Text style={[styles.kpiValue, { color: buyerColors.success }]}>
              {kpis?.purchasesCount ?? 0}
            </Text>
            <Text style={styles.kpiLabel}>{t("buyer.kpi.purchases")}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: "#FCE4EC" }]}>
            <Text style={styles.kpiValue}>{kpis?.favoritesCount ?? 0}</Text>
            <Text style={styles.kpiLabel}>{t("buyer.kpi.favorites")}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: "#FFF3E0" }]}>
            <Text style={styles.kpiValue}>{kpis?.activeAlerts ?? 0}</Text>
            <Text style={styles.kpiLabel}>{t("buyer.kpi.alerts")}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t("buyer.dashboard.activeProposals")}</Text>
        {proposalEvents.length > 0 ? (
          <EventList data={proposalEvents} />
        ) : (
          <Text style={styles.empty}>{t("buyer.dashboard.noProposals")}</Text>
        )}
        <Pressable onPress={() => navigation.navigate("BuyerHistory")}>
          <Text style={styles.link}>{t("buyer.dashboard.allProposals")}</Text>
        </Pressable>
      </ScrollView>

      <ActiveProfileSwitcherModal visible={profileOpen} onClose={() => setProfileOpen(false)} />
    </BuyerMobileShell>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: mobileSpacing.lg, gap: mobileSpacing.md },
  headerRow: { flexDirection: "row", alignItems: "center" },
  headerLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: mobileSpacing.md },
  headerRight: { flexDirection: "row", gap: mobileSpacing.sm },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: {
    backgroundColor: buyerColors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  greeting: { ...mobileTypography.cardTitle, fontSize: 18, flex: 1, color: buyerColors.textPrimary },
  search: {
    backgroundColor: buyerColors.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: buyerColors.border,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 12,
    ...mobileTypography.body
  },
  sectionTitle: { ...mobileTypography.cardTitle, color: buyerColors.textPrimary, marginTop: mobileSpacing.sm },
  offerCard: {
    width: 160,
    marginRight: mobileSpacing.sm,
    padding: mobileSpacing.md,
    backgroundColor: buyerColors.cardBg,
    borderRadius: buyerRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: buyerColors.border
  },
  offerTitle: { ...mobileTypography.body, fontWeight: "600", color: buyerColors.textPrimary },
  offerMeta: { ...mobileTypography.meta, color: buyerColors.textSecondary, marginTop: 4 },
  offerPrice: { ...mobileTypography.meta, color: buyerColors.primary, fontWeight: "700", marginTop: 4 },
  link: { ...mobileTypography.body, color: buyerColors.primary, fontWeight: "600" },
  empty: { ...mobileTypography.body, color: buyerColors.textSecondary },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.sm },
  kpiCard: {
    width: "47%",
    borderRadius: buyerRadius.card,
    padding: mobileSpacing.md
  },
  kpiValue: { fontSize: 22, fontWeight: "700", color: buyerColors.primary },
  kpiLabel: { ...mobileTypography.meta, color: buyerColors.textSecondary, marginTop: 4 }
});
