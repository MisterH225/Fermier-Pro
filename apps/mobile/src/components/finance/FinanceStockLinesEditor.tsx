import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import type { FeedTypeDto, FinanceStockLineInput } from "../../lib/api";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";

export type StockLineForm = {
  key: string;
  feedTypeId: string;
  newFeedName: string;
  newFeedMode: boolean;
  quantity: string;
  quantityUnit: "kg" | "tonne" | "sac";
  totalCost: string;
  weightPerBagKg: string;
  supplier: string;
};

type Props = {
  types: FeedTypeDto[];
  lines: StockLineForm[];
  onChange: (lines: StockLineForm[]) => void;
  totalAmount: number;
  currencyCode: string;
  defaultSupplier?: string;
};

function lineSubtotal(line: StockLineForm): number {
  const cost = Number.parseFloat(line.totalCost.replace(",", "."));
  return Number.isFinite(cost) && cost >= 0 ? cost : 0;
}

function derivedUnitPrice(line: StockLineForm): number | null {
  const cost = Number.parseFloat(line.totalCost.replace(",", "."));
  const q = Number.parseFloat(line.quantity.replace(",", "."));
  if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(q) || q <= 0) {
    return null;
  }
  if (line.quantityUnit === "sac") {
    return cost / q;
  }
  if (line.quantityUnit === "tonne") {
    return cost / (q * 1000);
  }
  return cost / q;
}

function unitLabel(
  unit: StockLineForm["quantityUnit"],
  t: (key: string) => string
): string {
  switch (unit) {
    case "sac":
      return t("financeStockLink.unitSac");
    case "tonne":
      return t("financeStockLink.unitTonne");
    default:
      return t("financeStockLink.unitKg");
  }
}

export function stockLinesToPayload(
  lines: StockLineForm[],
  types: FeedTypeDto[],
  defaultSupplier?: string
): FinanceStockLineInput[] {
  return lines
    .filter((l) => l.quantity.trim())
    .map((l) => {
      const q = Number.parseFloat(l.quantity.replace(",", "."));
      const totalCost = l.totalCost.trim()
        ? Number.parseFloat(l.totalCost.replace(",", "."))
        : undefined;
      const unitPrice =
        totalCost != null && Number.isFinite(totalCost) && Number.isFinite(q) && q > 0
          ? derivedUnitPrice({ ...l, totalCost: String(totalCost) }) ?? undefined
          : undefined;
      const ft = types.find((t) => t.id === l.feedTypeId);
      const wpbRaw = l.weightPerBagKg.trim();
      const wpbFromForm = wpbRaw
        ? Number.parseFloat(wpbRaw.replace(",", "."))
        : undefined;
      const ftWpb =
        ft?.weightPerBagKg != null
          ? Number.parseFloat(String(ft.weightPerBagKg))
          : undefined;
      const weightPerBagKg =
        l.quantityUnit === "sac"
          ? Number.isFinite(wpbFromForm!)
            ? wpbFromForm
            : Number.isFinite(ftWpb!)
              ? ftWpb
              : undefined
          : undefined;

      if (l.newFeedMode && l.newFeedName.trim()) {
        return {
          newFeedType: {
            name: l.newFeedName.trim(),
            unit:
              l.quantityUnit === "sac"
                ? "sac"
                : l.quantityUnit === "tonne"
                  ? "kg"
                  : "kg"
          },
          quantityInput: q,
          quantityUnit: l.quantityUnit,
          totalCost:
            totalCost != null && Number.isFinite(totalCost) ? totalCost : undefined,
          unitPrice,
          priceBasis: l.quantityUnit === "sac" ? ("sac" as const) : ("kg" as const),
          weightPerBagKg,
          supplier: (l.supplier || defaultSupplier)?.trim() || undefined
        };
      }
      return {
        feedTypeId: l.feedTypeId || undefined,
        quantityInput: q,
        quantityUnit: l.quantityUnit,
        totalCost:
          totalCost != null && Number.isFinite(totalCost) ? totalCost : undefined,
        unitPrice,
        priceBasis: l.quantityUnit === "sac" ? ("sac" as const) : ("kg" as const),
        weightPerBagKg,
        supplier: (l.supplier || defaultSupplier)?.trim() || undefined
      };
    });
}

