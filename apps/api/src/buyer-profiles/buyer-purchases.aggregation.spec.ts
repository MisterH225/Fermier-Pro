import {
  categoryBreakdownForWindow,
  monthlyEvolutionLast12,
  purchasesDtoFromRows,
  type BuyerPurchaseRow
} from "./buyer-purchases.aggregation";

describe("buyer-purchases.aggregation", () => {
  const rows: BuyerPurchaseRow[] = [
    {
      amount: 100_000,
      at: new Date(2026, 6, 10),
      currency: "XOF",
      categoryKey: "butcher"
    },
    {
      amount: 50_000,
      at: new Date(2026, 5, 15),
      currency: "XOF",
      categoryKey: "piglet"
    },
    {
      amount: 25_000,
      at: new Date(2026, 6, 20),
      currency: "XOF",
      categoryKey: "butcher"
    }
  ];

  it("agrège les totaux mois / trimestre / année", () => {
    const now = new Date(2026, 6, 29);
    const dto = purchasesDtoFromRows(rows, now);
    expect(dto.month.total).toBe(125_000);
    expect(dto.month.count).toBe(2);
    expect(dto.month.previousTotal).toBe(50_000);
    expect(dto.currency).toBe("XOF");
  });

  it("répartit par catégorie sur la fenêtre", () => {
    const start = new Date(2026, 6, 1);
    const end = new Date(2026, 7, 1);
    const slices = categoryBreakdownForWindow(rows, start, end);
    expect(slices).toEqual([
      { key: "butcher", amount: 125_000, count: 2 }
    ]);
  });

  it("produit 12 points mensuels", () => {
    const now = new Date(2026, 6, 29);
    const points = monthlyEvolutionLast12(rows, now);
    expect(points).toHaveLength(12);
    expect(points[points.length - 1]?.month).toBe("2026-07");
    expect(points[points.length - 1]?.total).toBe(125_000);
  });
});
