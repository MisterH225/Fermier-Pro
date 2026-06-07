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
  Switch,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AccountSettingsPanel } from "../account/AccountSettingsPanel";
import { ActiveProfileSwitcherControl } from "../account/ActiveProfileSwitcherControl";
import { ProfileLanguagePill } from "../account/ProfileLanguagePill";
import { useSession } from "../../context/SessionContext";
import { fetchVetDashboard, fetchVetProfileMe } from "../../lib/api";
import { resolveActiveProfileAvatarUrl } from "../../lib/profileAvatar";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { vetColors, vetRadius } from "../../theme/vetTheme";

const AVATAR = 108;

type VetProfileModalProps = {
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

export function VetProfileModal({ visible, onClose }: VetProfileModalProps) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId, authMe } = useSession();

  const profileQ = useQuery({
    queryKey: ["vetProfileMe", activeProfileId],
    queryFn: () => fetchVetProfileMe(accessToken!, activeProfileId),
    enabled: Boolean(visible && accessToken)
  });

  const dashQ = useQuery({
    queryKey: ["vetDashboard", activeProfileId, "profileModal"],
    queryFn: () => fetchVetDashboard(accessToken!, activeProfileId),
    enabled: Boolean(visible && accessToken)
  });

  const vet = profileQ.data;
  const stats = dashQ.data?.stats;

  const avatarUri = useMemo(() => {
    const fromAuth = resolveActiveProfileAvatarUrl(authMe, activeProfileId);
    return fromAuth ?? vet?.profilePhotoUrl ?? null;
  }, [authMe, activeProfileId, vet?.profilePhotoUrl]);

  const displayName = vet?.fullName ?? authMe?.user.fullName ?? "—";

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
                <Ionicons name="medkit" size={44} color={vetColors.primary} />
              </View>
            )}
            <Text style={styles.heroName} numberOfLines={2}>
              {displayName}
            </Text>
            {vet?.primarySpecialty ? (
              <Text style={styles.heroSpecialty} numberOfLines={1}>
                {vet.primarySpecialty}
              </Text>
            ) : null}
            {vet?.isVerified ? (
              <Text style={styles.verified}>
                {t("vet.profile.verified")}
              </Text>
            ) : null}
            {authMe?.user.email ? (
              <Text style={styles.heroEmail} numberOfLines={1}>
                {authMe.user.email}
              </Text>
            ) : null}
            <ActiveProfileSwitcherControl variant="hero" />
          </View>

          <SectionHeader label={t("vet.profile.sectionProfessional")} />
          <View style={styles.proCard}>
            <InfoBlock
              label={t("vet.profile.zone")}
              value={vet?.locationLabel ?? "—"}
            />
            <InfoBlock
              label={t("vet.profile.school")}
              value={`${vet?.schoolName ?? "—"} (${vet?.schoolCountry ?? "—"}) — ${vet?.graduationYear ?? "—"}`}
            />
            <View style={styles.availRow}>
              <Text style={styles.label}>{t("vet.profile.availability")}</Text>
              <Switch
                value={vet?.availability ?? true}
                disabled
                trackColor={{ true: vetColors.primary, false: "#ccc" }}
              />
            </View>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statVal}>{stats?.farmsFollowed ?? "—"}</Text>
                <Text style={styles.statLbl}>{t("vet.profile.statsFarms")}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statVal}>
                  {stats?.visitsCompleted ?? "—"}
                </Text>
                <Text style={styles.statLbl}>
                  {t("vet.profile.statsVisits")}
                </Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statVal}>
                  {stats?.averageRating != null
                    ? stats.averageRating.toFixed(1)
                    : "—"}
                </Text>
                <Text style={styles.statLbl}>
                  {t("vet.profile.statsRating")}
                </Text>
              </View>
            </View>
          </View>

          <SectionHeader label={t("vet.profile.sectionAccount")} />
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
    backgroundColor: vetColors.canvas
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
    color: vetColors.primary,
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
    backgroundColor: vetColors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: vetColors.border
  },
  heroName: {
    marginTop: mobileSpacing.lg,
    fontSize: 26,
    fontWeight: "700",
    color: vetColors.textPrimary,
    textAlign: "center",
    maxWidth: "100%"
  },
  heroSpecialty: {
    marginTop: 4,
    ...mobileTypography.body,
    color: vetColors.textSecondary,
    textAlign: "center"
  },
  verified: {
    marginTop: 6,
    color: vetColors.success,
    fontWeight: "600",
    fontSize: 14
  },
  heroEmail: {
    marginTop: 4,
    ...mobileTypography.meta,
    color: vetColors.textSecondary,
    textAlign: "center",
    maxWidth: "100%"
  },
  sectionHeader: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: vetColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: mobileSpacing.md,
    marginBottom: mobileSpacing.xs
  },
  proCard: {
    backgroundColor: vetColors.cardBg,
    borderRadius: vetRadius.card,
    padding: mobileSpacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: vetColors.border,
    gap: mobileSpacing.md
  },
  infoBlock: { gap: 2 },
  label: {
    ...mobileTypography.meta,
    color: vetColors.textSecondary
  },
  value: {
    color: vetColors.textPrimary,
    fontWeight: "500",
    fontSize: 15
  },
  availRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: vetColors.primaryLight,
    borderRadius: vetRadius.button,
    padding: mobileSpacing.md,
    marginTop: mobileSpacing.xs
  },
  stat: { alignItems: "center", flex: 1 },
  statVal: { fontSize: 20, fontWeight: "800", color: vetColors.primary },
  statLbl: {
    ...mobileTypography.meta,
    color: vetColors.textSecondary,
    textAlign: "center",
    marginTop: 2
  }
});
