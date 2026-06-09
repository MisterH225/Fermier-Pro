import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSession } from "../../context/SessionContext";
import { fetchMyAdminMessagesUnreadCount } from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { AdminMessagesModal } from "./AdminMessagesModal";

/**
 * Bannière compacte affichée quand l'utilisateur a des messages admin non lus
 * (avertissement, suspension, info plateforme). Visible indépendamment des
 * permissions push afin que le destinataire voie toujours l'alerte in-app.
 */
export function AdminMessagesBanner() {
  const { t } = useTranslation();
  const { accessToken } = useSession();
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["auth.me.adminMessages.unreadCount"],
    queryFn: () => fetchMyAdminMessagesUnreadCount(accessToken!),
    enabled: Boolean(accessToken),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true
  });

  const count = q.data?.count ?? 0;
  if (count <= 0) {
    return open ? (
      <AdminMessagesModal visible={open} onClose={() => setOpen(false)} />
    ) : null;
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.banner,
          pressed && { opacity: 0.92 }
        ]}
        accessibilityRole="button"
        accessibilityLabel={t("adminMessages.bannerA11y", "Voir les messages admin")}
      >
        <View style={styles.iconBox}>
          <Ionicons name="megaphone" size={20} color={mobileColors.onAccent} />
        </View>
        <View style={styles.txCol}>
          <Text style={styles.title} numberOfLines={1}>
            {t("adminMessages.bannerTitle", "Message de l'administration")}
          </Text>
          <Text style={styles.body} numberOfLines={1}>
            {count > 1
              ? t("adminMessages.bannerCount", "{{count}} messages non lus", { count })
              : t("adminMessages.bannerOne", "1 nouveau message — appuyez pour ouvrir")}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={mobileColors.onAccent} />
      </Pressable>
      <AdminMessagesModal visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.md,
    backgroundColor: mobileColors.accent,
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
    color: mobileColors.onAccent,
    fontWeight: "700"
  },
  body: {
    ...mobileTypography.meta,
    color: "rgba(255,255,255,0.92)"
  }
});
