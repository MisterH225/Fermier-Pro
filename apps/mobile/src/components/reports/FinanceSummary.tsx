import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type Fin = {
  current?: { totals?: { revenues?: string; expenses?: string } };
  deltaRevenuesPct?: number | null;
  deltaExpensesPct?: number | null;
  marginPct?: number | null;
  topExpenses?: Array<{ label: string; expenses: number }>;
  topRevenues?: Array<{ label: string; revenues: number }>;
  monthlyTrend?: Array<{ month: string; revenues: string; expenses: string }>;
};

export function FinanceSummary({ finance }: { finance: Fin | undefined }) {
  const { t } = useTranslation();
  if (!finance?.current?.totals) {
    return (
      <Text style={styles.muted}>{t("reportsScreen.sectionNoData")}</Text>
    );
  }
  const rev = Number(finance.current.totals.revenues ?? 0);
  const exp = Number(finance.current.totals.expenses ?? 0);
  const net = rev - exp;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>💰 {t("reportsScreen.financeTitle")}</Text>
      <View style={styles.kpis}>
        <Kpi label={t("reportsScreen.revTotal")} value={rev} />
        <Kpi label={t("reportsScreen.expTotal")} value={exp} />
        <Kpi label={t("reportsScreen.netMargin")} value={net} accent />
        <Kpi
          label={t("reportsScreen.marginPct")}
          value={finance.marginPct != null ? `${finance.marginPct.toFixed(1)}%` : "—"}
        />
      </View>
      {finance.deltaRevenuesPct != null ? (
        <Text style={styles.line}>
          Δ {t("reportsScreen.revTotal")}: {finance.deltaRevenuesPct}%
        </Text>
      ) : null}
      {finance.deltaExpensesPct != null ? (
        <Text style={styles.line}>
          Δ {t("reportsScreen.expTotal")}: {finance.deltaExpensesPct}%
        </Text>
      ) : null}
      {finance.topExpenses?.length ? (
        <>
          <Text style={styles.sub}>{t("reportsScreen.topExp")}</Text>
          {finance.topExpenses.map((r) => (
            <Text key={r.label} style={styles.line}>
              • {r.label}: {r.expenses}
            </Text>
          ))}
        </>
      ) : null}
      {finance.topRevenues?.length ? (
        <>
          <Text style={styles.sub}>{t("reportsScreen.topRev")}</Text>
          {finance.topRevenues.map((r) => (
            <Text key={r.label} style={styles.line}>
              • {r.label}: {r.revenues}
            </Text>
          ))}
        </>
      ) : null}
    </View>
  );
}

function Kpi({
  label,
  value,
  accent
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  const v =
    typeof value === "number"
      ? new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)
      : value;
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLab}>{label}</Text>
      <Text style={[styles.kpiVal, accent && { color: mobileColors.accent }]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.lg,
    backgroundColor: mobileColors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    gap: mobileSpacing.xs
  },
  title: { ...mobileTypography.cardTitle, color: mobileColors.textPrimary },
  kpis: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.sm, marginTop: mobileSpacing.sm },
  kpi: { flexBasis: "47%", flexGrow: 1 },
  kpiLab: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  kpiVal: { ...mobileTypography.body, fontWeight: "700", color: mobileColors.textPrimary },
  sub: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    marginTop: mobileSpacing.sm
  },
  line: { ...mobileTypography.body, color: mobileColors.textPrimary },
  muted: { ...mobileTypography.meta, color: mobileColors.textSecondary }
});
