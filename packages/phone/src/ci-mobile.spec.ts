import {
  buildE164FromDialAndNational,
  formatE164ForYellikaSms,
  normalizeE164Phone
} from "./ci-mobile";

describe("ci-mobile", () => {
  it("conserve le 0 initial pour la CI à la saisie", () => {
    expect(buildE164FromDialAndNational("+225", "0708425141")).toBe(
      "+2250708425141"
    );
  });

  it("réinsère le 0 manquant si l'utilisateur saisit 9 chiffres", () => {
    expect(buildE164FromDialAndNational("+225", "708425141")).toBe(
      "+2250708425141"
    );
  });

  it("corrige un E.164 CI tronqué", () => {
    expect(normalizeE164Phone("+225708425141")).toBe("+2250708425141");
    expect(normalizeE164Phone("225708425141")).toBe("+2250708425141");
  });

  it("formate pour Yellika sans préfixe +", () => {
    expect(formatE164ForYellikaSms("+225708425141")).toBe("2250708425141");
  });

  it("laisse les autres pays inchangés", () => {
    expect(buildE164FromDialAndNational("+221", "0771234567")).toBe(
      "+221771234567"
    );
  });
});
