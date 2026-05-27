import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import type { ProfitabilityPeriodDto } from "../../lib/api";
import { simulateProfitability } from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { formatProfitMoney } from "./profitabilityFormat";

type Props = {
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  data: ProfitabilityPeriodDto;
  year: number;
  month: number;
};

export function SimulationTool({
  farmId,
  accessToken,
  activeProfileId,
  data,
  year,
  month
}: Props) {
  const { t } = useTranslation();
  const [scenario, setScenario] = useState<"sale_price" | "ic_improvement_pct" | "headcount_delta">(
    "sale_price"
  );
  const [inputVal, setInputVal] = useState(
    data.avgSalePricePerKg != null ? String(Math.round(data.avgSalePricePerKg)) : "1500"
  );

  const sim = useMutation({
    mutationFn: () => {
      const v = Number.parseFloat(inputVal.replace(",", "."));
      if (!Number.isFinite(v)) throw new Error("invalid");
      return simulateProfitability(
        accessToken,
        farmId,
        scenario,
        v,
        year,
        month,
        activeProfileId
      );
    }
  });

  return (
    <View style={styles.box}>
      <Text style={styles.title}>{t("profitability.simTitle")}</Text>
      <Text style={styles.desc}>{t("profitability.simDesc")}</Text>
      <View style={styles.chips}>
        {(
          [
            ["sale_price", t("profitability.simSalePrice")],
            ["ic_improvement_pct", t("profitability.simIc")],
            ["headcount_delta", t("profitability.simHeadcount")]
          ] as const
        ).map(([id, lab]) => (
          <Pressable
            key={id}
            style={[styles.chip, scenario === id && styles.chipOn]}
            onPress={() => setScenario(id)}
          >
            <Text style={styles.chipTx}>{lab}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        value={inputVal}
        onChangeText={setInputVal}
        keyboardType="decimal-pad"
        placeholder={t("profitability.simInputPh")}
      />
      <Pressable style={styles.btn} onPress={() => sim.mutate()} disabled={sim.isPending}>
        {sim.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnTx}>{t("profitability.simRun")}</Text>
        )}
      </Pressable>
      {sim.data ? (
        <View style={styles.result}>
          <Text style={styles.resultMsg}>{sim.data.message}</Text>
          <Text style={styles.resultLine}>
            {t("profitability.kpiMargin")}:{" "}
            {formatProfitMoney(sim.data.marginPerKg, data.currency, data.currencySymbol)}
          </Text>
          <Text style={styles.resultLine}>
            {t("profitability.kpiCostPerKgSold")}:{" "}
            {formatProfitMoney(sim.data.costPerKgSold, data.currency, data.currencySymbol)}
          </Text>
          {sim.data.feedSavingsEstimate != null ? (
            <Text style={styles.resultLine}>
              {t("profitability.simFeedSavings")}:{" "}
              {formatProfitMoney(
                sim.data.feedSavingsEstimate,
                data.currency,
                data.currencySymbol
              )}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: mobileColors.surface,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  title: { ...mobileTypography.sectionTitle, marginBottom: 4 },
  desc: { ...mobileTypography.meta, color: mobileColors.textSecondary, marginBottom: mobileSpacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: mobileSpacing.sm },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.canvas
  },
  chipOn: { backgroundColor: mobileColors.accent },
  chipTx: { ...mobileTypography.meta },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.sm,
    marginBottom: mobileSpacing.sm
  },
  btn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    alignItems: "center"
  },
  btnTx: { color: "#fff", fontWeight: "600" },
  result: { marginTop: mobileSpacing.md },
  resultMsg: { ...mobileTypography.body, fontWeight: "600" },
  resultLine: { ...mobileTypography.meta, marginTop: 4 }
});
