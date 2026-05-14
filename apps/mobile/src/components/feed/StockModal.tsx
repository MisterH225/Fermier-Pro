import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { BaseModal } from "../modals/BaseModal";
import type { FeedTypeDto } from "../../lib/api";
import { postFarmFeedMovement } from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

export type StockModalProps = {
  visible: boolean;
  onClose: () => void;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  types: FeedTypeDto[];
  onSuccess: () => void;
};

export function StockModal({
  visible,
  onClose,
  farmId,
  accessToken,
  activeProfileId,
  types,
  onSuccess
}: StockModalProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"in" | "stock_check">("in");
  const [feedTypeId, setFeedTypeId] = useState<string>("");
  const [newMode, setNewMode] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState<"kg" | "tonne" | "sac">("sac");
  const [newWeightBag, setNewWeightBag] = useState("");
  const [qty, setQty] = useState("");
  const [qtyUnit, setQtyUnit] = useState<"kg" | "tonne" | "sac">("sac");
  const [weightOverride, setWeightOverride] = useState("");
  const [bagsCounted, setBagsCounted] = useState("");
  const [supplier, setSupplier] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [priceBasis, setPriceBasis] = useState<"kg" | "sac">("kg");
  const [notes, setNotes] = useState("");
  const [occurredAt, setOccurredAt] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  useEffect(() => {
    if (visible) {
      setTab("in");
      setFeedTypeId(types[0]?.id ?? "");
      setNewMode(false);
      setNewName("");
      setNewUnit("sac");
      setNewWeightBag("");
      setQty("");
      setQtyUnit("sac");
      setWeightOverride("");
      setBagsCounted("");
      setSupplier("");
      setUnitPrice("");
      setPriceBasis("kg");
      setNotes("");
      setOccurredAt(new Date().toISOString().slice(0, 10));
    }
  }, [visible, types]);

  const selected = useMemo(
    () => types.find((x) => x.id === feedTypeId),
    [types, feedTypeId]
  );

  const preview = useMemo(() => {
    if (!selected || tab !== "stock_check") return null;
    const wp =
      Number.parseFloat(weightOverride || selected.weightPerBagKg || "0") ||
      null;
    const prevBagsRaw =
      selected.bagCountCurrent != null
        ? Number.parseFloat(String(selected.bagCountCurrent))
        : wp != null && Number.parseFloat(selected.currentStockKg) > 0
          ? Number.parseFloat(selected.currentStockKg) / wp
          : null;
    const counted = Number.parseFloat(bagsCounted.replace(",", "."));
    if (wp == null || prevBagsRaw == null || !Number.isFinite(counted)) {
      return null;
    }
    const consumed = prevBagsRaw - counted;
    const last = selected.lastCheckDate
      ? new Date(selected.lastCheckDate)
      : null;
    const days =
      last != null && !Number.isNaN(last.getTime())
        ? Math.max(
            1,
            Math.round(
              (Date.now() - last.getTime()) / 86_400_000
            )
          )
        : 1;
    const dailyKg = (consumed * wp) / days;
    const stockKg = counted * wp;
    let depl: string | null = null;
    if (dailyKg > 0 && stockKg > 0) {
      const daysLeft = Math.floor(stockKg / dailyKg);
      const d = new Date(Date.now() + daysLeft * 86_400_000);
      depl = d.toLocaleDateString("fr-FR");
    }
    return {
      prevBags: prevBagsRaw,
      consumed,
      dailyKg,
      depl
    };
  }, [selected, tab, bagsCounted, weightOverride]);

  const mut = useMutation({
    mutationFn: () => {
      if (newMode) {
        const wpb = Number.parseFloat(newWeightBag.replace(",", "."));
        return postFarmFeedMovement(
          accessToken,
          farmId,
          {
            kind: tab,
            newFeedType: {
              name: newName.trim(),
              unit: newUnit,
              weightPerBagKg: Number.isFinite(wpb) ? wpb : undefined
            },
            ...(tab === "in"
              ? {
                  quantityInput: Number.parseFloat(qty.replace(",", ".")),
                  quantityUnit: qtyUnit,
                  weightPerBagKg: Number.parseFloat(weightOverride.replace(",", ".")) || undefined,
                  supplier: supplier.trim() || undefined,
                  unitPrice: unitPrice.trim()
                    ? Number.parseFloat(unitPrice.replace(",", "."))
                    : undefined,
                  priceBasis,
                  notes: notes.trim() || undefined,
                  occurredAt: `${occurredAt}T12:00:00.000Z`
                }
              : {
                  bagsCounted: Number.parseFloat(bagsCounted.replace(",", ".")),
                  notes: notes.trim() || undefined,
                  occurredAt: new Date().toISOString()
                })
          },
          activeProfileId
        );
      }
      if (!feedTypeId) {
        return Promise.reject(new Error(t("feedStock.errors.pickType")));
      }
      return postFarmFeedMovement(
        accessToken,
        farmId,
        {
          kind: tab,
          feedTypeId,
          ...(tab === "in"
            ? {
                quantityInput: Number.parseFloat(qty.replace(",", ".")),
                quantityUnit: qtyUnit,
                weightPerBagKg: Number.parseFloat(weightOverride.replace(",", ".")) || undefined,
                supplier: supplier.trim() || undefined,
                unitPrice: unitPrice.trim()
                  ? Number.parseFloat(unitPrice.replace(",", "."))
                  : undefined,
                priceBasis,
                notes: notes.trim() || undefined,
                occurredAt: `${occurredAt}T12:00:00.000Z`
              }
            : {
                bagsCounted: Number.parseFloat(bagsCounted.replace(",", ".")),
                notes: notes.trim() || undefined,
                occurredAt: new Date().toISOString()
              })
        },
        activeProfileId
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["farmFeed", farmId] });
      onSuccess();
      onClose();
    }
  });

  const canSubmit =
    newMode
      ? newName.trim().length > 0 &&
        (tab === "in"
          ? qty.trim().length > 0
          : bagsCounted.trim().length > 0)
      : feedTypeId &&
        (tab === "in"
          ? qty.trim().length > 0
          : bagsCounted.trim().length > 0);

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("feedStock.modalTitle")}
      sheetMaxHeight="92%"
      footerPrimary={
        <View style={styles.footerRow}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.link}>{t("feedStock.cancel")}</Text>
          </Pressable>
          <Pressable
            style={styles.primaryBtn}
            disabled={!canSubmit || mut.isPending}
            onPress={() => mut.mutate()}
          >
            {mut.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryTx}>{t("feedStock.confirm")}</Text>
            )}
          </Pressable>
        </View>
      }
    >
      <View style={styles.rowBtns}>
        <Pressable
          style={[styles.chip, tab === "in" && styles.chipOn]}
          onPress={() => setTab("in")}
        >
          <Text style={styles.chipTx}>{t("feedStock.tabIn")}</Text>
        </Pressable>
        <Pressable
          style={[styles.chip, tab === "stock_check" && styles.chipOn]}
          onPress={() => setTab("stock_check")}
        >
          <Text style={styles.chipTx}>{t("feedStock.tabCheck")}</Text>
        </Pressable>
      </View>

      <Pressable
        style={{ marginVertical: mobileSpacing.sm }}
        onPress={() => setNewMode((v) => !v)}
      >
        <Text style={styles.link}>
          {newMode ? t("feedStock.useExistingType") : t("feedStock.createNewType")}
        </Text>
      </Pressable>

      {newMode ? (
        <>
          <Text style={styles.lab}>{t("feedStock.fieldName")}</Text>
          <TextInput style={styles.input} value={newName} onChangeText={setNewName} />
          <Text style={styles.lab}>{t("feedStock.fieldUnit")}</Text>
          <View style={styles.rowBtns}>
            {(["kg", "tonne", "sac"] as const).map((u) => (
              <Pressable
                key={u}
                style={[styles.chip, newUnit === u && styles.chipOn]}
                onPress={() => setNewUnit(u)}
              >
                <Text style={styles.chipTx}>{u}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.lab}>{t("feedStock.fieldWeightPerBag")}</Text>
          <TextInput
            style={styles.input}
            value={newWeightBag}
            onChangeText={setNewWeightBag}
            keyboardType="decimal-pad"
            placeholder="25"
          />
        </>
      ) : (
        <>
          <Text style={styles.lab}>{t("feedStock.fieldFeedType")}</Text>
          <View style={styles.typeList}>
            {types.map((ft) => (
              <Pressable
                key={ft.id}
                style={[styles.typeChip, feedTypeId === ft.id && styles.typeChipOn]}
                onPress={() => setFeedTypeId(ft.id)}
              >
                <Text style={styles.typeChipTx}>{ft.name}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {tab === "in" ? (
        <>
          <Text style={styles.lab}>{t("feedStock.fieldQty")}</Text>
          <TextInput
            style={styles.input}
            value={qty}
            onChangeText={setQty}
            keyboardType="decimal-pad"
          />
          <Text style={styles.lab}>{t("feedStock.fieldQtyUnit")}</Text>
          <View style={styles.rowBtns}>
            {(["kg", "tonne", "sac"] as const).map((u) => (
              <Pressable
                key={u}
                style={[styles.chip, qtyUnit === u && styles.chipOn]}
                onPress={() => setQtyUnit(u)}
              >
                <Text style={styles.chipTx}>{u}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.lab}>{t("feedStock.fieldWeightOverride")}</Text>
          <TextInput
            style={styles.input}
            value={weightOverride}
            onChangeText={setWeightOverride}
            keyboardType="decimal-pad"
            placeholder={
              selected?.weightPerBagKg
                ? String(selected.weightPerBagKg)
                : "—"
            }
          />
          <Text style={styles.lab}>{t("feedStock.fieldDate")}</Text>
          <TextInput style={styles.input} value={occurredAt} onChangeText={setOccurredAt} />
          <Text style={styles.lab}>{t("feedStock.fieldSupplier")}</Text>
          <TextInput style={styles.input} value={supplier} onChangeText={setSupplier} />
          <Text style={styles.lab}>{t("feedStock.fieldUnitPrice")}</Text>
          <TextInput
            style={styles.input}
            value={unitPrice}
            onChangeText={setUnitPrice}
            keyboardType="decimal-pad"
          />
          <Text style={styles.lab}>{t("feedStock.fieldPriceBasis")}</Text>
          <View style={styles.rowBtns}>
            <Pressable
              style={[styles.chip, priceBasis === "kg" && styles.chipOn]}
              onPress={() => setPriceBasis("kg")}
            >
              <Text style={styles.chipTx}>kg</Text>
            </Pressable>
            <Pressable
              style={[styles.chip, priceBasis === "sac" && styles.chipOn]}
              onPress={() => setPriceBasis("sac")}
            >
              <Text style={styles.chipTx}>{t("feedStock.sac")}</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.lab}>{t("feedStock.fieldBagsCounted")}</Text>
          <TextInput
            style={styles.input}
            value={bagsCounted}
            onChangeText={setBagsCounted}
            keyboardType="decimal-pad"
          />
          {preview ? (
            <View style={styles.previewBox}>
              <Text style={styles.previewLine}>
                {t("feedStock.previewPrevBags", { n: preview.prevBags.toFixed(1) })}
              </Text>
              <Text style={styles.previewLine}>
                {t("feedStock.previewConsumed", { n: preview.consumed.toFixed(1) })}
              </Text>
              <Text style={styles.previewLine}>
                {t("feedStock.previewDaily", {
                  n: preview.dailyKg.toLocaleString("fr-FR", { maximumFractionDigits: 2 })
                })}
              </Text>
              {preview.depl ? (
                <Text style={styles.previewLine}>
                  {t("feedStock.previewDepletion", { date: preview.depl })}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.hint}>{t("feedStock.checkHint")}</Text>
          )}
        </>
      )}

      <Text style={styles.lab}>{t("feedStock.fieldNotes")}</Text>
      <TextInput
        style={[styles.input, { minHeight: 72 }]}
        value={notes}
        onChangeText={setNotes}
        multiline
      />
      {mut.error ? (
        <Text style={styles.err}>
          {mut.error instanceof Error ? mut.error.message : String(mut.error)}
        </Text>
      ) : null}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  rowBtns: { flexDirection: "row", gap: mobileSpacing.sm, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.surfaceMuted
  },
  chipOn: { backgroundColor: mobileColors.accentSoft },
  chipTx: { fontWeight: "700", color: mobileColors.textPrimary },
  lab: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.sm,
    padding: mobileSpacing.md,
    marginTop: mobileSpacing.xs,
    color: mobileColors.textPrimary
  },
  typeList: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.sm },
  typeChip: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  typeChipOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  typeChipTx: { fontWeight: "600", color: mobileColors.textPrimary },
  previewBox: {
    marginTop: mobileSpacing.sm,
    padding: mobileSpacing.md,
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.md
  },
  previewLine: { ...mobileTypography.body, marginBottom: 4 },
  hint: { ...mobileTypography.meta, color: mobileColors.textSecondary, marginTop: 8 },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%"
  },
  link: { color: mobileColors.accent, fontWeight: "700" },
  primaryBtn: {
    backgroundColor: mobileColors.accent,
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.md
  },
  primaryTx: { color: "#fff", fontWeight: "800" },
  err: { color: mobileColors.error, marginTop: mobileSpacing.sm }
});
