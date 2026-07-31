import type { PlatformModuleDto } from "./api/config";

/** True si le module plateforme `feed_composition` est actif (config client). */
export function isFeedCompositionModuleActive(
  platformModules: PlatformModuleDto[] | null | undefined
): boolean {
  return (
    platformModules?.some(
      (m) => m.moduleId === "feed_composition" && m.isActive
    ) ?? false
  );
}