export function FinanceStockLinesEditor({
  types,
  lines,
  onChange,
  totalAmount,
  currencyCode,
  defaultSupplier
}: Props) {
  const { t } = useTranslation();

  const linesTotal = useMemo(
    () => lines.reduce((s, l) => s + lineSubtotal(l), 0),
    [lines]
  );

  const gap = Math.abs(linesTotal - totalAmount);
  const showGap = totalAmount > 0 && linesTotal > 0 && gap > 0.01;

  const updateLine = (idx: number, patch: Partial<StockLineForm>) => {
    const next = lines.map((l, i) => (i === idx ? { ...l, ...patch } : l));
    onChange(next);
  };

  const addLine = () => {
    onChange([
      ...lines,
      {
        key: `l-${Date.now()}`,
        feedTypeId: types[0]?.id ?? "",
        newFeedName: "",
        newFeedMode: false,
        quantity: "",
        quantityUnit: (types[0]?.unit as "kg" | "sac") ?? "sac",
        totalCost: "",
        weightPerBagKg: types[0]?.weightPerBagKg
          ? String(types[0].weightPerBagKg)
          : "",
        supplier: defaultSupplier ?? ""
      }
    ]);
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 1) {
      return;
    }
    onChange(lines.filter((_, i) => i !== idx));
  };

  return (
    <View style={styles.wrap}>
      {lines.map((line, idx) => {
        const unitPx = derivedUnitPrice(line);
        return (
          <View key={line.key} style={styles.lineCard}>
            <View style={styles.lineHeader}>
              <Text style={styles.lineTitle}>
                {t("financeStockLink.line", { n: idx + 1 })}
              </Text>
              {lines.length > 1 ? (
                <Pressable onPress={() => removeLine(idx)} hitSlop={8}>
                  <Text style={styles.remove}>✕</Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable
              style={styles.chip}
              onPress={() =>
                updateLine(idx, { newFeedMode: !line.newFeedMode })
              }
            >
              <Text style={styles.chipTx}>
                {line.newFeedMode
                  ? t("financeStockLink.useExistingType")
                  : t("financeStockLink.newFeedType")}
              </Text>
            </Pressable>
            {line.newFeedMode ? (
              <TextInput
                style={styles.input}
                value={line.newFeedName}
                onChangeText={(v) => updateLine(idx, { newFeedName: v })}
                placeholder={t("feedStock.fieldName")}
              />
            ) : (
              <View style={styles.typeRow}>
                {types.map((ft) => (
                  <Pressable
                    key={ft.id}
                    style={[
                      styles.typeChip,
                      line.feedTypeId === ft.id && styles.typeChipOn
                    ]}
                    onPress={() =>
                      updateLine(idx, {
                        feedTypeId: ft.id,
                        quantityUnit:
                          ft.unit === "tonne"
                            ? "tonne"
                            : ft.unit === "kg"
                              ? "kg"
                              : "sac",
                        weightPerBagKg: ft.weightPerBagKg
                          ? String(ft.weightPerBagKg)
                          : ""
                      })
                    }
                  >
                    <Text style={styles.typeChipTx}>{ft.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Text style={styles.lab}>
              {t("financeStockLink.quantityWithUnit", {
                unit: unitLabel(line.quantityUnit, t)
              })}
            </Text>
            <TextInput
              style={styles.input}
              value={line.quantity}
              onChangeText={(v) => {
                const patch: Partial<StockLineForm> = { quantity: v };
                if (
                  totalAmount > 0 &&
                  lines.length === 1 &&
                  !line.totalCost.trim()
                ) {
                  patch.totalCost = String(Math.round(totalAmount * 100) / 100);
                }
                updateLine(idx, patch);
              }}
              keyboardType="decimal-pad"
            />
            <View style={styles.unitRow}>
              {(["sac", "kg", "tonne"] as const).map((u) => (
                <Pressable
                  key={u}
                  style={[
                    styles.unitChip,
                    line.quantityUnit === u && styles.unitChipOn
                  ]}
                  onPress={() => updateLine(idx, { quantityUnit: u })}
                >
                  <Text
                    style={[
                      styles.unitChipTx,
                      line.quantityUnit === u && styles.unitChipTxOn
                    ]}
                  >
                    {unitLabel(u, t)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.lab}>{t("financeStockLink.totalCost")}</Text>
            <TextInput
              style={styles.input}
              value={line.totalCost}
              onChangeText={(v) => updateLine(idx, { totalCost: v })}
              keyboardType="decimal-pad"
              placeholder={currencyCode}
            />
            {unitPx != null ? (
              <Text style={styles.hint}>
                {line.quantityUnit === "sac"
                  ? t("financeStockLink.calculatedUnitPriceSac", {
                      price: unitPx.toFixed(2),
                      currency: currencyCode
                    })
                  : t("financeStockLink.calculatedUnitPrice", {
                      price: unitPx.toFixed(2),
                      currency: currencyCode
                    })}
              </Text>
            ) : null}
            {line.quantityUnit === "sac" &&
            !types.find((ft) => ft.id === line.feedTypeId)?.weightPerBagKg ? (
              <>
                <Text style={styles.lab}>{t("financeStockLink.weightPerBag")}</Text>
                <TextInput
                  style={styles.input}
                  value={line.weightPerBagKg}
                  onChangeText={(v) => updateLine(idx, { weightPerBagKg: v })}
                  keyboardType="decimal-pad"
                  placeholder="25"
                />
                <Text style={styles.hint}>
                  {t("financeStockLink.weightPerBagHint")}
                </Text>
              </>
            ) : null}
            <Text style={styles.sub}>
              {t("financeStockLink.lineSubtotal", {
                amount: lineSubtotal(line).toFixed(2),
                currency: currencyCode
              })}
            </Text>
          </View>
        );
      })}
      <Pressable onPress={addLine} style={styles.addBtn}>
        <Text style={styles.addTx}>{t("financeStockLink.addLine")}</Text>
      </Pressable>
      {showGap ? (
        <Text style={styles.gapWarn}>
          {t("financeStockLink.totalGap", {
            gap: gap.toFixed(2),
            currency: currencyCode
          })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.sm },
  lineCard: {
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    gap: mobileSpacing.xs
  },
  lineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  lineTitle: { ...mobileTypography.meta, fontWeight: "700" },
  remove: { color: mobileColors.error, fontSize: mobileFontSize.lg },
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 4,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.background
  },
  chipTx: { fontSize: mobileFontSize.sm, fontWeight: "600", color: mobileColors.accent },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.xs },
  typeChip: {
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 6,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  typeChipOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  typeChipTx: { fontSize: mobileFontSize.sm, fontWeight: "600" },
  unitRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.xs,
    marginTop: mobileSpacing.xs
  },
  unitChip: {
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 6,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  unitChipOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  unitChipTx: { fontSize: mobileFontSize.sm, fontWeight: "600" },
  unitChipTxOn: { color: mobileColors.accent },
  lab: {
    fontSize: mobileFontSize.sm,
    fontWeight: "700",
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.xs
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.sm,
    color: mobileColors.textPrimary
  },
  sub: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  addBtn: { alignSelf: "flex-start" },
  addTx: { color: mobileColors.accent, fontWeight: "700" },
  gapWarn: { color: mobileColors.warning, ...mobileTypography.meta }
});
