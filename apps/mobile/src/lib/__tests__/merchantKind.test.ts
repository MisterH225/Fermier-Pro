import { isMillsModuleActive, shouldAskMerchantKind } from "../merchantKind";
import type { PlatformModuleDto } from "../api/config";

function mod(
  moduleId: PlatformModuleDto["moduleId"],
  isActive: boolean
): PlatformModuleDto {
  return {
    moduleId,
    moduleName: moduleId,
    icon: null,
    isActive,
    canDisable: true,
    userMessageFr: null,
    userMessageEn: null,
    scheduledReactivation: null
  };
}

describe("shouldAskMerchantKind / isMillsModuleActive", () => {
  it("flag mills OFF → pas de question, module inactif", () => {
    const modules = [mod("marketplace", true), mod("mills", false)];
    expect(isMillsModuleActive(modules)).toBe(false);
    expect(shouldAskMerchantKind(modules)).toBe(false);
  });

  it("flag mills ON → question affichée", () => {
    const modules = [mod("marketplace", true), mod("mills", true)];
    expect(isMillsModuleActive(modules)).toBe(true);
    expect(shouldAskMerchantKind(modules)).toBe(true);
  });

  it("modules absents → pas de régression (standard)", () => {
    expect(shouldAskMerchantKind(undefined)).toBe(false);
    expect(shouldAskMerchantKind([])).toBe(false);
  });
});
