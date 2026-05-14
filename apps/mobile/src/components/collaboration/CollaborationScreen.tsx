import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void membersQ.refetch()}
            tintColor={mobileColors.accent}
          />
        }
      >
        {/* En-tête */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>{t("collab.screenTitle")}</Text>
          {farmName ? (
            <Text style={styles.farmSubtitle} numberOfLines={1}>
              {farmName}
            </Text>
          ) : null}
        </View>

        {/* Section 1 — Invitation */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {t("collab.inviteSectionTitle")}
          </Text>
          <InviteSection farmId={farmId} farmName={farmName} />
        </View>

        {/* Section 2 — Membres actifs */}
        <View style={styles.section}>
          <MembersList farmId={farmId} farmName={farmName} />
        </View>

        {/* Section 3 — Historique */}
        <View style={styles.section}>
          <ActivityHistory
            farmId={farmId}
            members={membersQ.data ?? []}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: mobileColors.surface
  },
  scroll: {
    paddingHorizontal: mobileSpacing.lg,
    paddingBottom: mobileSpacing.xxl * 2,
    gap: mobileSpacing.lg
  },
  pageHeader: {
    paddingTop: mobileSpacing.lg,
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
  section: {
    gap: mobileSpacing.sm
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
