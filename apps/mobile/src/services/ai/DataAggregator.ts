import type { AIModuleKey } from "./aiTypes";

/**
 * Vérifie si le module a assez de contexte local pour tenter un appel IA.
 * L’agrégation réelle est faite côté API (données sensibles non exposées au client).
 */
export function canRequestAIInsights(
  module: AIModuleKey,
  context?: { hasFarmId?: boolean; hasMinimalData?: boolean }
): boolean {
  if (!context?.hasFarmId) {
    return false;
  }
  if (context.hasMinimalData === false) {
    return false;
  }
  return true;
}
