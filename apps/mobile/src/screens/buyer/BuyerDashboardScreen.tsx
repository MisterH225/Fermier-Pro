import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState, type ReactNode } from "react";
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
import { AdminMessagesBanner } from "../../components/admin/AdminMessagesBanner";
import { AccountNotificationsSection } from "../../components/notifications/AccountNotificationsSection";
import { PendingInvitationsBanner } from "../../components/collaboration/PendingInvitationsBanner";
import { PigPriceIndex } from "../../components/market/PigPriceIndex";
import { BuyerProfileModal } from "../../components/buyer/BuyerProfileModal";
import { BuyerWelcomeHeader } from "../../components/buyer/BuyerWelcomeHeader";
import { SupportHeaderButton } from "../../components/support/SupportHeaderButton";
import {
  ProfileHeroCard,
  profileScreenScrollContent,
  ScreenSection
} from "../../components/layout";
import { BuyerMobileShell } from "../../components/layout/BuyerMobileShell";
import { useBottomChromePad, useBottomInset } from "../../hooks/useBottomInset";
import { useSession } from "../../context/SessionContext";
import { fetchBuyerDashboard } from "../../lib/api";
import { resolveActiveProfileAvatarUrl } from "../../lib/profileAvatar";
import { welcomeFirstName } from "../../lib/userDisplay";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { buyerColors, buyerRadius } from "../../theme/buyerTheme";
import type { RootStackParamList } from "../../types/navigation";

export function BuyerDashboardScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const bottomInset = useBottomInset();
  const { accessToken, activeProfileId, authMe, refreshAuthMe } = useSession();
  const [profileOpen, setProfileOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const dashQ = useQuery({
    queryKey: ["buyerDashboard", activeProfileId],
    queryFn: () => fetchBuyerDashboard(accessToken!, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAuthMe();
      await dashQ.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refreshAuthMe, dashQ]);

  useFocusEffect(
    useCallback(() => {
      void refreshAuthMe();
    }, [refreshAuthMe])
  );

  const displayName =
    welcomeFirstName(authMe?.user ?? null) ?? t("buyer.dashboard.defaultName");
  const kpis = dashQ.data?.kpis;

  const dashboardHeader: ReactNode = (
    <View style={styles.heroBar}>
      <BuyerWelcomeHeader
        welcomeLabel={t("buyer.dashboard.welcomeLine")}
        displayName={displayName}
        avatarUrl={resolveActiveProfileAvatarUrl(authMe, activeProfileId)}
        onPressAvatar={() => setProfileOpen(true)}
      />
      <SupportHeaderButton
        iconColor={buyerColors.primary}
        style={styles.heroIconBtn}
      />
    </View>
  );

  return (
    <BuyerMobileShell customHeader={dashboardHeader} omitBottomTabBar>
      <ScrollView
        contentContainerStyle={[
          profileScreenScrollContent,
          { paddingBottom: bottomInset }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={buyerColors.primary}
          />
        }
      >
        <AdminMessagesBanner />
        <PendingInvitationsBanner />
        <AccountNotificationsSection />

        <ProfileHeroCard>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={20} color={buyerColors.textMuted} />
            <TextInput
              style={styles.search}
              placeholder={t("buyer.dashboard.searchPlaceholder")}
              placeholderTextColor={buyerColors.textMuted}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() =>
                navigation.navigate("MarketplaceList", {
                  tab: "listings",
                  buyerView: true,
                  fromDashboard: true,
                  searchQuery: search.trim() || undefined
                })
              }
            />
          </View>
        </ProfileHeroCard>

        <PigPriceIndex />

        <ScreenSection title={t("buyer.dashboard.sectionStats")} plain>
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
            <Pressable
              style={[styles.kpiCard, { backgroundColor: "#FCE4EC" }]}
              onPress={() => navigation.navigate("BuyerFavorites")}
            >
              <Text style={styles.kpiValue}>{kpis?.favoritesCount ?? 0}</Text>
              <Text style={styles.kpiLabel}>{t("buyer.kpi.favorites")}</Text>
            </Pressable>
            <Pressable
              style={[styles.kpiCard, { backgroundColor: "#FFF3E0" }]}
              onPress={() => navigation.navigate("BuyerAlerts")}
            >
              <Text style={styles.kpiValue}>{kpis?.activeAlerts ?? 0}</Text>
              <Text style={styles.kpiLabel}>{t("buyer.kpi.alerts")}</Text>
            </Pressable>
          </View>
        </ScreenSection>
      </ScrollView>

      <BuyerProfileModal visible={profileOpen} onClose={() => setProfileOpen(false)} />
    </BuyerMobileShell>
  );
}

const styles = StyleSheet.create({
  heroBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.sm,
    backgroundColor: buyerColors.canvas,
    gap: mobileSpacing.sm
  },
  heroIconBtn: {
    padding: mobileSpacing.sm,
    borderRadius: buyerRadius.pill
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: buyerColors.canvas,
    borderRadius: buyerRadius.button,
    borderWidth: 1,
    borderColor: buyerColors.border,
    paddingHorizontal: mobileSpacing.md,
    gap: mobileSpacing.sm
  },
  search: {
    flex: 1,
    paddingVertical: 12,
    ...mobileTypography.body,
    color: buyerColors.textPrimary
  },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.sm },
  kpiCard: {
    width: "47%",
    borderRadius: buyerRadius.card,
    padding: mobileSpacing.md
  },
  kpiValue: { fontSize: 22, fontWeight: "700", color: buyerColors.primary },
  kpiLabel: { ...mobileTypography.meta, color: buyerColors.textSecondary, marginTop: 4 }
});
