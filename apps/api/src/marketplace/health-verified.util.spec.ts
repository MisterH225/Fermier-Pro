import {
  aggregateHealthVerifiedByFarm,
  HEALTH_VERIFIED_WINDOW_MS,
  isWithinHealthVerifiedWindow
} from "./health-verified.util";

describe("health-verified.util", () => {
  const now = new Date("2026-07-20T12:00:00.000Z");

  it("accepte une complétion dans la fenêtre 30 j", () => {
    const at = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    expect(isWithinHealthVerifiedWindow(at, now)).toBe(true);
  });

  it("exclut une complétion hors fenêtre 30 j", () => {
    const at = new Date(now.getTime() - HEALTH_VERIFIED_WINDOW_MS - 1000);
    expect(isWithinHealthVerifiedWindow(at, now)).toBe(false);
  });

  it("exclut une date dans le futur", () => {
    const at = new Date(now.getTime() + 60_000);
    expect(isWithinHealthVerifiedWindow(at, now)).toBe(false);
  });

  it("exclut un vétérinaire non verified", () => {
    const map = aggregateHealthVerifiedByFarm(
      [
        {
          farmId: "f1",
          completedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
          vetProfileId: "v1",
          vetName: "Dr. A",
          vetVerified: false
        }
      ],
      now
    );
    expect(map.has("f1")).toBe(false);
  });

  it("exclut une consultation non terminale (hors candidats — pas de completedAt valide)", () => {
    const map = aggregateHealthVerifiedByFarm([], now);
    expect(map.size).toBe(0);
  });

  it("retient la dernière complétion verified dans la fenêtre", () => {
    const older = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
    const newer = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const map = aggregateHealthVerifiedByFarm(
      [
        {
          farmId: "f1",
          completedAt: older,
          vetProfileId: "v1",
          vetName: "Dr. Old",
          vetVerified: true
        },
        {
          farmId: "f1",
          completedAt: newer,
          vetProfileId: "v2",
          vetName: "Dr. New",
          vetVerified: true
        },
        {
          farmId: "f1",
          completedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
          vetProfileId: "v3",
          vetName: "Dr. Pending",
          vetVerified: false
        },
        {
          farmId: "f2",
          completedAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
          vetProfileId: "v1",
          vetName: "Dr. Old",
          vetVerified: true
        }
      ],
      now
    );
    expect(map.get("f1")).toEqual({
      completedAt: newer,
      vetProfileId: "v2",
      vetName: "Dr. New"
    });
    expect(map.has("f2")).toBe(false);
  });
});
