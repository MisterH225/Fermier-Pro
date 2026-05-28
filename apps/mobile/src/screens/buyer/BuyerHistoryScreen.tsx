import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { EventList } from "../../components/lists/EventList";
import type { EventItem } from "../../components/lists/types";
import {
  ProfileHeroCard,
  ProfileSectionEmpty,
  profileScreenScrollContent,
  ScreenSection
} from "../../components/layout";
import { BuyerMobileShell } from "../../components/layout/BuyerMobileShell";
import { useBuyerBottomChromePad } from "../../context/BuyerBottomChromeContext";
import { useSession } from "../../context/SessionContext";
import { fetchBuyerProposals } from "../../lib/api";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { buyerColors, buyerRadius } from "../../theme/buyerTheme";
import type { RootStackParamList } from "../../types/navigation";

type Tab = "proposals" | "purchases" | "reviews";
type Route = RouteProp<RootStackParamList, "BuyerHistory">;

export function BuyerHistoryScreen() {
  const { t } = useTranslation();
  const bottomPad = useBuyerBottomChromePad();
  const route = useRoute<Route>();
  const { accessToken, activeProfileId } = useSession();
  const [tab, setTab] = useState<Tab>(route.params?.initialTab ?? "proposals");

  const proposalsQ = useQuery({
    queryKey: ["buyerProposals", activeProfileId, tab],
    queryFn: () => fetchBuyerProposals(accessToken!, activeProfileId),
    enabled: Boolean(accessToken) && tab === "proposals"
  });

  const items: EventItem[] = (proposalsQ.data ?? []).map((p) => ({
    id: p.id,
    title: p.listing.title,
    subtitle: `${p.status} · ${p.listing.farmName ?? "—"}`,
    date: new Date(p.createdAt).toLocaleDateString(),
    valueType: "neutral",
    iconType: "custom",
    customIcon: "receipt-outline",
    iconColor: buyerColors.primary
  }));

  const tabLabel = t(`buyer.history.tabs.${tab}`);

  return (
    <BuyerMobileShell hideTopBar>
      <ScrollView
        contentContainerStyle={[
          profileScreenScrollContent,
          { paddingBottom: bottomPad + mobileSpacing.xl }
        ]}
      >
        <ProfileHeroCard>
          <Text style={styles.heroTitle}>{t("buyer.history.title")}</Text>
        </ProfileHeroCard>

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

        <ScreenSection title={tabLabel}>
          {tab === "proposals" ? (
            proposalsQ.isLoading ? (
              <ActivityIndicator color={buyerColors.primary} />
            ) : items.length > 0 ? (
              <EventList data={items} />
            ) : (
              <ProfileSectionEmpty>{t("buyer.dashboard.noProposals")}</ProfileSectionEmpty>
            )
          ) : (
            <ProfileSectionEmpty>{t("buyer.history.comingSoon")}</ProfileSectionEmpty>
          )}
        </ScreenSection>
      </ScrollView>
    </BuyerMobileShell>
  );
}

const styles = StyleSheet.create({
  heroTitle: { ...mobileTypography.cardTitle, fontSize: 20, color: buyerColors.textPrimary },
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
