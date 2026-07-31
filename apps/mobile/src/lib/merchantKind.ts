import type { PlatformModuleDto } from "./api/config";
import type { MerchantKind } from "./api/merchant";

/** True si le module plateforme `mills` est actif pour l'utilisateur (config client). */
export function isMillsModuleActive(
  platformModules: PlatformModuleDto[] | null | undefined
): boolean {
  return (
    platformModules?.some((m) => m.moduleId === "mills" && m.isActive) ?? false
  );
}

/** Affiche la question de sous-type commerçant uniquement si le flag mills est actif. */
export function shouldAskMerchantKind(
  platformModules: PlatformModuleDto[] | null | undefined
): boolean {
  return isMillsModuleActive(platformModules);
}

export function resolveMerchantKindLabelKey(
  kind: MerchantKind | null | undefined
): "standard" | "mill" {
  return kind === "mill" ? "mill" : "standard";
}
