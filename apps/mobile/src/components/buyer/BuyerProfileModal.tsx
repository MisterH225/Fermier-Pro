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
import { fetchBuyerDashboard } from "../../lib/api";
import { resolveActiveProfileAvatarUrl } from "../../lib/profileAvatar";
import { welcomeFirstName } from "../../lib/userDisplay";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { buyerColors, buyerRadius } from "../../theme/buyerTheme";

const AVATAR = 108;

type BuyerProfileModalProps = {
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

export function BuyerProfileModal({ visible, onClose }: BuyerProfileModalProps) {
  const { t } = useTranslation();
  const { accessToken, activeProfileId, authMe } = useSession();

  const dashQ = useQuery({
    queryKey: ["buyerDashboard", activeProfileId, "profileModal"],
    queryFn: () => fetchBuyerDashboard(accessToken!, activeProfileId),
    enabled: Boolean(visible && accessToken)
  });

  const profile = dashQ.data?.profile;
  const kpis = dashQ.data?.kpis;

  const avatarUri = useMemo(
    () => resolveActiveProfileAvatarUrl(authMe, activeProfileId),
    [authMe, activeProfileId]
  );

  const displayName =
    welcomeFirstName(authMe?.user ?? null) ?? t("buyer.dashboard.defaultName");

  const buyerTypeLabel =
    profile?.buyerType === "individual"
      ? t("buyer.profile.typeIndividual")
      : profile?.buyerType === "professional"
        ? t("buyer.profile.typeProfessional")
        : profile?.buyerType ?? "—";

  const categoriesLabel =
    profile?.preferredCategories?.length
      ? profile.preferredCategories.join(", ")
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
                <Ionicons name="cart" size={44} color={buyerColors.primary} />
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

          <SectionHeader label={t("buyer.profile.sectionBuyer")} />
          <View style={styles.proCard}>
            <InfoBlock label={t("buyer.profile.buyerType")} value={buyerTypeLabel} />
            <InfoBlock
              label={t("buyer.profile.preferredCategories")}
              value={categoriesLabel}
            />
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statVal}>{kpis?.pendingProposals ?? "—"}</Text>
                <Text style={styles.statLbl}>{t("buyer.kpi.pending")}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statVal}>{kpis?.purchasesCount ?? "—"}</Text>
                <Text style={styles.statLbl}>{t("buyer.kpi.purchases")}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statVal}>{kpis?.favoritesCount ?? "—"}</Text>
                <Text style={styles.statLbl}>{t("buyer.kpi.favorites")}</Text>
              </View>
            </View>
          </View>

          <SectionHeader label={t("buyer.profile.sectionAccount")} />
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
    backgroundColor: buyerColors.canvas
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
    color: buyerColors.primary,
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
    backgroundColor: buyerColors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: buyerColors.border
  },
  heroName: {
    marginTop: mobileSpacing.lg,
    fontSize: 26,
    fontWeight: "700",
    color: buyerColors.textPrimary,
    textAlign: "center",
    maxWidth: "100%"
  },
  heroEmail: {
    marginTop: 4,
    ...mobileTypography.meta,
    color: buyerColors.textSecondary,
    textAlign: "center",
    maxWidth: "100%"
  },
  sectionHeader: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: buyerColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: mobileSpacing.md,
    marginBottom: mobileSpacing.xs
  },
  proCard: {
    backgroundColor: buyerColors.cardBg,
    borderRadius: buyerRadius.card,
    padding: mobileSpacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: buyerColors.border,
    gap: mobileSpacing.md
  },
  infoBlock: { gap: 2 },
  label: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary
  },
  value: {
    color: buyerColors.textPrimary,
    fontWeight: "500",
    fontSize: 15
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: buyerColors.primaryLight,
    borderRadius: buyerRadius.button,
    padding: mobileSpacing.md,
    marginTop: mobileSpacing.xs
  },
  stat: { alignItems: "center", flex: 1 },
  statVal: { fontSize: 20, fontWeight: "800", color: buyerColors.primary },
  statLbl: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary,
    textAlign: "center",
    marginTop: 2
  }
});
