import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, StyleSheet, Text } from "react-native";
import { EventList } from "../../components/lists/EventList";
import type { EventItem } from "../../components/lists/types";
import { TechMobileShell } from "../../components/layout/TechMobileShell";
import { useTechBottomChromePad } from "../../context/TechBottomChromeContext";
import { useSession } from "../../context/SessionContext";
import { fetchTechnicianActivity } from "../../lib/api";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { techColors } from "../../theme/technicianTheme";

export function TechTrackingScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";
  const bottomPad = useTechBottomChromePad();
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
      <ScrollView contentContainerStyle={[styles.wrap, { paddingBottom: bottomPad }]}>
        <Text style={styles.title}>{t("tech.tracking.title")}</Text>
        {activityQ.isLoading ? <ActivityIndicator color={techColors.primary} /> : null}
        {items.length > 0 ? <EventList data={items} /> : (
          <Text style={styles.empty}>{t("tech.dashboard.noActivity")}</Text>
        )}
      </ScrollView>
    </TechMobileShell>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: mobileSpacing.lg, gap: mobileSpacing.md },
  title: { ...mobileTypography.cardTitle, fontSize: 20, color: techColors.textPrimary },
  empty: { ...mobileTypography.body, color: techColors.textSecondary }
});
