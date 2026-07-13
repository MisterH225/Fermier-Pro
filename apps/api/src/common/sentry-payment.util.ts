import * as Sentry from "@sentry/nestjs";

/**
 * Capture explicite d'un événement financier critique.
 * No-op si SENTRY_DSN absent (Sentry non initialisé).
 */
export function capturePaymentError(
  message: string,
  tags: {
    transactionId?: string;
    provider?: string;
    [key: string]: string | undefined;
  } = {}
): void {
  if (!process.env.SENTRY_DSN?.trim()) {
    return;
  }
  const cleanTags: Record<string, string> = { payment: "true" };
  for (const [key, value] of Object.entries(tags)) {
    if (value !== undefined && value !== "") {
      cleanTags[key] = value;
    }
  }
  Sentry.captureMessage(message, {
    level: "error",
    tags: cleanTags
  });
}
