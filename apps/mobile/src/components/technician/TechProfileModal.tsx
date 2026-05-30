import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AccountSettingsPanel } from "../account/AccountSettingsPanel";
import { ActiveProfileSwitcherControl } from "../account/ActiveProfileSwitcherControl";
import { ProfileLanguagePill } from "../account/ProfileLanguagePill";
import { useSession } from "../../context/SessionContext";
import { fetchTechnicianDashboard } from "../../lib/api";
import { resolveActiveProfileAvatarUrl } from "../../lib/profileAvatar";
import { welcomeFirstName } from "../../lib/userDisplay";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { techColors, techRadius } from "../../theme/technicianTheme";

const AVATAR = 108;

type TechProfileModalProps = {
  visible: boolean;
  onClose: () => void;
};

function SectionHeader({ label }: { label: string }) {
  return (
    <Text style={styles.sectionHeader} accessibilityRole="header">
      {label}
    </Text>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function TechProfileModal({ visible, onClose }: TechProfileModalProps) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId, authMe } = useSession();

  const dashQ = useQuery({
    queryKey: ["techDashboard", activeProfileId, "profileModal"],
    queryFn: () => fetchTechnicianDashboard(accessToken!, activeProfileId),
    enabled: Boolean(visible && accessToken)
  });

  const techProfile = authMe?.technicianProfile;
  const farmsCount = dashQ.data?.farms.length ?? 0;

  const avatarUri = useMemo(
    () => resolveActiveProfileAvatarUrl(authMe, activeProfileId),
    [authMe, activeProfileId]
  );

  const displayName =
    welcomeFirstName(authMe?.user ?? null) ?? t("tech.dashboard.defaultName");

  const experienceLabel = techProfile?.experienceYears?.trim()
    ? techProfile.experienceYears
    : "—";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.topBar}>
          <ProfileLanguagePill
            alignMenuWithCloseRow
            edgePadding={mobileSpacing.lg}
          />
          <Pressable
            onPress={onClose}
            hitSlop={14}
            accessibilityRole="button"
            accessibilityLabel={t("producer.close")}
            style={styles.closeHit}
          >
            <Text style={styles.closeText}>{t("producer.close")}</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPh]}>
                <Ionicons name="construct" size={44} color={techColors.primary} />
              </View>
            )}
            <Text style={styles.heroName} numberOfLines={2}>
              {displayName}
            </Text>
            {authMe?.user.email ? (
              <Text style={styles.heroEmail} numberOfLines={1}>
                {authMe.user.email}
              </Text>
            ) : null}
            <ActiveProfileSwitcherControl variant="hero" />
          </View>

          <SectionHeader label={t("tech.profile.sectionTech")} />
          <View style={styles.proCard}>
            <InfoBlock
              label={t("tech.profile.experience")}
              value={experienceLabel}
            />
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statVal}>{farmsCount}</Text>
                <Text style={styles.statLbl}>{t("tech.profile.farmsAssigned")}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statVal}>
                  {dashQ.data?.tasksTodayCount ?? "—"}
                </Text>
                <Text style={styles.statLbl}>{t("tech.profile.tasksToday")}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statVal}>
                  {dashQ.data?.alertsCount ?? "—"}
                </Text>
                <Text style={styles.statLbl}>{t("tech.kpi.alerts")}</Text>
              </View>
            </View>
          </View>

          <SectionHeader label={t("tech.profile.sectionAccount")} />
          <AccountSettingsPanel
            onBeforeNavigate={onClose}
            compact
            hideLanguagePicker
            hideActiveProfileSwitcher
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: techColors.canvas
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.sm
  },
  closeHit: {
    minWidth: 72,
    alignItems: "flex-end",
    justifyContent: "center",
    minHeight: 36
  },
  closeText: {
    ...mobileTypography.body,
    color: techColors.primary,
    fontWeight: "600",
    fontSize: 17
  },
  scroll: {
    paddingHorizontal: mobileSpacing.lg,
    paddingBottom: mobileSpacing.xxl,
    gap: mobileSpacing.sm
  },
  hero: {
    alignItems: "center",
    paddingTop: mobileSpacing.md,
    paddingBottom: mobileSpacing.lg
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2
  },
  avatarPh: {
    backgroundColor: techColors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: techColors.border
  },
  heroName: {
    marginTop: mobileSpacing.lg,
    fontSize: 26,
    fontWeight: "700",
    color: techColors.textPrimary,
    textAlign: "center",
    maxWidth: "100%"
  },
  heroEmail: {
    marginTop: 4,
    ...mobileTypography.meta,
    color: techColors.textSecondary,
    textAlign: "center",
    maxWidth: "100%"
  },
  sectionHeader: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: techColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: mobileSpacing.md,
    marginBottom: mobileSpacing.xs
  },
  proCard: {
    backgroundColor: techColors.cardBg,
    borderRadius: techRadius.card,
    padding: mobileSpacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: techColors.border,
    gap: mobileSpacing.md
  },
  infoBlock: { gap: 2 },
  label: {
    ...mobileTypography.meta,
    color: techColors.textSecondary
  },
  value: {
    color: techColors.textPrimary,
    fontWeight: "500",
    fontSize: 15
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: techColors.primaryLight,
    borderRadius: techRadius.button,
    padding: mobileSpacing.md,
    marginTop: mobileSpacing.xs
  },
  stat: { alignItems: "center", flex: 1 },
  statVal: { fontSize: 20, fontWeight: "800", color: techColors.primary },
  statLbl: {
    ...mobileTypography.meta,
    color: techColors.textSecondary,
    textAlign: "center",
    marginTop: 2
  }
});
