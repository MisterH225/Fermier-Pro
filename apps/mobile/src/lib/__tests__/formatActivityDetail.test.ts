import { formatActivityDetail } from "../formatActivityDetail";

describe("formatActivityDetail", () => {
  it("retourne le fallback si detail est null/undefined", () => {
    expect(formatActivityDetail(null, "health")).toBe("health");
    expect(formatActivityDetail(undefined, "stock")).toBe("stock");
  });

  it("conserve une string non vide", () => {
    expect(formatActivityDetail("Vaccin fait", "health")).toBe("Vaccin fait");
  });

  it("n’écrase pas le fallback avec une string vide", () => {
    expect(formatActivityDetail("   ", "finance")).toBe("finance");
  });

  it("extrait un champ lisible d’un objet JSON (cas crash dashboard tech)", () => {
    expect(
      formatActivityDetail({ summary: "Achat aliment", amount: 12000 }, "stock")
    ).toBe("Achat aliment");
  });

  it("sérialise un objet sans champ lisible (évite crash React Native Text)", () => {
    const result = formatActivityDetail(
      { before: { role: "owner" }, after: { role: "technician" } },
      "collaboration"
    );
    expect(typeof result).toBe("string");
    expect(result).toMatch(/before/);
    expect(result).not.toBe("[object Object]");
  });

  it("convertit number/boolean", () => {
    expect(formatActivityDetail(42, "x")).toBe("42");
    expect(formatActivityDetail(true, "x")).toBe("true");
  });
});
