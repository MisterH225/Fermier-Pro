export const APP_EVENT = {
  profileCompletionBucket: "profile_completion_bucket",
  listingHealthBadge: "listing_health_badge",
  offerDecision: "offer_decision",
  vetBookingSource: "vet_booking_source"
} as const;

export type AppEventName = (typeof APP_EVENT)[keyof typeof APP_EVENT];

export type ProfileCompletionBucket = "0-40" | "40-70" | "70-100";

export type VetBookingSource =
  | "banner_cta"
  | "vet_search"
  | "farm_dossier"
  | "renewal_notification";

export const VET_BOOKING_SOURCES: readonly VetBookingSource[] = [
  "banner_cta",
  "vet_search",
  "farm_dossier",
  "renewal_notification"
] as const;

export function isVetBookingSource(v: unknown): v is VetBookingSource {
  return (
    typeof v === "string" &&
    (VET_BOOKING_SOURCES as readonly string[]).includes(v)
  );
}

export function listingHealthBadgeDedupeKey(dayKey: string): string {
  return `${APP_EVENT.listingHealthBadge}:${dayKey}`;
}
