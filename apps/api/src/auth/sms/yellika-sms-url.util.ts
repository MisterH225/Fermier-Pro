const DEFAULT_BASE_URL = "https://panel.yellikasms.com/api/v3";
const SEND_PATH = "/sms/send";

/**
 * URL POST d'envoi SMS Yellika v3.
 * Accepte YELLIKA_SMS_API_BASE_URL avec ou sans suffixe /sms/send (évite la duplication).
 */
export function resolveYellikaSmsSendUrl(
  envBaseUrl: string | undefined
): string {
  let base = (envBaseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
  if (base.toLowerCase().endsWith(SEND_PATH)) {
    base = base.slice(0, -SEND_PATH.length).replace(/\/+$/, "");
  }
  return `${base}${SEND_PATH}`;
}
