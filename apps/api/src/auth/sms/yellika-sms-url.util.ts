/** URL POST exacte documentée par Yellika (copier-coller depuis le panel). */
export const YELLIKA_SMS_SEND_URL_DEFAULT =
  "https://panel.yellikasms.com/api/v3/sms/send";

/**
 * URL d'envoi SMS — telle que fournie par Yellika, sans suffixe ajouté par le client.
 * Priorité : YELLIKA_SMS_SEND_URL, puis YELLIKA_SMS_API_BASE_URL (alias legacy Railway).
 */
export function resolveYellikaSmsSendUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw =
    env.YELLIKA_SMS_SEND_URL?.trim() ||
    env.YELLIKA_SMS_API_BASE_URL?.trim() ||
    YELLIKA_SMS_SEND_URL_DEFAULT;
  return raw.replace(/\/+$/, "");
}
