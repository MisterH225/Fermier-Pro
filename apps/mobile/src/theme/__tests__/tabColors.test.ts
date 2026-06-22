import {
  getInactiveAccentColor,
  getTabLabelColor,
  tabColors
} from "../tabColors";

describe("tabColors", () => {
  it("expose la palette unifiée", () => {
    expect(tabColors.ACTIVE).toBe("#B5654A");
    expect(tabColors.INACTIVE_1).toBe("#3D6B73");
    expect(tabColors.INACTIVE_2).toBe("#7A8B6F");
    expect(tabColors.INACTIVE_TEXT).toBe("#757575");
  });

  it("alterne les accents inactifs selon la position", () => {
    expect(getInactiveAccentColor(0)).toBe(tabColors.INACTIVE_1);
    expect(getInactiveAccentColor(1)).toBe(tabColors.INACTIVE_2);
    expect(getInactiveAccentColor(2)).toBe(tabColors.INACTIVE_1);
    expect(getInactiveAccentColor(3)).toBe(tabColors.INACTIVE_2);
  });

  it("retourne terracotta pour l'onglet actif", () => {
    expect(getTabLabelColor(true, 0)).toBe(tabColors.ACTIVE);
    expect(getTabLabelColor(true, 3)).toBe(tabColors.ACTIVE);
  });

  it("retourne gris neutre pour les onglets inactifs", () => {
    expect(getTabLabelColor(false, 0)).toBe(tabColors.INACTIVE_TEXT);
    expect(getTabLabelColor(false, 1)).toBe(tabColors.INACTIVE_TEXT);
  });
});
