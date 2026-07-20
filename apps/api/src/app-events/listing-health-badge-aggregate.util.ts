import { listingHealthBadgeDedupeKey } from "./app-events.constants";

export type ListingHealthBadgeAggregateProps = {
  dayKey: string;
  total: number;
  badged: number;
  /** Ratio 0–1 arrondi à 4 décimales. */
  ratio: number;
};

export function utcDayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function buildListingHealthBadgeAggregate(opts: {
  total: number;
  badged: number;
  now?: Date;
}): {
  props: ListingHealthBadgeAggregateProps;
  dedupeKey: string;
} {
  const now = opts.now ?? new Date();
  const dayKey = utcDayKey(now);
  const total = Math.max(0, opts.total);
  const badged = Math.max(0, Math.min(opts.badged, total));
  const ratio =
    total === 0 ? 0 : Math.round((badged / total) * 10_000) / 10_000;
  return {
    props: { dayKey, total, badged, ratio },
    dedupeKey: listingHealthBadgeDedupeKey(dayKey)
  };
}

/**
 * Pure : décide si un second run quotidien doit écrire.
 * `alreadyRecorded` simule la présence d'une ligne dedupeKey.
 */
export function shouldRecordListingHealthBadgeAggregate(opts: {
  alreadyRecorded: boolean;
}): boolean {
  return !opts.alreadyRecorded;
}
