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
import { obtainExpoPushToken } from "../../lib/expoPush";
import { mobileColors, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { Card } from "../ui/Card";
import { uiNamedColors } from "../../theme/uiNamedColors";

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
          const tokenResult = await obtainExpoPushToken();
          if (!tokenResult.ok) {
            if (tokenResult.reason === "no_project_id") {
              await patchAuthProfile(
                accessToken,
                { notificationsEnabled: true },
                activeProfileId
              );
              await refreshAuthMe();
              setLocalOverride(null);
              Alert.alert("", t("account.notificationsTokenMissingProject"));
              return;
            }
            setLocalOverride(null);
            Alert.alert("", t("account.notificationsTokenError"));
            return;
          }
          await patchAuthProfile(
            accessToken,
            {
              notificationsEnabled: true,
              expoPushToken: tokenResult.token,
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
              true: uiNamedColors.cC7DDFF
            }}
            thumbColor={displayOn ? mobileColors.accent : uiNamedColors.cF4F4F5}
            accessibilityLabel={t("account.notificationsA11y")}
          />
        )}
      </View>
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
    fontSize: mobileFontSize.lg,
    fontWeight: "600",
    color: mobileColors.textPrimary
  },
  hint: {
    ...mobileTypography.meta,
    fontSize: mobileFontSize.sm,
    lineHeight: 18,
    color: mobileColors.textSecondary,
    marginTop: 4
  }
});
