import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export type ExpoPushTokenFailureReason =
  | "no_project_id"
  | "permission_denied"
  | "unavailable"
  | "error";

export type ExpoPushTokenResult =
  | { ok: true; token: string }
  | {
      ok: false;
      reason: ExpoPushTokenFailureReason;
      message?: string;
    };

/** ID EAS requis par `getExpoPushTokenAsync` depuis Expo SDK 49+. */
export function resolveExpoPushProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string } }
    | undefined;
  const fromExtra = extra?.eas?.projectId?.trim();
  if (fromExtra) {
    return fromExtra;
  }
  const easConfig = (
    Constants as typeof Constants & { easConfig?: { projectId?: string } }
  ).easConfig?.projectId?.trim();
  if (easConfig) {
    return easConfig;
  }
  const fromEnv = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  return fromEnv || undefined;
}

export async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }
  await Notifications.setNotificationChannelAsync("default", {
    name: "Alertes",
    importance: Notifications.AndroidImportance.DEFAULT
  });
}

function isMissingProjectIdError(message: string): boolean {
  return /projectId|project id|experienceId|experience id/i.test(message);
}

export async function obtainExpoPushToken(): Promise<ExpoPushTokenResult> {
  await ensureAndroidNotificationChannel();

  const projectId = resolveExpoPushProjectId();
  const options = projectId ? { projectId } : undefined;

  try {
    const tokenRes = await Notifications.getExpoPushTokenAsync(options);
    const token = tokenRes.data?.trim();
    if (!token) {
      return { ok: false, reason: "unavailable" };
    }
    return { ok: true, token };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!projectId && isMissingProjectIdError(message)) {
      return { ok: false, reason: "no_project_id", message };
    }
    return { ok: false, reason: "error", message };
  }
}
