import {
  containsInsult,
  normalizeModerationText
} from "./feed-moderation-agent.service";

describe("feed moderation heuristics", () => {
  it("normalise les accents", () => {
    expect(normalizeModerationText("Imbécile")).toBe("imbecile");
    expect(normalizeModerationText("tu es bête")).toBe("tu es bete");
  });

  it("détecte imbecile sans accent", () => {
    expect(containsInsult("Imbecile tu es trop bête")).toBe(true);
  });

  it("détecte une attaque personnelle sans insulte directe", () => {
    expect(containsInsult("tu es trop bête")).toBe(true);
  });

  it("laisse passer un commentaire bienveillant", () => {
    expect(
      containsInsult("Moi je leur donne de l'Aloes Vera")
    ).toBe(false);
  });
});
