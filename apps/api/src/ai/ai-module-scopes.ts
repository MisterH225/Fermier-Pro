import { FARM_SCOPE } from "../common/farm-scopes.constants";
import type { AiModuleKey } from "./ai.types";

/** Scopes requis pour `POST /ai/recommendations` selon le module demandé. */
export function requiredScopesForAiModule(module: AiModuleKey): string[] {
  switch (module) {
    case "finance":
      return [FARM_SCOPE.financeRead];
    case "cheptel":
      return [FARM_SCOPE.livestockRead];
    case "sante":
    case "sante_diseases":
      return [FARM_SCOPE.healthRead];
    case "stock":
      return [FARM_SCOPE.livestockRead];
    case "gestation":
      return [FARM_SCOPE.livestockRead];
    case "global_dashboard":
      return [FARM_SCOPE.livestockRead, FARM_SCOPE.healthRead];
    default:
      return [FARM_SCOPE.livestockRead];
  }
}
