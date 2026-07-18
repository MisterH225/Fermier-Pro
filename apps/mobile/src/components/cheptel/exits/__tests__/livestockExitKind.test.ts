import {
  animalStatusForExitKind,
  isLivestockExitKind,
  LIVESTOCK_EXIT_KINDS,
  LIVESTOCK_EXIT_VERB_ORDER
} from "../livestockExitKind";

describe("LivestockExitKind verbs", () => {
  it("aligne exactement les 4 kinds Prisma (aucun verbe hors enum)", () => {
    expect([...LIVESTOCK_EXIT_KINDS]).toEqual([
      "sale",
      "mortality",
      "slaughter",
      "transfer"
    ]);
    expect(LIVESTOCK_EXIT_VERB_ORDER).toHaveLength(4);
    for (const kind of LIVESTOCK_EXIT_VERB_ORDER) {
      expect(isLivestockExitKind(kind)).toBe(true);
    }
  });

  it("mappe chaque kind non-vente vers le statut du formulaire de sortie", () => {
    expect(animalStatusForExitKind("mortality")).toBe("dead");
    expect(animalStatusForExitKind("slaughter")).toBe("exited");
    expect(animalStatusForExitKind("transfer")).toBe("transferred");
  });

  it("réutilise le chooser Vendre pour sale (pas de statut preset)", () => {
    expect(LIVESTOCK_EXIT_VERB_ORDER[0]).toBe("sale");
  });
});

describe("navigation params sortie", () => {
  it("formulaire générique sans preset reste optionnel", () => {
    const genericOpen = { animalId: "a1" };
    const presetOpen = { animalId: "a1", presetStatus: "dead" as const };
    expect(genericOpen).not.toHaveProperty("presetStatus");
    expect(presetOpen.presetStatus).toBe("dead");
  });
});
