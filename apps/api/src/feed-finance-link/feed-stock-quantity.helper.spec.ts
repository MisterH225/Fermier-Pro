import { FeedTypeUnit, Prisma } from "@prisma/client";
import {
  lineAmountFromUnitPrice,
  unitPriceFromTotalCost
} from "./feed-stock-quantity.helper";

describe("unitPriceFromTotalCost", () => {
  it("dérive le prix par sac depuis le coût total", () => {
    expect(
      unitPriceFromTotalCost(50_000, 10, FeedTypeUnit.sac, new Prisma.Decimal(250), "sac")
    ).toBe(5000);
  });

  it("dérive le prix par kg depuis le coût total", () => {
    expect(
      unitPriceFromTotalCost(25_000, 10, FeedTypeUnit.sac, new Prisma.Decimal(250), "kg")
    ).toBe(100);
  });

  it("retourne null si quantité invalide", () => {
    expect(
      unitPriceFromTotalCost(1000, 0, FeedTypeUnit.sac, new Prisma.Decimal(0), "sac")
    ).toBeNull();
  });
});

describe("lineAmountFromUnitPrice", () => {
  it("multiplie sacs × prix/sac", () => {
    expect(
      lineAmountFromUnitPrice(10, FeedTypeUnit.sac, new Prisma.Decimal(250), 5000, "sac")
    ).toBe(50_000);
  });
});
