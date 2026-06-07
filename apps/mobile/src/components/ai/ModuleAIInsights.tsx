import { useTranslation } from "react-i18next";
import { InsightCard } from "./InsightCard";
import { ScreenSection } from "../layout/ScreenSection";
import { useAIInsights } from "../../hooks/useAIInsights";
import type { AIModuleKey } from "../../services/ai/aiTypes";

type Props = {
  farmId: string | null | undefined;
  module: AIModuleKey;
  accessToken: string | null | undefined;
  activeProfileId?: string | null;
  enabled?: boolean;
  hasMinimalData?: boolean;
};

/** Bloc insights IA — masqué silencieusement si vide ou erreur. */
export function ModuleAIInsights({
  farmId,
  module,
  accessToken,
  activeProfileId,
  enabled = true,
  hasMinimalData = true
}: Props) {
  const { t } = useTranslation();
  const { items, loading, refresh, visible } = useAIInsights({
    farmId,
    module,
    accessToken,
    activeProfileId,
    enabled,
    hasMinimalData
  });

  if (!visible && !loading) {
    return null;
  }

  return (
    <ScreenSection title={t("financeScreen.insights")} plain>
      <InsightCard
        insights={items}
        loading={loading}
        onRefresh={refresh}
      />
    </ScreenSection>
  );
}
