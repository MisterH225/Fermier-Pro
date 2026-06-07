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
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

export type StockLineForm = {
  key: string;
  feedTypeId: string;
  newFeedName: string;
  newFeedMode: boolean;
  quantity: string;
  quantityUnit: "kg" | "tonne" | "sac";
  unitPrice: string;
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

function lineSubtotal(line: StockLineForm, types: FeedTypeDto[]): number {
  const q = Number.parseFloat(line.quantity.replace(",", "."));
  const p = Number.parseFloat(line.unitPrice.replace(",", "."));
  if (!Number.isFinite(q) || !Number.isFinite(p)) {
    return 0;
  }
  const ft = types.find((t) => t.id === line.feedTypeId);
  if (line.quantityUnit === "sac" && ft?.unit === "sac") {
    return q * p;
  }
  return q * p;
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
      const unitPrice = l.unitPrice.trim()
        ? Number.parseFloat(l.unitPrice.replace(",", "."))
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
            unit: l.quantityUnit === "sac" ? "sac" : "kg"
          },
          quantityInput: q,
          quantityUnit: l.quantityUnit,
          unitPrice,
          weightPerBagKg,
          supplier: (l.supplier || defaultSupplier)?.trim() || undefined
        };
      }
      return {
        feedTypeId: l.feedTypeId || undefined,
        quantityInput: q,
        quantityUnit: l.quantityUnit,
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
    () => lines.reduce((s, l) => s + lineSubtotal(l, types), 0),
    [lines, types]
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
        unitPrice: "",
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
      {lines.map((line, idx) => (
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
                        ft.unit === "kg" || ft.unit === "tonne"
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
          <Text style={styles.lab}>{t("financeStockLink.quantity")}</Text>
          <TextInput
            style={styles.input}
            value={line.quantity}
            onChangeText={(v) => {
              const q = Number.parseFloat(v.replace(",", "."));
              const patch: Partial<StockLineForm> = { quantity: v };
              if (
                Number.isFinite(q) &&
                q > 0 &&
                totalAmount > 0 &&
                lines.length === 1 &&
                !line.unitPrice.trim()
              ) {
                patch.unitPrice = String(
                  Math.round((totalAmount / q) * 100) / 100
                );
              }
              updateLine(idx, patch);
            }}
            keyboardType="decimal-pad"
          />
          <Text style={styles.lab}>{t("financeStockLink.unitPrice")}</Text>
          <TextInput
            style={styles.input}
            value={line.unitPrice}
            onChangeText={(v) => updateLine(idx, { unitPrice: v })}
            keyboardType="decimal-pad"
            placeholder={currencyCode}
          />
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
              amount: lineSubtotal(line, types).toFixed(2),
              currency: currencyCode
            })}
          </Text>
        </View>
      ))}
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
  remove: { color: mobileColors.error, fontSize: 18 },
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 4,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.background
  },
  chipTx: { fontSize: 12, fontWeight: "600", color: mobileColors.accent },
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
  typeChipTx: { fontSize: 12, fontWeight: "600" },
  lab: {
    fontSize: 12,
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
