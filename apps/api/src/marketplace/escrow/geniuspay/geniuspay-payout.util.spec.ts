import { normalizeCiMobilePhone } from "./geniuspay-payout.util";

describe("normalizeCiMobilePhone", () => {
  it("normalise un numéro local 10 chiffres", () => {
    expect(normalizeCiMobilePhone("0709876543")).toBe("+2250709876543");
  });

  it("conserve un numéro déjà international", () => {
    expect(normalizeCiMobilePhone("+2250709876543")).toBe("+2250709876543");
  });

  it("normalise sans le plus", () => {
    expect(normalizeCiMobilePhone("2250709876543")).toBe("+2250709876543");
  });
});
