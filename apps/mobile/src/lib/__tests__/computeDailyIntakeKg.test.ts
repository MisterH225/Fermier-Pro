import {
  computeDailyIntakeKg,
  readPositiveInputNumber,
  statusLabelFr
} from "../feedCompositionFormat";

describe("computeDailyIntakeKg", () => {
  it("calcule total ÷ effectif ÷ jours (375 / 5 / 30 = 2,5)", () => {
    expect(computeDailyIntakeKg(375, 5, 30)).toBeCloseTo(2.5);
  });

  it("retourne 0 si effectif ou durée manquant", () => {
    expect(computeDailyIntakeKg(375, null, 30)).toBe(0);
    expect(computeDailyIntakeKg(375, 5, null)).toBe(0);
    expect(computeDailyIntakeKg(375, 0, 30)).toBe(0);
  });

  it("retourne 0 si total nul", () => {
    expect(computeDailyIntakeKg(0, 5, 30)).toBe(0);
  });
});

describe("readPositiveInputNumber", () => {
  it("lit number et string numérique", () => {
    expect(readPositiveInputNumber({ animalCount: 5 }, "animalCount")).toBe(5);
    expect(
      readPositiveInputNumber({ durationDays: "30" }, "durationDays")
    ).toBe(30);
  });

  it("rejette valeurs invalides", () => {
    expect(readPositiveInputNumber({ animalCount: 0 }, "animalCount")).toBeNull();
    expect(readPositiveInputNumber({}, "animalCount")).toBeNull();
  });
});

describe("statusLabelFr", () => {
  it("libellé clair pour vet_review (pas « Chez le véto »)", () => {
    expect(statusLabelFr("vet_review")).toBe("En validation vétérinaire");
  });
});
