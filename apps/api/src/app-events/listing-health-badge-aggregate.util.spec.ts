import {
  buildListingHealthBadgeAggregate,
  shouldRecordListingHealthBadgeAggregate,
  utcDayKey
} from "./listing-health-badge-aggregate.util";
import { listingHealthBadgeDedupeKey } from "./app-events.constants";

describe("listing-health-badge-aggregate", () => {
  const now = new Date("2026-07-20T12:00:00.000Z");

  it("construit props + dedupeKey stables pour le jour UTC", () => {
    const { props, dedupeKey } = buildListingHealthBadgeAggregate({
      total: 10,
      badged: 4,
      now
    });
    expect(props).toEqual({
      dayKey: "2026-07-20",
      total: 10,
      badged: 4,
      ratio: 0.4
    });
    expect(dedupeKey).toBe(listingHealthBadgeDedupeKey("2026-07-20"));
    expect(utcDayKey(now)).toBe("2026-07-20");
  });

  it("idempotence : un second run du même jour ne doit pas réécrire", () => {
    const first = buildListingHealthBadgeAggregate({
      total: 5,
      badged: 2,
      now
    });
    const second = buildListingHealthBadgeAggregate({
      total: 5,
      badged: 2,
      now
    });
    expect(first.dedupeKey).toBe(second.dedupeKey);
    expect(shouldRecordListingHealthBadgeAggregate({ alreadyRecorded: false })).toBe(
      true
    );
    expect(shouldRecordListingHealthBadgeAggregate({ alreadyRecorded: true })).toBe(
      false
    );
  });

  it("ratio 0 si aucune annonce", () => {
    const { props } = buildListingHealthBadgeAggregate({
      total: 0,
      badged: 0,
      now
    });
    expect(props.ratio).toBe(0);
  });
});
