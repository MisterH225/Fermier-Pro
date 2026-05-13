import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Switch,
  Text,
  View
} from "react-native";
import { useSession } from "../../context/SessionContext";
import { patchAuthProfile } from "../../lib/api";
import { isDemoBypassToken } from "../../lib/demoBypass";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { Card } from "../ui/Card";

function pushPlatformParam():
  | "ios"
  | "android"
  | "web"
  | "unknown" {
  if (Platform.OS === "ios") {
    return "ios";
  }
  if (Platform.OS === "android") {
    return "android";
  }
  if (Platform.OS === "web") {
    return "web";
  }
  return "unknown";
}

export function NotificationSettingsRow() {
  const { t } = useTranslation();
  const {
    accessToken,
    activeProfileId,
    authMe,
    refreshAuthMe
  } = useSession();

  const serverOn = authMe?.user.notificationsEnabled ?? false;
  const [localOverride, setLocalOverride] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const displayOn = localOverride ?? serverOn;

  useEffect(() => {
    setLocalOverride(null);
  }, [serverOn]);

  const onToggle = useCallback(
    async (next: boolean) => {
      if (isDemoBypassToken(accessToken)) {
        Alert.alert("", t("account.notificationsDemoBlocked"));
        return;
      }
      setBusy(true);
      setLocalOverride(next);
      try {
        if (next) {
          const existing = await Notifications.getPermissionsAsync();
          let status = existing.status;
          if (status !== "granted") {
            const asked = await Notifications.requestPermissionsAsync();
            status = asked.status;
          }
          if (status !== "granted") {
            setLocalOverride(null);
            Alert.alert("", t("account.notificationsPermissionDenied"));
            return;
          }
          let expoPushToken: string;
          try {
            const tokenRes = await Notifications.getExpoPushTokenAsync();
            expoPushToken = tokenRes.data;
          } catch {
            setLocalOverride(null);
            Alert.alert("", t("account.notificationsTokenError"));
            return;
          }
          await patchAuthProfile(
            accessToken,
            {
              notificationsEnabled: true,
              expoPushToken,
              pushPlatform: pushPlatformParam()
            },
            activeProfileId
          );
        } else {
          await patchAuthProfile(
            accessToken,
            { notificationsEnabled: false },
            activeProfileId
          );
        }
        await refreshAuthMe();
        setLocalOverride(null);
      } catch (e) {
        setLocalOverride(null);
        Alert.alert(
          "",
          e instanceof Error ? e.message : t("account.notificationsSaveError")
        );
      } finally {
        setBusy(false);
      }
    },
    [accessToken, activeProfileId, refreshAuthMe, t]
  );

  return (
    <Card>
      <Text style={styles.sectionLabel}>{t("account.notificationsTitle")}</Text>
      <View style={styles.row}>
        <View style={styles.textCol}>
          <Text style={styles.title}>{t("account.notificationsLabel")}</Text>
          <Text style={styles.hint}>{t("account.notificationsHint")}</Text>
        </View>
        {busy ? (
          <ActivityIndicator size="small" color={mobileColors.accent} />
        ) : (
          <Switch
            value={displayOn}
            onValueChange={(v) => void onToggle(v)}
            trackColor={{
              false: mobileColors.border,
              true: "#c7ddff"
            }}
            thumbColor={displayOn ? mobileColors.accent : "#f4f4f5"}
            accessibilityLabel={t("account.notificationsA11y")}
          />
        )}
      </View>
      <Text style={styles.disclaimer}>{t("account.notificationsDeliveryNote")}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginLeft: 4
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing.md,
    minHeight: 44
  },
  textCol: {
    flex: 1,
    minWidth: 0
  },
  title: {
    ...mobileTypography.body,
    fontSize: 16,
    fontWeight: "600",
    color: mobileColors.textPrimary
  },
  hint: {
    ...mobileTypography.meta,
    fontSize: 13,
    lineHeight: 18,
    color: mobileColors.textSecondary,
    marginTop: 4
  },
  disclaimer: {
    ...mobileTypography.meta,
    fontSize: 12,
    lineHeight: 17,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.md
  }
});
