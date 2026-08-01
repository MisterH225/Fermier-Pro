import { ServiceUnavailableException } from "@nestjs/common";
import {
  assertEscrowAmountEqualsFinalPrice,
  ESCROW_COMPOSITION_ADAPTER_CODE,
  refuseCompositionEscrowUntilAdapterReady
} from "./composition-escrow.adapter";

describe("composition-escrow.adapter (garde-fou non-duplication)", () => {
  it("test comparatif : montant escrow = finalPriceXof", () => {
    expect(() =>
      assertEscrowAmountEqualsFinalPrice(30500, 30500)
    ).not.toThrow();
    expect(() => assertEscrowAmountEqualsFinalPrice(100, 99)).toThrow(
      /finalPriceXof/
    );
  });

  it("STOP : refuse de dupliquer l’escrow tant que l’adaptateur n’existe pas", () => {
    try {
      refuseCompositionEscrowUntilAdapterReady({
        compositionOrderId: "ord-1",
        finalPriceXof: 30500
      });
      fail("devait lever");
    } catch (e) {
      expect(e).toBeInstanceOf(ServiceUnavailableException);
      const body = (e as ServiceUnavailableException).getResponse() as {
        code: string;
        finalPriceXof: number;
      };
      expect(body.code).toBe(ESCROW_COMPOSITION_ADAPTER_CODE);
      expect(body.finalPriceXof).toBe(30500);
    }
  });
});
