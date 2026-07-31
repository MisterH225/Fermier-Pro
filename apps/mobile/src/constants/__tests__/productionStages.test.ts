import {
  PRODUCTION_STAGE_META,
  PRODUCTION_STAGE_ORDER,
  productionStageDescription,
  productionStageLabel
} from "../productionStages";

describe("productionStages — mapping unique", () => {
  it("couvre les 6 stades ProductionStage dans un ordre stable", () => {
    expect([...PRODUCTION_STAGE_ORDER]).toEqual([
      "piglet_weaning",
      "growing",
      "fattening",
      "finishing",
      "gestating_sow",
      "lactating_sow"
    ]);
    for (const stage of PRODUCTION_STAGE_ORDER) {
      expect(PRODUCTION_STAGE_META[stage]).toBeDefined();
    }
  });

  it("libellés métier FR (pas de paraphrases)", () => {
    expect(productionStageLabel("piglet_weaning")).toBe("Sevrage");
    expect(productionStageLabel("growing")).toBe("Croissance");
    expect(productionStageLabel("fattening")).toBe("Engraissement");
    expect(productionStageLabel("finishing")).toBe("Finition");
    expect(productionStageLabel("gestating_sow")).toBe("Truie gestante");
    expect(productionStageLabel("lactating_sow")).toBe("Truie allaitante");
  });

  it("finishing ≠ fattening (pas de confusion Presque prêts / Engraissement)", () => {
    expect(productionStageLabel("finishing")).not.toBe(
      productionStageLabel("fattening")
    );
    expect(productionStageLabel("finishing")).toBe("Finition");
  });

  it("descriptions optionnelles présentes", () => {
    expect(productionStageDescription("piglet_weaning")).toMatch(/sevr/i);
    expect(productionStageDescription("finishing")).toMatch(/finition/i);
  });

  it("aucune paraphrase interdite dans les libellés", () => {
    const all = PRODUCTION_STAGE_ORDER.map((s) =>
      `${productionStageLabel(s)} ${productionStageDescription(s)}`
    ).join(" ");
    expect(all).not.toMatch(/grandissent|prêts à vendre|pleines|qui allaitent/i);
  });
});
