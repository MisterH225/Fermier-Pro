import { ModuleAIInsights } from "../../ai/ModuleAIInsights";

type Props = {
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  hasData: boolean;
};

export function DiseaseAIRecommendations({
  farmId,
  accessToken,
  activeProfileId,
  hasData
}: Props) {
  return (
    <ModuleAIInsights
      farmId={farmId}
      module="sante_diseases"
      accessToken={accessToken}
      activeProfileId={activeProfileId}
      hasMinimalData={hasData}
    />
  );
}
