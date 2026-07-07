import {
  buildE164FromDialAndNational,
  formatE164ForYellikaSms,
  normalizeE164Phone
} from "./west-africa-phone";

describe("west-africa-phone", () => {
  describe("Côte d’Ivoire (+225)", () => {
    it("conserve le 0 initial à la saisie", () => {
      expect(buildE164FromDialAndNational("+225", "0708425141")).toBe(
        "+2250708425141"
      );
    });

    it("réinsère le 0 manquant", () => {
      expect(buildE164FromDialAndNational("+225", "708425141")).toBe(
        "+2250708425141"
      );
    });

    it("corrige un E.164 tronqué", () => {
      expect(normalizeE164Phone("+225708425141")).toBe("+2250708425141");
    });
  });

  describe("Sénégal (+221)", () => {
    it("retire le 0 de décroche local", () => {
      expect(buildE164FromDialAndNational("+221", "0771234567")).toBe(
        "+221771234567"
      );
    });

    it("corrige un E.164 avec 0 en trop", () => {
      expect(normalizeE164Phone("+2210771234567")).toBe("+221771234567");
    });
  });

  describe("Nigeria (+234)", () => {
    it("retire le 0 local pour 10 chiffres nationaux", () => {
      expect(buildE164FromDialAndNational("+234", "08012345678")).toBe(
        "+2348012345678"
      );
    });

    it("accepte le numéro sans 0 initial", () => {
      expect(buildE164FromDialAndNational("+234", "8012345678")).toBe(
        "+2348012345678"
      );
    });
  });

  describe("Ghana (+233)", () => {
    it("retire le 0 local", () => {
      expect(buildE164FromDialAndNational("+233", "0241234567")).toBe(
        "+233241234567"
      );
    });
  });

  describe("Mali (+223)", () => {
    it("retire le 0 local (9 chiffres saisis → 8 en E.164)", () => {
      expect(buildE164FromDialAndNational("+223", "0761234568")).toBe(
        "+223761234568"
      );
    });
  });

  describe("Cap-Vert (+238)", () => {
    it("compose 7 chiffres sans 0", () => {
      expect(buildE164FromDialAndNational("+238", "9912345")).toBe(
        "+2389912345"
      );
    });
  });

  describe("Yellika", () => {
    it("formate sans préfixe +", () => {
      expect(formatE164ForYellikaSms("+225708425141")).toBe("2250708425141");
      expect(formatE164ForYellikaSms("+2210771234567")).toBe("221771234567");
    });
  });
});
