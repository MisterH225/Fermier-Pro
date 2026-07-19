import {
  formatActivityAction,
  formatActivityDetail
} from "../formatActivityDetail";

describe("formatActivityDetail", () => {
  it("retourne le fallback si detail est null/undefined", () => {
    expect(formatActivityDetail(null, "Santé")).toBe("Santé");
    expect(formatActivityDetail(undefined, "Stock")).toBe("Stock");
  });

  it("conserve une string non vide non-JSON", () => {
    expect(formatActivityDetail("Vaccin fait", "Santé")).toBe("Vaccin fait");
  });

  it("n’écrase pas le fallback avec une string vide", () => {
    expect(formatActivityDetail("   ", "Finance")).toBe("Finance");
  });

  it("extrait un champ lisible d’un objet", () => {
    expect(
      formatActivityDetail({ summary: "Achat aliment", amount: 12000 }, "Stock")
    ).toBe("Achat aliment");
  });

  it("mappe detail.kind finance/stock (cas dashboard tech)", () => {
    expect(
      formatActivityDetail(
        { kind: "expense", expenseId: "exp_1" },
        "finance"
      )
    ).toBe("Dépense");
    expect(
      formatActivityDetail({ kind: "in", movementId: "m1" }, "stock")
    ).toBe("Entrée stock");
  });

  it("parse une string JSON au lieu de l’afficher brute", () => {
    expect(
      formatActivityDetail(
        '{"kind":"expense","expenseId":"cmabc"}',
        "finance"
      )
    ).toBe("Dépense");
    expect(
      formatActivityDetail('{"kind":"in","movementId":"steg"}', "stock")
    ).toBe("Entrée stock");
  });

  it("ne renvoie jamais de JSON brut pour un objet opaque", () => {
    const result = formatActivityDetail(
      { before: { role: "owner" }, after: { role: "technician" } },
      "Collaboration"
    );
    expect(result).toBe("Collaboration");
    expect(result).not.toMatch(/\{/);
  });

  it("convertit number/boolean", () => {
    expect(formatActivityDetail(42, "x")).toBe("42");
    expect(formatActivityDetail(true, "x")).toBe("true");
  });
});

describe("formatActivityAction", () => {
  it("traduit les codes d’action connus", () => {
    expect(formatActivityAction("finance_entry")).toBe("Saisie finance");
    expect(formatActivityAction("feed_movement")).toBe("Mouvement de stock");
  });

  it("humanise un code inconnu", () => {
    expect(formatActivityAction("custom_event")).toBe("Custom event");
  });
});
