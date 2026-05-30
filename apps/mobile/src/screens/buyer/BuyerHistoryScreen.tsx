import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { EventList } from "../../components/lists/EventList";
import type { EventItem } from "../../components/lists/types";
import {
  ProfileSectionEmpty,
  profileScreenScrollContent,
  ScreenSection
} from "../../components/layout";
import { BuyerMobileShell } from "../../components/layout/BuyerMobileShell";
import { useBuyerBottomChromePad } from "../../context/BuyerBottomChromeContext";
import { useSession } from "../../context/SessionContext";
import {
  fetchBuyerProposals,
  fetchBuyerPurchases,
  fetchBuyerReviews
} from "../../lib/api";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { buyerColors, buyerRadius } from "../../theme/buyerTheme";
import type { RootStackParamList } from "../../types/navigation";

type Tab = "proposals" | "purchases" | "reviews";
type Route = RouteProp<RootStackParamList, "BuyerHistory">;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function stars(score: number): string {
  return "★".repeat(Math.min(5, Math.max(0, score)));
}

export function BuyerHistoryScreen() {
  const { t } = useTranslation();
  const bottomPad = useBuyerBottomChromePad();
  const route = useRoute<Route>();
  const { accessToken, activeProfileId } = useSession();
  const [tab, setTab] = useState<Tab>(route.params?.initialTab ?? "proposals");

  const proposalsQ = useQuery({
    queryKey: ["buyerProposals", activeProfileId, "history"],
    queryFn: () => fetchBuyerProposals(accessToken!, activeProfileId),
    enabled: Boolean(accessToken) && tab === "proposals"
  });

  const purchasesQ = useQuery({
    queryKey: ["buyerPurchases", activeProfileId],
    queryFn: () => fetchBuyerPurchases(accessToken!, activeProfileId),
    enabled: Boolean(accessToken) && tab === "purchases"
  });

  const reviewsQ = useQuery({
    queryKey: ["buyerReviews", activeProfileId],
    queryFn: () => fetchBuyerReviews(accessToken!, activeProfileId),
    enabled: Boolean(accessToken) && tab === "reviews"
  });

  const proposalItems: EventItem[] = useMemo(
    () =>
      (proposalsQ.data ?? [])
        .filter((p) => p.status !== "accepted")
        .map((p) => ({
          id: p.id,
          title: p.listing.title,
          subtitle: `${p.status} · ${p.listing.farmName ?? "—"}`,
          date: formatDate(p.createdAt),
          valueType: "neutral" as const,
          iconType: "custom" as const,
          customIcon: "paper-plane-outline",
          iconColor: buyerColors.primary
        })),
    [proposalsQ.data]
  );

  const purchaseItems: EventItem[] = useMemo(
    () =>
      (purchasesQ.data ?? []).map((p) => ({
        id: p.id,
        title: p.listing.title,
        subtitle: `${p.offeredPrice} · ${p.listing.farmName ?? "—"}`,
        date: formatDate(p.createdAt),
        valueType: "positive" as const,
        iconType: "custom" as const,
        customIcon: "checkmark-circle-outline",
        iconColor: buyerColors.success
      })),
    [purchasesQ.data]
  );

  const reviewItems: EventItem[] = useMemo(
    () =>
      (reviewsQ.data ?? []).map((r) => ({
        id: r.id,
        title: r.farmName,
        subtitle: r.comment
          ? `${stars(r.score)} · ${r.comment}`
          : stars(r.score),
        date: formatDate(r.createdAt),
        valueType: "neutral" as const,
        iconType: "custom" as const,
        customIcon: "star-outline",
        iconColor: buyerColors.warning
      })),
    [reviewsQ.data]
  );

  const tabLabel = t(`buyer.history.tabs.${tab}`);
  const isLoading =
    (tab === "proposals" && proposalsQ.isLoading) ||
    (tab === "purchases" && purchasesQ.isLoading) ||
    (tab === "reviews" && reviewsQ.isLoading);

  const isFetching =
    proposalsQ.isFetching || purchasesQ.isFetching || reviewsQ.isFetching;

  const refresh = () => {
    if (tab === "proposals") void proposalsQ.refetch();
    if (tab === "purchases") void purchasesQ.refetch();
    if (tab === "reviews") void reviewsQ.refetch();
  };

  const renderContent = () => {
    if (isLoading) {
      return <ActivityIndicator color={buyerColors.primary} />;
    }
    if (tab === "proposals") {
      if (proposalsQ.error) {
        return (
          <ProfileSectionEmpty>{(proposalsQ.error as Error).message}</ProfileSectionEmpty>
        );
      }
      return proposalItems.length > 0 ? (
        <EventList data={proposalItems} />
      ) : (
        <ProfileSectionEmpty>{t("buyer.history.noProposals")}</ProfileSectionEmpty>
      );
    }
    if (tab === "purchases") {
      if (purchasesQ.error) {
        return (
          <ProfileSectionEmpty>{(purchasesQ.error as Error).message}</ProfileSectionEmpty>
        );
      }
      return purchaseItems.length > 0 ? (
        <EventList data={purchaseItems} />
      ) : (
        <ProfileSectionEmpty>{t("buyer.history.noPurchases")}</ProfileSectionEmpty>
      );
    }
    if (reviewsQ.error) {
      return (
        <ProfileSectionEmpty>{(reviewsQ.error as Error).message}</ProfileSectionEmpty>
      );
    }
    return reviewItems.length > 0 ? (
      <EventList data={reviewItems} />
    ) : (
      <ProfileSectionEmpty>{t("buyer.history.noReviews")}</ProfileSectionEmpty>
    );
  };

  return (
    <BuyerMobileShell hideTopBar>
      <ScrollView
        contentContainerStyle={[
          profileScreenScrollContent,
          { paddingBottom: bottomPad + mobileSpacing.xl }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refresh}
            tintColor={buyerColors.primary}
          />
        }
      >
        <ScreenSection title={t("buyer.history.sectionFilter")}>
          <View style={styles.pills}>
            {(["proposals", "purchases", "reviews"] as Tab[]).map((k) => {
              const active = tab === k;
              return (
                <Pressable
                  key={k}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => setTab(k)}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>
                    {t(`buyer.history.tabs.${k}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScreenSection>

        <ScreenSection title={tabLabel}>{renderContent()}</ScreenSection>
      </ScrollView>
    </BuyerMobileShell>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.sm },
  pill: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 8,
    borderRadius: buyerRadius.pill,
    borderWidth: 1,
    borderColor: buyerColors.border,
    backgroundColor: buyerColors.canvas
  },
  pillActive: { backgroundColor: buyerColors.primary, borderColor: buyerColors.primary },
  pillText: { ...mobileTypography.meta, fontWeight: "600", color: buyerColors.textSecondary },
  pillTextActive: { color: "#fff" }
});
