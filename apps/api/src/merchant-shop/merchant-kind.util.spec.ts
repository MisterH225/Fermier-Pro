import { MerchantKind } from "@prisma/client";
import { isMill } from "./merchant-kind.util";

describe("isMill", () => {
  it("retourne true pour un profil moulin", () => {
    expect(isMill({ merchantKind: MerchantKind.mill })).toBe(true);
  });

  it("retourne false pour un commerçant standard", () => {
    expect(isMill({ merchantKind: MerchantKind.standard })).toBe(false);
  });

  it("retourne false si profil absent", () => {
    expect(isMill(null)).toBe(false);
    expect(isMill(undefined)).toBe(false);
  });
});
