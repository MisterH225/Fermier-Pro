import {
  buildOrderActivityEvents,
  isProgressStepCurrent,
  isProgressStepDone,
  ORDER_PROGRESS_STEPS,
  orderStatusBadgeTone,
  shortOrderTrackingId
} from "../merchantOrderTracking";
import type { MerchantOrderDto } from "../api";

function order(partial: Partial<MerchantOrderDto>): MerchantOrderDto {
  return {
    id: "cmabc123def456ghi789",
    productId: "p1",
    productName: "Aliment",
    productPhotoUrls: [],
    productCurrency: "XOF",
    buyerUserId: "b1",
    buyerName: "Buyer",
    sellerUserId: "s1",
    sellerName: "Seller",
    quantity: 1,
    unitPrice: 1000,
    totalAmount: 1000,
    buyerCommission: 0,
    sellerCommission: 0,
    sellerNet: 900,
    paymentMethod: "wallet",
    providerRef: null,
    status: "paid",
    paidAt: "2026-07-16T10:30:00.000Z",
    confirmedAt: null,
    shippedAt: null,
    deliveredAt: null,
    completedAt: null,
    rejectedAt: null,
    disputeOpenedAt: null,
    resolvedAt: null,
    timeoutAt: null,
    disputeWindowEndsAt: null,
    createdAt: "2026-07-16T10:00:00.000Z",
    dispute: null,
    ...partial
  };
}

describe("merchantOrderTracking", () => {
  it("shortOrderTrackingId formate un id lisible", () => {
    expect(shortOrderTrackingId("cmabc123def456ghi789")).toMatch(/^CMD-[A-Z0-9]{3}-[A-Z0-9]+$/);
  });

  it("progress steps: shipping active sur in_transit", () => {
    const shipping = "shipping";
    expect(isProgressStepDone(shipping, ORDER_PROGRESS_STEPS[0])).toBe(true);
    expect(isProgressStepDone(shipping, ORDER_PROGRESS_STEPS[1])).toBe(true);
    expect(isProgressStepDone(shipping, ORDER_PROGRESS_STEPS[2])).toBe(false);
    expect(isProgressStepCurrent(shipping, "in_transit")).toBe(true);
    expect(isProgressStepCurrent(shipping, "received")).toBe(false);
  });

  it("orderStatusBadgeTone mappe les statuts", () => {
    expect(orderStatusBadgeTone("shipping")).toBe("progress");
    expect(orderStatusBadgeTone("completed")).toBe("success");
    expect(orderStatusBadgeTone("disputed")).toBe("warning");
    expect(orderStatusBadgeTone("rejected")).toBe("danger");
  });

  it("buildOrderActivityEvents préfère timeline API", () => {
    const events = buildOrderActivityEvents(
      order({
        timeline: [
          {
            id: "e2",
            fromStatus: "paid",
            toStatus: "confirmed",
            actorUserId: "s1",
            note: null,
            createdAt: "2026-07-16T11:00:00.000Z"
          },
          {
            id: "e1",
            fromStatus: null,
            toStatus: "paid",
            actorUserId: null,
            note: null,
            createdAt: "2026-07-16T10:30:00.000Z"
          }
        ]
      })
    );
    expect(events).toHaveLength(2);
    expect(events[0].statusTo).toBe("confirmed");
    expect(events[1].statusTo).toBe("paid");
  });

  it("buildOrderActivityEvents fallback timestamps", () => {
    const events = buildOrderActivityEvents(
      order({
        status: "shipping",
        confirmedAt: "2026-07-16T11:00:00.000Z",
        shippedAt: "2026-07-16T12:00:00.000Z"
      })
    );
    expect(events.map((e) => e.statusTo)).toEqual(["shipping", "confirmed", "paid"]);
  });
});
