import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useModal } from "../../modals/useModal";
import type { FarmBudgetLineDto, FarmBudgetViewDto } from "../../../lib/api";
import { fetchFarmBudget } from "../../../lib/api";
import { invalidateFarmFinanceQueries } from "../../../lib/invalidateFarmFinanceQueries";
import { mobileColors, mobileSpacing, mobileTypography, mobileRadius } from "../../../theme/mobileTheme";
import { BudgetHeader } from "./BudgetHeader";
import { BudgetLineCard } from "./BudgetLineCard";
import { BudgetLineModal } from "./BudgetLineModal";
import { BudgetSetupModal } from "./BudgetSetupModal";
import { BudgetSuggestions } from "./BudgetSuggestions";
import { GlobalBudgetGauge } from "./GlobalBudgetGauge";
import { BudgetAIAnalysis } from "./BudgetAIAnalysis";
import { HighlightWrapper } from "../../common/HighlightWrapper";

type Props = {
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  highlightCategoryId?: string;
  highlightOverrun?: boolean;
};

function shiftMonth(year: number, month: number, delta: number) {
  let m = month + delta;
  let y = year;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  return { year: y, month: m };
}

export function BudgetScreen({
  farmId,
  accessToken,
  activeProfileId,
  highlightCategoryId,
  highlightOverrun
}: Props) {
  const { t, i18n } = useTranslation();
  const { open } = useModal();
  const qc = useQueryClient();
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [setupOpen, setSetupOpen] = useState(false);
  const [editLine, setEditLine] = useState<FarmBudgetLineDto | null>(null);
  const [highlightCategory, setHighlightCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightCategoryId) {
      setHighlightCategory(null);
      return;
    }
    setHighlightCategory(highlightCategoryId);
    const timer = setTimeout(() => setHighlightCategory(null), 2200);
    return () => clearTimeout(timer);
  }, [highlightCategoryId]);

  const budgetQ = useQuery({
    queryKey: ["farmBudget", farmId, year, month, activeProfileId],
    queryFn: () =>
      fetchFarmBudget(accessToken, farmId, year, month, activeProfileId)
  });

  const invalidate = useCallback(() => {
    invalidateFarmFinanceQueries(qc, farmId);
    void budgetQ.refetch();
  }, [qc, farmId, budgetQ]);

  const onBudgetSaved = useCallback(
    (view: FarmBudgetViewDto) => {
      qc.setQueryData(
        ["farmBudget", farmId, view.year, view.month, activeProfileId],
        view
      );
      open("success", {
        title: t("budgetScreen.savedTitle"),
        message: t("budgetScreen.savedMessage")
      });
      invalidate();
    },
    [qc, farmId, activeProfileId, open, t, invalidate]
  );

  const data = budgetQ.data;
  const locale = i18n.language?.startsWith("en") ? "en-US" : "fr-FR";

  if (budgetQ.isPending && !data) {
    return (
      <ActivityIndicator color={mobileColors.accent} style={{ marginTop: 24 }} />
    );
  }

  if (budgetQ.isError || !data) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.err}>{t("budgetScreen.loadError")}</Text>
        <Pressable onPress={() => budgetQ.refetch()}>
          <Text style={styles.retry}>{t("budgetScreen.retry")}</Text>
        </Pressable>
      </View>
    );
  }

  const globalStatus = data.configured
    ? data.global.status
    : data.global.consumptionPct > 100
      ? "exceeded"
      : data.global.consumptionPct >= 80
        ? "warning"
        : "on_track";

  return (
    <View style={styles.wrap}>
      <BudgetHeader
        year={year}
        month={month}
        farmId={farmId}
        globalStatus={globalStatus}
        onPrevMonth={() => {
          const p = shiftMonth(year, month, -1);
          setYear(p.year);
          setMonth(p.month);
        }}
        onNextMonth={() => {
          const n = shiftMonth(year, month, 1);
          setYear(n.year);
          setMonth(n.month);
        }}
        onMonthSelect={(y, m) => {
          setYear(y);
          setMonth(m);
        }}
        onConfigure={() => setSetupOpen(true)}
      />

      {!data.configured ? (
        <View style={styles.banner}>
          <Text style={styles.bannerTx}>{t("budgetScreen.notConfigured")}</Text>
          <Pressable style={styles.bannerBtn} onPress={() => setSetupOpen(true)}>
            <Text style={styles.bannerBtnTx}>{t("budgetScreen.configure")}</Text>
          </Pressable>
        </View>
      ) : null}

      <GlobalBudgetGauge
        global={data.global}
        currency={data.currency}
        currencySymbol={data.currencySymbol}
      />

      <Text style={styles.section}>{t("budgetScreen.linesTitle")}</Text>
      {data.lines.map((line) => {
        const active =
          highlightCategory === line.categoryId &&
          (!highlightOverrun ||
            line.status === "exceeded" ||
            line.status === "warning");
        return (
          <HighlightWrapper key={line.categoryId} active={active}>
            <BudgetLineCard
              line={line}
              currencySymbol={data.currencySymbol}
              onEdit={
                line.categoryKey === "uncategorized"
                  ? undefined
                  : () => setEditLine(line)
              }
            />
          </HighlightWrapper>
        );
      })}

      <Pressable style={styles.addBtn} onPress={() => setSetupOpen(true)}>
        <Text style={styles.addTx}>{t("budgetScreen.addCategory")}</Text>
      </Pressable>

      <BudgetAIAnalysis
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        year={year}
        month={month}
        currencySymbol={data.currencySymbol}
        onApplied={invalidate}
      />

      <BudgetSuggestions
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        suggestions={data.suggestions}
        onChange={invalidate}
      />

      <BudgetSetupModal
        visible={setupOpen}
        onClose={() => setSetupOpen(false)}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        year={year}
        month={month}
        locale={locale}
        lines={data.lines}
        currency={data.currency}
        currencySymbol={data.currencySymbol}
        onSaved={onBudgetSaved}
      />

      <BudgetLineModal
        visible={Boolean(editLine)}
        onClose={() => setEditLine(null)}
        line={editLine}
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        year={year}
        month={month}
        locale={locale}
        allLines={data.lines}
        currencySymbol={data.currencySymbol}
        onSaved={onBudgetSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.md },
  err: { ...mobileTypography.body, color: mobileColors.error },
  retry: { ...mobileTypography.body, color: mobileColors.accent, marginTop: 8 },
  banner: {
    backgroundColor: mobileColors.accentSoft,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    gap: mobileSpacing.sm
  },
  bannerTx: { ...mobileTypography.body, color: mobileColors.textPrimary },
  bannerBtn: {
    alignSelf: "flex-start",
    backgroundColor: mobileColors.accent,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.xs,
    borderRadius: mobileRadius.sm
  },
  bannerBtnTx: { color: mobileColors.onAccent, fontWeight: "600" },
  section: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    marginTop: mobileSpacing.sm
  },
  addBtn: {
    alignItems: "center",
    paddingVertical: mobileSpacing.md,
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    borderStyle: "dashed"
  },
  addTx: {
    ...mobileTypography.body,
    color: mobileColors.accent,
    fontWeight: "600"
  }
});
