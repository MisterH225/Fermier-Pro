import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Image, StyleSheet, Switch, Text, View } from "react-native";
import { BaseModal } from "../modals/BaseModal";
import { ActiveProfileSwitcherControl } from "../account/ActiveProfileSwitcherControl";
import { useSession } from "../../context/SessionContext";
import { fetchVetDashboard, fetchVetProfileMe } from "../../lib/api";
import { vetColors } from "../../theme/vetTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type VetProfileModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function VetProfileModal({ visible, onClose }: VetProfileModalProps) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId, authMe } = useSession();
  const hasProducer = authMe?.profiles.some((p) => p.type === "producer");

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

  return (
    <BaseModal visible={visible} onClose={onClose} title={t("vet.profile.title")}>
      <View style={styles.header}>
        {vet?.profilePhotoUrl ? (
          <Image source={{ uri: vet.profilePhotoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPh]}>
            <Text style={styles.avatarEmoji}>🩺</Text>
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.name}>{vet?.fullName ?? authMe?.user.fullName ?? "—"}</Text>
          <Text style={styles.specialty}>{vet?.primarySpecialty ?? "—"}</Text>
          {vet?.isVerified ? (
            <Text style={styles.verified}>✅ {t("vet.profile.verified")}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>{t("vet.profile.zone")}</Text>
        <Text style={styles.value}>{vet?.locationLabel ?? "—"}</Text>
      </View>
      <View style={styles.block}>
        <Text style={styles.label}>{t("vet.profile.school")}</Text>
        <Text style={styles.value}>
          {vet?.schoolName ?? "—"} ({vet?.schoolCountry ?? "—"}) — {vet?.graduationYear ?? "—"}
        </Text>
      </View>

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
          <Text style={styles.statVal}>{stats?.visitsCompleted ?? "—"}</Text>
          <Text style={styles.statLbl}>{t("vet.profile.statsVisits")}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statVal}>
            {stats?.averageRating != null ? stats.averageRating.toFixed(1) : "—"}
          </Text>
          <Text style={styles.statLbl}>{t("vet.profile.statsRating")}</Text>
        </View>
      </View>

      {hasProducer ? (
        <View style={styles.switchWrap}>
          <ActiveProfileSwitcherControl variant="hero" />
        </View>
      ) : null}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.md,
    marginBottom: mobileSpacing.lg
  },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarPh: {
    backgroundColor: vetColors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarEmoji: { fontSize: 28 },
  headerText: { flex: 1, gap: 2 },
  name: {
    ...mobileTypography.title,
    fontSize: 20,
    fontWeight: "800",
    color: vetColors.textPrimary
  },
  specialty: { color: vetColors.textSecondary },
  verified: { color: vetColors.success, fontWeight: "600", marginTop: 4 },
  block: { marginBottom: mobileSpacing.md },
  label: {
    ...mobileTypography.meta,
    color: vetColors.textSecondary,
    marginBottom: 2
  },
  value: { color: vetColors.textPrimary, fontWeight: "500" },
  availRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: mobileSpacing.lg
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: vetColors.primaryLight,
    borderRadius: 12,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.lg
  },
  stat: { alignItems: "center", flex: 1 },
  statVal: { fontSize: 20, fontWeight: "800", color: vetColors.primary },
  statLbl: {
    ...mobileTypography.meta,
    color: vetColors.textSecondary,
    textAlign: "center",
    marginTop: 2
  },
  switchWrap: { marginTop: mobileSpacing.sm }
});
