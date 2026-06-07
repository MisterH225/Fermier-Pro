import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSession } from "../../context/SessionContext";
import { fetchMyPendingInvitations } from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { PendingInvitationsModal } from "./PendingInvitationsModal";

/**
 * Bannière affichée quand l'utilisateur a au moins une invitation collaborative
 * en attente. Indépendante des push (visible toujours in-app).
 */
export function PendingInvitationsBanner() {
  const { t } = useTranslation();
  const { accessToken, activeProfileId } = useSession();
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["myPendingInvitations.banner", activeProfileId],
    queryFn: () => fetchMyPendingInvitations(accessToken, activeProfileId),
    enabled: Boolean(accessToken),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true
  });

  const count = q.data?.length ?? 0;
  if (count <= 0) {
    return open ? (
      <PendingInvitationsModal
        visible={open}
        onClose={() => setOpen(false)}
      />
    ) : null;
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.banner, pressed && { opacity: 0.92 }]}
        accessibilityRole="button"
        accessibilityLabel={t("collab.pendingInvitations.bannerA11y")}
      >
        <View style={styles.iconBox}>
          <Ionicons name="mail" size={20} color="#fff" />
        </View>
        <View style={styles.txCol}>
          <Text style={styles.title} numberOfLines={1}>
            {t("collab.pendingInvitations.bannerTitle")}
          </Text>
          <Text style={styles.body} numberOfLines={1}>
            {count > 1
              ? t("collab.pendingInvitations.bannerCount", { count })
              : t("collab.pendingInvitations.bannerOne")}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#fff" />
      </Pressable>
      <PendingInvitationsModal
        visible={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.md,
    backgroundColor: mobileColors.success,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.lg,
    marginHorizontal: mobileSpacing.lg,
    marginBottom: mobileSpacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center"
  },
  txCol: { flex: 1, minWidth: 0 },
  title: {
    ...mobileTypography.body,
    color: "#fff",
    fontWeight: "700"
  },
  body: {
    ...mobileTypography.meta,
    color: "rgba(255,255,255,0.92)"
  }
});
