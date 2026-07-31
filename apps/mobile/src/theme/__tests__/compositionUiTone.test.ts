import {
  compositionDiscussLabel,
  compositionUiColors
} from "../compositionUiTone";
import { vetColors } from "../vetTheme";
import { mobileColors } from "../mobileTheme";

describe("compositionUiTone", () => {
  it("expose le bleu véto (pas le vert producteur)", () => {
    const vet = compositionUiColors("vet");
    expect(vet.accent).toBe(vetColors.primary);
    expect(vet.accent).not.toBe(mobileColors.accent);
    expect(vet.accentSoft).toBe(vetColors.primaryLight);
  });

  it("libellé discussion selon le profil", () => {
    expect(compositionDiscussLabel("vet")).toBe(
      "Continuer la discussion avec le fermier"
    );
    expect(compositionDiscussLabel("producer")).toBe(
      "Continuer la discussion avec mon vétérinaire"
    );
  });
});

describe("vetColors contrast", () => {
  it("texte secondaire plus sombre que l’ancien gris pâle", () => {
    // #4A5568 doit rester nettement plus foncé que #8B95A8
    expect(vetColors.textSecondary).toBe("#4A5568");
    expect(vetColors.textMuted).toBe("#6B7280");
  });
});
