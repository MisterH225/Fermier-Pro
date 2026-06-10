import { ModuleAIInsights } from "./ModuleAIInsights";
import { PredictionsSection } from "../predictions/PredictionsSection";
import { usePredictions } from "../../hooks/usePredictions";
import type { PredictionMenuKey } from "../../lib/api/predictions";
import { isPredictionsPayloadActive } from "../../services/ai/predictionAvailability";
import type { AIModuleKey } from "../../services/ai/aiTypes";

const MENU_TO_AI_MODULE: Record<
  Exclude<PredictionMenuKey, "summary">,
  AIModuleKey
> = {
  cheptel: "cheptel",
  finance: "finance",
  stock: "stock",
  gestation: "gestation"
};

type Props = {
  farmId: string;
  menu: Exclude<PredictionMenuKey, "summary">;
  accessToken: string;
  activeProfileId?: string | null;
  predictionTitle: string;
  farmName?: string;
  onStockOrderPress?: (feedTypeId: string, quantityKg: number) => void;
  hasMinimalData?: boolean;
  recommendationsEnabled?: boolean;
};

/**
 * Prévisions chiffrées en priorité ; recommandations IA uniquement en secours
 * (données insuffisantes, IA indisponible ou prévisions absentes).
 */
export function FarmModuleAISection({
  farmId,
  menu,
  accessToken,
  activeProfileId,
  predictionTitle,
  farmName,
  onStockOrderPress,
  hasMinimalData = true,
  recommendationsEnabled = true
}: Props) {
  const predictionsControl = usePredictions({
    farmId,
    menu,
    accessToken,
    activeProfileId
  });
  const predictionsActive = isPredictionsPayloadActive(predictionsControl.data);
  const showRecommendations = recommendationsEnabled && !predictionsActive;

  return (
    <>
      <PredictionsSection
        farmId={farmId}
        menu={menu}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        title={predictionTitle}
        farmName={farmName}
        onStockOrderPress={onStockOrderPress}
        predictionsControl={predictionsControl}
      />
      {showRecommendations ? (
        <ModuleAIInsights
          farmId={farmId}
          module={MENU_TO_AI_MODULE[menu]}
          accessToken={accessToken}
          activeProfileId={activeProfileId}
          hasMinimalData={hasMinimalData}
          variant="fallback"
        />
      ) : null}
    </>
  );
}

type DashboardProps = {
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  predictionTitle: string;
};

/** Dashboard : aperçu prédictif + alertes métier ; conseils globaux seulement si prévisions inactives. */
export function FarmDashboardAISection({
  farmId,
  accessToken,
  activeProfileId,
  predictionTitle
}: DashboardProps) {
  const predictionsControl = usePredictions({
    farmId,
    menu: "summary",
    accessToken,
    activeProfileId
  });
  const predictionsActive = isPredictionsPayloadActive(predictionsControl.data);

  return (
    <>
      <PredictionsSection
        farmId={farmId}
        menu="summary"
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        title={predictionTitle}
        predictionsControl={predictionsControl}
      />
      {!predictionsActive ? (
        <ModuleAIInsights
          farmId={farmId}
          module="global_dashboard"
          accessToken={accessToken}
          activeProfileId={activeProfileId}
          variant="fallback"
        />
      ) : null}
    </>
  );
}
