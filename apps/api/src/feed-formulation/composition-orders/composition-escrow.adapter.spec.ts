import { assertEscrowAmountEqualsFinalPrice } from "./composition-escrow.adapter";

describe("composition-escrow.adapter", () => {
  it("test comparatif : montant escrow = finalPriceXof", () => {
    expect(() =>
      assertEscrowAmountEqualsFinalPrice(30500, 30500)
    ).not.toThrow();
    expect(() => assertEscrowAmountEqualsFinalPrice(100, 99)).toThrow(
      /finalPriceXof/
    );
  });
});
