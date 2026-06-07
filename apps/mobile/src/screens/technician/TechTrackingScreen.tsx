import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text } from "react-native";
import { ListSkeleton } from "../../components/common/SkeletonBlocks";
import { EventList } from "../../components/lists/EventList";
import type { EventItem } from "../../components/lists/types";
import {
  ProfileSectionEmpty,
  profileScreenScrollContent,
  ScreenSection
} from "../../components/layout";
import { TechMobileShell } from "../../components/layout/TechMobileShell";
import { useBottomInset } from "../../hooks/useBottomInset";
import { useSession } from "../../context/SessionContext";
import { fetchTechnicianActivity } from "../../lib/api";
import { mobileSpacing } from "../../theme/mobileTheme";
import { techColors } from "../../theme/technicianTheme";

export function TechTrackingScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";
  const bottomInset = useBottomInset();
  const { accessToken, activeProfileId } = useSession();

  const activityQ = useQuery({
    queryKey: ["techActivity", activeProfileId, "tracking"],
    queryFn: () => fetchTechnicianActivity(accessToken!, activeProfileId, undefined, 50),
    enabled: Boolean(accessToken)
  });

  const items: EventItem[] = (activityQ.data ?? []).map((a) => {
    const d = new Date(a.createdAt);
    const date = Number.isNaN(d.getTime())
      ? "—"
      : d.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    return {
      id: a.id,
      title: a.action,
      subtitle: `${a.farmName} · ${a.module}`,
      date,
      valueType: "neutral",
      iconType: "custom",
      customIcon: "time-outline",
      iconColor: techColors.primary
    };
  });

  return (
    <TechMobileShell hideTopBar>
      <ScrollView
        contentContainerStyle={[
          profileScreenScrollContent,
          { paddingBottom: bottomInset }
        ]}
      >
        <ScreenSection title={t("tech.tracking.sectionLog")}>
          {activityQ.isLoading ? (
            <ListSkeleton count={5} />
          ) : items.length > 0 ? (
            <EventList data={items} />
          ) : (
            <ProfileSectionEmpty>{t("tech.dashboard.noActivity")}</ProfileSectionEmpty>
          )}
        </ScreenSection>
      </ScrollView>
    </TechMobileShell>
  );
}

