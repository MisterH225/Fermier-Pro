import { formatFcfa, formatNumberFr } from "./formatters";

describe("formatters", () => {
  it("formatNumberFr utilise des espaces ASCII (pas de séparateur Unicode)", () => {
    expect(formatNumberFr(1266300)).toBe("1 266 300");
    expect(formatNumberFr(419000)).toBe("419 000");
    expect(formatNumberFr(847300)).toBe("847 300");
    expect(formatNumberFr(1266300)).not.toMatch(/[\u00A0\u202F]/);
  });

  it("formatFcfa ajoute la devise", () => {
    expect(formatFcfa(1266300)).toBe("1 266 300 FCFA");
    expect(formatFcfa(0)).toBe("0 FCFA");
  });
});
