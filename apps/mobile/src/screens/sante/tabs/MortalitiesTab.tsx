import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { FinanceKpiCard } from "../../../components/finance/FinanceKpiCard";
import { ScreenSection } from "../../../components/layout";
import type { FarmHealthRecordRowDto } from "../../../lib/api";
import { mobileSpacing } from "../../../theme/mobileTheme";
import { HealthKindListTab } from "./HealthKindListTab";
import type { ComponentProps } from "react";

type ListProps = Omit<
  ComponentProps<typeof HealthKindListTab>,
  "kind" | "prependContent"
>;

type Props = ListProps & {
  records: FarmHealthRecordRowDto[];
  mortalityRate30: number | null;
  mortalityRate90: number | null;
  locale: string;
};

export function MortalitiesTab({
  records,
  mortalityRate30,
  mortalityRate90,
  locale,
  ...listProps
}: Props) {
  const { t } = useTranslation();

  const deathsThisMonth = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    return records.filter((r) => {
      if (r.kind !== "mortality") {
        return false;
      }
      const d = new Date(r.occurredAt);
      return d.getFullYear() === y && d.getMonth() === m;
    }).length;
  }, [records]);

  const prepend = (
    <ScreenSection plain>
      <View style={styles.kpiRow}>
        <View style={styles.kpi}>
          <FinanceKpiCard
            title={t("health.mortality30")}
            value={
              mortalityRate30 != null
                ? `${(mortalityRate30 * 100).toLocaleString(locale, {
                    maximumFractionDigits: 2
                  })} %`
                : "—"
            }
            deltaText={null}
            variant="expense"
          />
        </View>
        <View style={styles.kpi}>
          <FinanceKpiCard
            title={t("health.mortality90")}
            value={
              mortalityRate90 != null
                ? `${(mortalityRate90 * 100).toLocaleString(locale, {
                    maximumFractionDigits: 2
                  })} %`
                : "—"
            }
            deltaText={null}
            variant="orange"
          />
        </View>
      </View>
      <View style={styles.kpi}>
        <FinanceKpiCard
          title={t("health.mortalityMonth")}
          value={String(deathsThisMonth)}
          deltaText={null}
          variant="yellow"
        />
      </View>
    </ScreenSection>
  );

  return (
    <HealthKindListTab
      kind="mortality"
      locale={locale}
      records={records}
      prependContent={prepend}
      showSubjectPicker={false}
      {...listProps}
    />
  );
}

const styles = StyleSheet.create({
  kpiRow: {
    flexDirection: "row",
    gap: mobileSpacing.sm,
    marginBottom: mobileSpacing.sm
  },
  kpi: { flex: 1 }
});
