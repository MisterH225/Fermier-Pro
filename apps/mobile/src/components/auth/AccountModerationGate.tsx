import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useSession } from "../../context/SessionContext";
import { mobileColors, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { AdminMessagesModal } from "../admin/AdminMessagesModal";

const SUPPORT_EMAIL = "support@fermierpro.com";

function ViewMessagesButton({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        style={styles.secondaryBtn}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryBtnTx}>{label}</Text>
      </Pressable>
      <AdminMessagesModal visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function AccountModerationGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { authMe, activeProfileId } = useSession();
  const user = authMe?.user;
  if (!user) {
    return <>{children}</>;
  }

  if (user.accountStatus === "banned") {
    return (
      <View style={styles.wrap}>
        <Text style={styles.icon}>🚫</Text>
        <Text style={styles.title}>{t("moderation.bannedTitle")}</Text>
        <Text style={styles.body}>
          {user.bannedReason ?? t("moderation.bannedDefault")}
        </Text>
        <Pressable style={styles.btn} onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
          <Text style={styles.btnTx}>{t("moderation.contactSupport")}</Text>
        </Pressable>
        <ViewMessagesButton
          label={t("adminMessages.openCta", "Voir les messages de l'administration")}
        />
      </View>
    );
  }

  if (user.accountStatus === "suspended") {
    const until = user.suspendedUntil;
    return (
      <View style={styles.wrap}>
        <Text style={styles.icon}>🔒</Text>
        <Text style={styles.title}>{t("moderation.suspendedTitle")}</Text>
        <Text style={styles.body}>
          {user.suspendedReason ?? t("moderation.suspendedDefault")}
        </Text>
        {until ? (
          <Text style={styles.meta}>
            {t("moderation.until", {
              date: new Date(until).toLocaleDateString()
            })}
          </Text>
        ) : (
          <Text style={styles.meta}>{t("moderation.indefinite")}</Text>
        )}
        <Pressable style={styles.btn} onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
          <Text style={styles.btnTx}>{t("moderation.contactSupport")}</Text>
        </Pressable>
        <ViewMessagesButton
          label={t("adminMessages.openCta", "Voir les messages de l'administration")}
        />
      </View>
    );
  }

  const active = authMe?.profiles.find((p) => p.id === activeProfileId);
  if (
    active &&
    (active.profileStatus === "suspended" || active.profileStatus === "banned")
  ) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.icon}>🔒</Text>
        <Text style={styles.title}>{t("moderation.profileSuspendedTitle")}</Text>
        <Text style={styles.body}>
          {active.profileSuspendedReason ?? t("moderation.profileSuspendedDefault")}
        </Text>
        <Text style={styles.meta}>{t("moderation.switchProfileHint")}</Text>
        <ViewMessagesButton
          label={t("adminMessages.openCta", "Voir les messages de l'administration")}
        />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: mobileColors.canvas,
    alignItems: "center",
    justifyContent: "center",
    padding: mobileSpacing.xl,
    gap: mobileSpacing.md
  },
  icon: { fontSize: 48 },
  title: {
    ...mobileTypography.title,
    fontSize: 22,
    textAlign: "center"
  },
  body: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    textAlign: "center"
  },
  meta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textAlign: "center"
  },
  btn: {
    marginTop: mobileSpacing.lg,
    backgroundColor: mobileColors.accent,
    paddingHorizontal: mobileSpacing.xl,
    paddingVertical: 14,
    borderRadius: 12
  },
  btnTx: { color: "#fff", fontWeight: "700" },
  secondaryBtn: {
    marginTop: mobileSpacing.sm,
    paddingHorizontal: mobileSpacing.xl,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: mobileColors.border,
    backgroundColor: "#fff"
  },
  secondaryBtnTx: {
    color: mobileColors.accent,
    fontWeight: "600"
  }
});
