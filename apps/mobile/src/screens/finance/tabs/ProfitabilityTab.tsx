import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ModuleAIInsights } from "../../../components/ai/ModuleAIInsights";
import { ScreenSection } from "../../../components/layout";
import {
  CostBreakdownChart,
  EvolutionChart,
  ICPanel,
  ProfitabilityKPICards,
  SimulationTool
} from "../../../components/profitability";
import {
  fetchProfitabilityHistory,
  fetchProfitabilityPeriod
} from "../../../lib/api";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";

type Props = {
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  year: number;
  month: number;
};

export function ProfitabilityTab({
  farmId,
  accessToken,
  activeProfileId,
  year,
  month
}: Props) {
  const { t } = useTranslation();

  const periodQ = useQuery({
    queryKey: ["profitability", farmId, year, month, activeProfileId],
    queryFn: () =>
      fetchProfitabilityPeriod(accessToken, farmId, year, month, activeProfileId),
    enabled: Boolean(accessToken && farmId)
  });

  const historyQ = useQuery({
    queryKey: ["profitabilityHistory", farmId, activeProfileId],
    queryFn: () => fetchProfitabilityHistory(accessToken, farmId, 6, activeProfileId),
    enabled: Boolean(accessToken && farmId)
  });

  const refreshing = periodQ.isFetching || historyQ.isFetching;
  const data = periodQ.data;

  if (periodQ.isPending && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={mobileColors.accent} />
      </View>
    );
  }

  if (periodQ.error instanceof Error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{periodQ.error.message}</Text>
      </View>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            void periodQ.refetch();
            void historyQ.refetch();
          }}
        />
      }
    >
      <ScreenSection plain>
        <ProfitabilityKPICards data={data} />
      </ScreenSection>

      <ScreenSection title={t("profitability.icTitle")}>
        <ICPanel data={data} />
      </ScreenSection>

      <ScreenSection title={t("profitability.costBreakdownTitle")}>
        <CostBreakdownChart data={data} />
      </ScreenSection>

      {historyQ.data && historyQ.data.length >= 2 ? (
        <ScreenSection title={t("profitability.evolutionTitle")}>
          <EvolutionChart
            history={historyQ.data}
            currencySymbol={data.currencySymbol}
          />
        </ScreenSection>
      ) : null}

      <ScreenSection plain>
        <ModuleAIInsights farmId={farmId} module="finance" accessToken={accessToken} activeProfileId={activeProfileId} />
      </ScreenSection>

      <ScreenSection plain>
        <SimulationTool
          farmId={farmId}
          accessToken={accessToken}
          activeProfileId={activeProfileId}
          data={data}
          year={year}
          month={month}
        />
      </ScreenSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: mobileSpacing.xl, gap: mobileSpacing.md },
  center: { padding: mobileSpacing.xl, alignItems: "center" },
  error: { ...mobileTypography.body, color: mobileColors.error }
});
