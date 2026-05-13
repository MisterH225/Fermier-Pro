import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { EventCard } from "../components/farm";
import { MobileAppShell } from "../components/layout";
import { useSession } from "../context/SessionContext";
import { dashboardRouteForActiveProfileType } from "../lib/dashboardHomeRoute";
import { fetchFarmHealthEvents, fetchFarms } from "../lib/api";
import { producerShellTabs } from "../lib/producerShellTabs";
import { resolveProducerHomeFarm } from "../lib/producerHomeFarm";
import { mobileColors, mobileSpacing, mobileTypography } from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

/**
 * Fil d’événements terrain : dossiers santé ferme (`GET /farms/:id/health/events`).
 */
export function FarmEventsFeedScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en" : "fr";
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken, activeProfileId, authMe, clientFeatures } = useSession();
  const profileType = authMe?.profiles.find((p) => p.id === activeProfileId)?.type;
  const isProducer = profileType === "producer";

  const farmsQuery = useQuery({
    queryKey: ["farms", activeProfileId, "eventsShellCheptel"],
    queryFn: () => fetchFarms(accessToken!, activeProfileId),
    enabled: Boolean(
      accessToken && activeProfileId && isProducer && !authMe?.primaryFarm
    )
  });

  const producerHome = resolveProducerHomeFarm(authMe, farmsQuery.data);

  const shellTabs = producerShellTabs(
    Boolean(isProducer && clientFeatures.finance)
  );

  const eventsQuery = useQuery({
    queryKey: [
      "farmHealthEvents",
      producerHome?.id,
      activeProfileId,
      "eventsFeed"
    ],
    queryFn: () =>
      fetchFarmHealthEvents(
        accessToken!,
        producerHome!.id,
        activeProfileId
      ),
    enabled: Boolean(accessToken && producerHome?.id && isProducer)
  });

  const goHome = () => {
    const route = dashboardRouteForActiveProfileType(profileType);
    switch (route) {
      case "ProducerDashboard":
        navigation.navigate("ProducerDashboard");
        break;
      case "BuyerDashboard":
        navigation.navigate("BuyerDashboard");
        break;
      case "VeterinarianDashboard":
        navigation.navigate("VeterinarianDashboard");
        break;
      case "TechnicianDashboard":
        navigation.navigate("TechnicianDashboard");
        break;
      default:
        navigation.navigate("ProducerDashboard");
    }
  };

  const formatTs = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return "—";
    }
    return d.toLocaleString(locale, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const labelForKind = (kind: string): string => {
    switch (kind) {
      case "vaccination":
        return t("health.formTitles.vaccination");
      case "disease":
        return t("health.formTitles.disease");
      case "vet_visit":
        return t("health.formTitles.vet_visit");
      case "treatment":
        return t("health.formTitles.treatment");
      case "mortality":
        return t("health.formTitles.mortality");
      default:
        return kind;
    }
  };

  return (
    <MobileAppShell
      title={t("eventsFeed.title")}
      omitBottomTabBar={isProducer}
      activeTab={isProducer ? undefined : "home"}
      tabBarTabs={isProducer ? undefined : shellTabs}
      onTabChange={
        isProducer
          ? undefined
          : (tab) => {
              if (tab === "home") {
                goHome();
              }
              if (tab === "cheptel") {
                if (profileType === "buyer") {
                  navigation.navigate("MarketplaceMyListings");
                  return;
                }
                navigation.navigate("FarmList");
              }
              if (tab === "health") {
                navigation.navigate("FarmList");
              }
              if (tab === "profile") {
                navigation.navigate("Account");
              }
            }
      }
    >
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={styles.intro}>{t("eventsFeed.intro")}</Text>
        {!isProducer || !producerHome ? (
          <Text style={styles.muted}>{t("producer.dashboard.noFarmBody")}</Text>
        ) : eventsQuery.isPending ? (
          <ActivityIndicator color={mobileColors.accent} />
        ) : eventsQuery.error ? (
          <Text style={styles.err}>
            {t("eventsFeed.loadError")} —{" "}
            {(eventsQuery.error as Error).message}
          </Text>
        ) : (eventsQuery.data?.length ?? 0) === 0 ? (
          <Text style={styles.muted}>{t("eventsFeed.empty")}</Text>
        ) : (
          <View style={styles.list}>
            {eventsQuery.data!.map((ev) => (
              <EventCard
                key={ev.id}
                title={labelForKind(ev.kind)}
                subtitle={`${ev.entityType} · ${ev.entityId.slice(0, 8)}…`}
                timestamp={formatTs(ev.occurredAt)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </MobileAppShell>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: mobileSpacing.lg,
    paddingBottom: mobileSpacing.xxl,
    gap: mobileSpacing.lg
  },
  intro: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary
  },
  muted: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  err: {
    ...mobileTypography.body,
    color: mobileColors.error
  },
  list: {
    gap: mobileSpacing.md
  }
});
