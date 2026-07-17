import {
  buildDashboardTrackingSteps,
  pickCurrentTrackingOrder,
  trackingBadgeLabelKey,
  trackingBadgeTone,
  trackingParties,
  trackingReferenceOf
} from "../currentOrderTracking";
import type { MerchantOrderDto } from "../api";

function order(
  partial: Partial<MerchantOrderDto> & Pick<MerchantOrderDto, "id" | "status">
): MerchantOrderDto {
  return {
    productId: "p1",
    productName: "Aliment porc",
    productPhotoUrls: [],
    productCurrency: "XOF",
    buyerUserId: "b1",
    buyerName: "Ami Buyer",
    sellerUserId: "s1",
    sellerName: "Sam Seller",
    quantity: 1,
    unitPrice: 1000,
    totalAmount: 1000,
    buyerCommission: 0,
    sellerCommission: 0,
    sellerNet: 1000,
    paymentMethod: "mobile_money",
    providerRef: null,
    paidAt: "2026-06-10T08:30:00.000Z",
    completedAt: null,
    createdAt: "2026-06-10T08:00:00.000Z",
    dispute: null,
    ...partial
  };
}

describe("pickCurrentTrackingOrder", () => {
  it("préfère une commande en transit aux commandes payées", () => {
    const picked = pickCurrentTrackingOrder(
      [
        order({ id: "1", status: "paid", createdAt: "2026-06-12T10:00:00.000Z" }),
        order({
          id: "2",
          status: "shipping",
          shippedAt: "2026-06-11T14:45:00.000Z",
          createdAt: "2026-06-10T08:00:00.000Z"
        })
      ],
      new Set()
    );
    expect(picked?.id).toBe("2");
  });

  it("ignore les commandes masquées et les terminales", () => {
    const picked = pickCurrentTrackingOrder(
      [
        order({ id: "1", status: "shipping" }),
        order({ id: "2", status: "confirmed" }),
        order({ id: "3", status: "completed" })
      ],
      new Set(["1"])
    );
    expect(picked?.id).toBe("2");
  });
});

describe("tracking UI helpers", () => {
  it("formatte la référence courte", () => {
    expect(trackingReferenceOf(order({ id: "abcdefghij", status: "shipping" }))).toMatch(
      /^CMD-/
    );
  });

  it("mappe badge transit", () => {
    expect(trackingBadgeTone("shipping")).toBe("active");
    expect(trackingBadgeLabelKey("shipping")).toBe(
      "ordersTracking.badge.inTransit"
    );
  });

  it("expose expéditeur / destinataire", () => {
    const parties = trackingParties(
      order({ id: "1", status: "shipping" }),
      "buyer",
      { seller: "Vous", buyer: "Moi", product: "Produit" }
    );
    expect(parties.sender.value).toBe("Sam Seller");
    expect(parties.recipient.value).toBe("Ami Buyer");
  });

  it("construit 3 étapes avec timestamps", () => {
    const steps = buildDashboardTrackingSteps(
      order({
        id: "1",
        status: "shipping",
        shippedAt: "2026-06-11T14:45:00.000Z"
      })
    );
    expect(steps).toHaveLength(3);
    expect(steps[0]?.done).toBe(true);
    expect(steps[1]?.done).toBe(true);
    expect(steps[2]?.done).toBe(false);
    expect(steps[1]?.timestamp).toBe("2026-06-11T14:45:00.000Z");
  });
});
