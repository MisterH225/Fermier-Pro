import {
  buildLastNMonthKeys,
  buildRestockRecommendations,
  buildSalesSeriesFromOrders,
  isCountedSaleStatus,
  monthKeyFromDate
} from "../merchantProductInsights";

describe("merchantProductInsights", () => {
  const now = new Date("2026-07-15T12:00:00.000Z");

  it("monthKeyFromDate et buildLastNMonthKeys", () => {
    expect(monthKeyFromDate(now)).toBe("2026-07");
    expect(buildLastNMonthKeys(3, now)).toEqual([
      "2026-05",
      "2026-06",
      "2026-07"
    ]);
  });

  it("isCountedSaleStatus ignore les refus / pending", () => {
    expect(isCountedSaleStatus("completed")).toBe(true);
    expect(isCountedSaleStatus("paid")).toBe(true);
    expect(isCountedSaleStatus("payment_pending")).toBe(false);
    expect(isCountedSaleStatus("rejected")).toBe(false);
  });

  it("buildSalesSeriesFromOrders agrège sellerNet par mois", () => {
    const series = buildSalesSeriesFromOrders(
      [
        {
          status: "completed",
          totalAmount: 1000,
          sellerNet: 900,
          createdAt: "2026-07-01T10:00:00.000Z"
        },
        {
          status: "paid",
          totalAmount: 500,
          sellerNet: 450,
          createdAt: "2026-07-10T10:00:00.000Z"
        },
        {
          status: "rejected",
          totalAmount: 9999,
          sellerNet: 9999,
          createdAt: "2026-07-05T10:00:00.000Z"
        },
        {
          status: "completed",
          totalAmount: 200,
          sellerNet: 180,
          createdAt: "2026-06-20T10:00:00.000Z"
        }
      ],
      { months: 3, now }
    );

    expect(series).toHaveLength(3);
    expect(series.map((p) => p.month)).toEqual([
      "2026-05",
      "2026-06",
      "2026-07"
    ]);
    expect(series[0].value).toBe(0);
    expect(series[1].value).toBe(180);
    expect(series[2].value).toBe(1350);
  });

  it("buildRestockRecommendations priorise rupture et stock bas rapide", () => {
    const recs = buildRestockRecommendations(
      [
        { id: "a", name: "Aliment A", stock: 0, status: "published" },
        { id: "b", name: "Aliment B", stock: 4, status: "published" },
        { id: "c", name: "Aliment C", stock: 50, status: "published" },
        { id: "d", name: "Retiré", stock: 0, status: "moderated_removed" }
      ],
      [
        {
          productId: "a",
          quantity: 10,
          status: "completed",
          createdAt: "2026-07-01T00:00:00.000Z"
        },
        {
          productId: "b",
          quantity: 20,
          status: "completed",
          createdAt: "2026-07-01T00:00:00.000Z"
        },
        {
          productId: "c",
          quantity: 2,
          status: "completed",
          createdAt: "2026-07-01T00:00:00.000Z"
        }
      ],
      { now }
    );

    expect(recs.find((r) => r.productId === "d")).toBeUndefined();
    expect(recs[0].productId).toBe("a");
    expect(recs[0].priority).toBe("critical");
    expect(recs[0].reason).toBe("out_of_stock");
    expect(recs[0].suggestedQty).toBeGreaterThan(0);

    const b = recs.find((r) => r.productId === "b");
    expect(b).toBeDefined();
    expect(b!.priority).toBe("warning");
    expect(b!.reason).toBe("low_stock_fast");
    expect(b!.unitsSold30d).toBe(20);
  });

  it("buildRestockRecommendations ignore produits sans signal", () => {
    const recs = buildRestockRecommendations(
      [{ id: "x", name: "X", stock: 100, status: "published" }],
      [],
      { now }
    );
    expect(recs).toEqual([]);
  });
});
