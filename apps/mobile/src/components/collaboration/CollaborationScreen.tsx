import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenSection } from "../layout/ScreenSection";
import { TabContent, TabSelector } from "../tabs";
import { useSession } from "../../context/SessionContext";
import { fetchFarm, fetchFarmMembers } from "../../lib/api";
import { hasFarmScope } from "../../lib/menuVisibility";
import type { RootStackParamList } from "../../types/navigation";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { ActivityHistory } from "./ActivityHistory";
import { DirectoryTab } from "./DirectoryTab";
import { InviteSection } from "./InviteSection";
import { MembersList } from "./MembersList";

type Props = {
  farmId: string | null;
  farmName: string | null;
};

export function CollaborationScreen({ farmId, farmName }: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken, activeProfileId, authMe } = useSession();

  const membersQ = useQuery({
    queryKey: ["farmMembers", farmId, activeProfileId],
    queryFn: () => fetchFarmMembers(accessToken, farmId!, activeProfileId),
    enabled: Boolean(accessToken && farmId)
  });

  const farmQ = useQuery({
    queryKey: ["farm", farmId, activeProfileId],
    queryFn: () => fetchFarm(accessToken, farmId!, activeProfileId),
    enabled: Boolean(accessToken && farmId)
  });

  const canManageInvites = hasFarmScope(
    farmQ.data?.effectiveScopes,
    "invitations.manage"
  );
  const teamPremiumActive = authMe?.producerProfile?.teamPremiumActive ?? false;
  const canInviteTeam = canManageInvites && teamPremiumActive;
  const showPremiumGate = canManageInvites && !teamPremiumActive;

  const isRefreshing = membersQ.isFetching && !membersQ.isLoading;

  const refreshControl = (
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={() => void membersQ.refetch()}
      tintColor={mobileColors.accent}
    />
  );

  if (!farmId) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.emptyWrap}>
          <Text style={styles.noFarmTxt}>{t("collab.noFarm")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <TabSelector
        testIDPrefix="com-tab"
        defaultTab="invite"
        tabs={[
          {
            key: "invite",
            label: t("collab.tabInvite"),
            content: (
              <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={refreshControl}
                contentContainerStyle={styles.scrollPad}
              >
                <TabContent>
                  {showPremiumGate ? (
                    <View style={styles.premiumBanner}>
                      <Text style={styles.premiumBannerTitle}>
                        {t("collab.teamPremiumRequiredTitle")}
                      </Text>
                      <Text style={styles.premiumBannerBody}>
                        {t("collab.teamPremiumRequiredBody")}
                      </Text>
                      <Pressable
                        style={styles.premiumBannerCta}
                        onPress={() => navigation.navigate("ProducerSubscription")}
                      >
                        <Text style={styles.premiumBannerCtaTxt}>
                          {t("collab.teamPremiumCta")}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                  <ScreenSection title={t("collab.inviteSectionTitle")}>
                    <InviteSection
                      farmId={farmId}
                      farmName={farmName}
                      canManageInvites={canInviteTeam}
                    />
                  </ScreenSection>
                </TabContent>
              </ScrollView>
            )
          },
          {
            key: "directory",
            label: t("collab.tabDirectory"),
            content: (
              <View style={styles.directoryWrap}>
                <DirectoryTab
                  farmId={farmId}
                  farmName={farmName ?? ""}
                  canManageInvites={canInviteTeam}
                />
              </View>
            )
          },
          {
            key: "members",
            label: t("collab.tabMembers"),
            content: (
              <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={refreshControl}
                contentContainerStyle={styles.scrollPad}
              >
                <TabContent>
                  <ScreenSection title={t("collab.tabMembers")}>
                    <MembersList
                      farmId={farmId}
                      farmName={farmName}
                      canManageInvites={canManageInvites}
                    />
                  </ScreenSection>
                </TabContent>
              </ScrollView>
            )
          },
          {
            key: "history",
            label: t("collab.tabHistory"),
            content: (
              <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={refreshControl}
                contentContainerStyle={styles.scrollPad}
              >
                <TabContent>
                  <ScreenSection title={t("collab.tabHistory")}>
                    <ActivityHistory
                      farmId={farmId}
                      members={membersQ.data ?? []}
                    />
                  </ScreenSection>
                </TabContent>
              </ScrollView>
            )
          }
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: mobileColors.canvas
  },
  scrollPad: {
    flexGrow: 1
  },
  directoryWrap: {
    flex: 1,
    minHeight: 400,
    paddingBottom: mobileSpacing.lg
  },
  pageHeader: {
    gap: mobileSpacing.xs
  },
  pageTitle: {
    ...mobileTypography.title,
    color: mobileColors.textPrimary
  },
  farmSubtitle: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  sectionLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: mobileSpacing.xxl
  },
  noFarmTxt: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    textAlign: "center",
    lineHeight: 22
  },
  premiumBanner: {
    marginBottom: mobileSpacing.md,
    padding: mobileSpacing.md,
    borderRadius: 12,
    backgroundColor: mobileColors.accentSoft,
    borderWidth: 1,
    borderColor: mobileColors.accent,
    gap: mobileSpacing.sm
  },
  premiumBannerTitle: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  premiumBannerBody: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    lineHeight: 20
  },
  premiumBannerCta: {
    alignSelf: "flex-start",
    paddingVertical: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.md,
    borderRadius: 999,
    backgroundColor: mobileColors.accent
  },
  premiumBannerCtaTxt: {
    ...mobileTypography.meta,
    color: "#fff",
    fontWeight: "700"
  }
});
