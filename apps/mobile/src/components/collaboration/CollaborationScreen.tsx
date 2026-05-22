import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenSection } from "../layout/ScreenSection";
import { TabContent, TabSelector } from "../tabs";
import { useSession } from "../../context/SessionContext";
import { fetchFarmMembers } from "../../lib/api";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { ActivityHistory } from "./ActivityHistory";
import { InviteSection } from "./InviteSection";
import { MembersList } from "./MembersList";

type Props = {
  farmId: string | null;
  farmName: string | null;
};

export function CollaborationScreen({ farmId, farmName }: Props) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();

  const membersQ = useQuery({
    queryKey: ["farmMembers", farmId, activeProfileId],
    queryFn: () => fetchFarmMembers(accessToken, farmId!, activeProfileId),
    enabled: Boolean(accessToken && farmId)
  });

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
                  <ScreenSection title={t("collab.inviteSectionTitle")}>
                    <InviteSection farmId={farmId} farmName={farmName} />
                  </ScreenSection>
                </TabContent>
              </ScrollView>
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
                    <MembersList farmId={farmId} farmName={farmName} />
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
  }
});
