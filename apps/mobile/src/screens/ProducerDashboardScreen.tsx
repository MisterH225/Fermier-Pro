import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { EventCard, KpiCard, LotCard } from "../components/farm";
import type { AppTab } from "../components/layout/BottomTabBar";
import { MobileAppShell } from "../components/layout";
import { ProducerProfileModal } from "../components/producer/ProducerProfileModal";
import { ProducerWelcomeHeader } from "../components/producer/ProducerWelcomeHeader";
import { IconButton, PrimaryButton } from "../components/ui";
import { useSession } from "../context/SessionContext";
import { welcomeFirstName } from "../lib/userDisplay";
import { mobileColors, mobileSpacing, mobileTypography } from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

const PRODUCER_TABS: AppTab[] = ["home", "lots", "events"];

/**
 * Tableau de bord producteur : en-tête accueil (photo + prénom), menu profil en modal, 3 onglets.
 */
export function ProducerDashboardScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { authMe } = useSession();
  const [profileOpen, setProfileOpen] = useState(false);

  const user = authMe?.user;

  const firstName = useMemo(() => welcomeFirstName(user), [user]);

  const customHeader = (
    <View style={styles.heroBar}>
      <ProducerWelcomeHeader
        welcomeLabel={t("producer.welcomeLine")}
        firstName={firstName}
        avatarUrl={user?.avatarUrl ?? null}
        onPressAvatar={() => setProfileOpen(true)}
      />
      <IconButton
        icon="add"
        onPress={() => navigation.navigate("FarmEventsFeed")}
      />
    </View>
  );

  return (
    <>
      <MobileAppShell
        customHeader={customHeader}
        tabBarTabs={PRODUCER_TABS}
        activeTab="home"
        onTabChange={(tab) => {
          if (tab === "home") {
            return;
          }
          if (tab === "lots") {
            navigation.navigate("FarmList");
          }
          if (tab === "events") {
            navigation.navigate("FarmEventsFeed");
          }
        }}
      >
        <ScrollView contentContainerStyle={styles.wrap}>
          <View style={styles.kpiRow}>
            <View style={styles.kpiItem}>
              <KpiCard label="Lots actifs" value="12" />
            </View>
            <View style={styles.kpiItem}>
              <KpiCard label="Alertes santé" value="2" tone="danger" />
            </View>
          </View>

          <Text style={styles.sectionTitle}>Lots à surveiller</Text>
          <View style={styles.list}>
            <LotCard
              lotName="Lot #12 - Post-sevrage"
              stage="Bâtiment A"
              headCount={148}
              mortality7d={3}
              status="À surveiller"
              onPress={() => navigation.navigate("FarmList")}
            />
            <LotCard
              lotName="Lot #8 - Croissance"
              stage="Bâtiment C"
              headCount={192}
              mortality7d={1}
              status="En croissance"
              onPress={() => navigation.navigate("FarmList")}
            />
          </View>

          <Text style={styles.sectionTitle}>Derniers événements</Text>
          <View style={styles.list}>
            <EventCard
              title="Vaccination planifiée"
              subtitle="Lot #8 - Croissance"
              timestamp="08:42"
            />
            <EventCard
              title="Mortalité déclarée"
              subtitle="Lot #12 - Post-sevrage"
              timestamp="07:50"
            />
          </View>

          <PrimaryButton
            label="+ Enregistrer un événement"
            onPress={() => navigation.navigate("FarmList")}
          />
        </ScrollView>
      </MobileAppShell>
      <ProducerProfileModal
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  heroBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border,
    backgroundColor: mobileColors.background,
    minHeight: 56
  },
  wrap: {
    padding: mobileSpacing.lg,
    paddingBottom: mobileSpacing.xxl,
    gap: mobileSpacing.lg
  },
  kpiRow: {
    flexDirection: "row",
    gap: mobileSpacing.md
  },
  kpiItem: {
    flex: 1
  },
  sectionTitle: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary
  },
  list: {
    gap: mobileSpacing.md
  }
});
