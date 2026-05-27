import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { EventList } from "../../components/lists/EventList";
import type { EventItem } from "../../components/lists/types";
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
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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

  return (
    <BuyerMobileShell hideTopBar>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingBottom: bottomPad }]}>
        <Text style={styles.title}>{t("buyer.history.title")}</Text>
        <View style={styles.pills}>
          {(["proposals", "purchases", "reviews"] as Tab[]).map((k) => (
            <Pressable
              key={k}
              style={[styles.pill, tab === k && styles.pillActive]}
              onPress={() => setTab(k)}
            >
              <Text style={[styles.pillText, tab === k && styles.pillTextActive]}>
                {t(`buyer.history.tabs.${k}`)}
              </Text>
            </Pressable>
          ))}
        </View>
        {tab === "proposals" ? (
          proposalsQ.isLoading ? (
            <ActivityIndicator color={buyerColors.primary} />
          ) : items.length > 0 ? (
            <EventList data={items} />
          ) : (
            <Text style={styles.empty}>{t("buyer.dashboard.noProposals")}</Text>
          )
        ) : (
          <Text style={styles.empty}>{t("buyer.history.comingSoon")}</Text>
        )}
      </ScrollView>
    </BuyerMobileShell>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: mobileSpacing.lg, gap: mobileSpacing.md },
  title: { ...mobileTypography.cardTitle, fontSize: 20, color: buyerColors.textPrimary },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.sm },
  pill: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 8,
    borderRadius: buyerRadius.pill,
    borderWidth: 1,
    borderColor: buyerColors.border,
    backgroundColor: buyerColors.cardBg
  },
  pillActive: { backgroundColor: buyerColors.primary, borderColor: buyerColors.primary },
  pillText: { ...mobileTypography.meta, fontWeight: "600", color: buyerColors.textSecondary },
  pillTextActive: { color: "#fff" },
  empty: { ...mobileTypography.body, color: buyerColors.textSecondary }
});
