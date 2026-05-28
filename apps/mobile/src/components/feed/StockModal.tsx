import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { BaseModal } from "../modals/BaseModal";
import { ModalSection } from "../modals/ModalSection";
import type { FeedTypeDto } from "../../lib/api";
import { postFarmFeedMovement, type PostFarmFeedMovementPayload } from "../../lib/api";
import {
  offlineQueuedMessage,
  useOfflineMutation
} from "../../hooks/useOfflineMutation";
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
  defaultTab?: "in" | "stock_check";
  onSuccess: () => void;
};

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

export function StockModal({
  visible,
  onClose,
  farmId,
  accessToken,
  activeProfileId,
  types,
  defaultTab = "in",
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
      setTab(defaultTab);
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
  }, [visible, types, defaultTab]);

  const selected = useMemo(
    () => types.find((x) => x.id === feedTypeId),
    [types, feedTypeId]
  );

  const preview = useMemo(() => {
    if (!selected || tab !== "stock_check") {
      return null;
    }
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
            Math.round((Date.now() - last.getTime()) / 86_400_000)
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

  const buildMovementPayload = (): PostFarmFeedMovementPayload => {
    if (newMode) {
      const wpb = Number.parseFloat(newWeightBag.replace(",", "."));
      return {
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
              weightPerBagKg:
                Number.parseFloat(weightOverride.replace(",", ".")) || undefined,
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
      };
    }
    if (!feedTypeId) {
      throw new Error(t("feedStock.errors.pickType"));
    }
    return {
      kind: tab,
      feedTypeId,
      ...(tab === "in"
        ? {
            quantityInput: Number.parseFloat(qty.replace(",", ".")),
            quantityUnit: qtyUnit,
            weightPerBagKg:
              Number.parseFloat(weightOverride.replace(",", ".")) || undefined,
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
    };
  };

  const mut = useOfflineMutation({
    farmId,
    type: "feed.movement",
    label: t("feedStock.modalTitle"),
    mutationFn: async () =>
      postFarmFeedMovement(
        accessToken,
        farmId,
        buildMovementPayload(),
        activeProfileId
      ),
    buildOfflineItem: () => ({
      calls: [
        {
          method: "POST",
          path: `/farms/${farmId}/feed/movements`,
          body: buildMovementPayload()
        }
      ],
      invalidateRoots: ["farmFeed", "dashboardFeedStock"]
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["farmFeed", farmId] });
      onSuccess();
      onClose();
    },
    onQueued: () => {
      void qc.invalidateQueries({ queryKey: ["farmFeed", farmId] });
      onSuccess();
      onClose();
      Alert.alert("", offlineQueuedMessage(t));
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
      <ModalSection title={t("feedStock.sectionOperation")} plain>
        <View style={styles.rowBtns}>
          <Pressable
            style={[styles.chip, tab === "in" && styles.chipOn]}
            onPress={() => setTab("in")}
          >
            <Text style={[styles.chipTx, tab === "in" && styles.chipTxOn]}>
              {t("feedStock.tabIn")}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.chip, tab === "stock_check" && styles.chipOn]}
            onPress={() => setTab("stock_check")}
          >
            <Text
              style={[
                styles.chipTx,
                tab === "stock_check" && styles.chipTxOn
              ]}
            >
              {t("feedStock.tabCheck")}
            </Text>
          </Pressable>
        </View>
      </ModalSection>

      <ModalSection title={t("modals.sections.identification")}>
        <Pressable onPress={() => setNewMode((v) => !v)}>
          <Text style={styles.link}>
            {newMode
              ? t("feedStock.useExistingType")
              : t("feedStock.createNewType")}
          </Text>
        </Pressable>
        {newMode ? (
          <View style={styles.fields}>
            <FieldLabel>{t("feedStock.fieldName")}</FieldLabel>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
            />
            <FieldLabel>{t("feedStock.fieldUnit")}</FieldLabel>
            <View style={styles.rowBtns}>
              {(["kg", "tonne", "sac"] as const).map((u) => (
                <Pressable
                  key={u}
                  style={[styles.chip, newUnit === u && styles.chipOn]}
                  onPress={() => setNewUnit(u)}
                >
                  <Text style={[styles.chipTx, newUnit === u && styles.chipTxOn]}>
                    {u}
                  </Text>
                </Pressable>
              ))}
            </View>
            <FieldLabel>{t("feedStock.fieldWeightPerBag")}</FieldLabel>
            <TextInput
              style={styles.input}
              value={newWeightBag}
              onChangeText={setNewWeightBag}
              keyboardType="decimal-pad"
              placeholder="25"
            />
          </View>
        ) : (
          <View style={styles.fields}>
            <FieldLabel>{t("feedStock.fieldFeedType")}</FieldLabel>
            <View style={styles.typeList}>
              {types.map((ft) => (
                <Pressable
                  key={ft.id}
                  style={[
                    styles.typeChip,
                    feedTypeId === ft.id && styles.typeChipOn
                  ]}
                  onPress={() => setFeedTypeId(ft.id)}
                >
                  <Text
                    style={[
                      styles.typeChipTx,
                      feedTypeId === ft.id && styles.typeChipTxOn
                    ]}
                  >
                    {ft.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ModalSection>

      {tab === "in" ? (
        <ModalSection title={t("modals.sections.details")}>
          <View style={styles.fields}>
            <FieldLabel>{t("feedStock.fieldQty")}</FieldLabel>
            <TextInput
              style={styles.input}
              value={qty}
              onChangeText={setQty}
              keyboardType="decimal-pad"
            />
            <FieldLabel>{t("feedStock.fieldQtyUnit")}</FieldLabel>
            <View style={styles.rowBtns}>
              {(["kg", "tonne", "sac"] as const).map((u) => (
                <Pressable
                  key={u}
                  style={[styles.chip, qtyUnit === u && styles.chipOn]}
                  onPress={() => setQtyUnit(u)}
                >
                  <Text style={[styles.chipTx, qtyUnit === u && styles.chipTxOn]}>
                    {u}
                  </Text>
                </Pressable>
              ))}
            </View>
            <FieldLabel>{t("feedStock.fieldWeightOverride")}</FieldLabel>
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
            <FieldLabel>{t("feedStock.fieldDate")}</FieldLabel>
            <TextInput
              style={styles.input}
              value={occurredAt}
              onChangeText={setOccurredAt}
            />
            <FieldLabel>{t("feedStock.fieldSupplier")}</FieldLabel>
            <TextInput
              style={styles.input}
              value={supplier}
              onChangeText={setSupplier}
            />
            <FieldLabel>{t("feedStock.fieldUnitPrice")}</FieldLabel>
            <TextInput
              style={styles.input}
              value={unitPrice}
              onChangeText={setUnitPrice}
              keyboardType="decimal-pad"
            />
            <FieldLabel>{t("feedStock.fieldPriceBasis")}</FieldLabel>
            <View style={styles.rowBtns}>
              <Pressable
                style={[styles.chip, priceBasis === "kg" && styles.chipOn]}
                onPress={() => setPriceBasis("kg")}
              >
                <Text
                  style={[
                    styles.chipTx,
                    priceBasis === "kg" && styles.chipTxOn
                  ]}
                >
                  kg
                </Text>
              </Pressable>
              <Pressable
                style={[styles.chip, priceBasis === "sac" && styles.chipOn]}
                onPress={() => setPriceBasis("sac")}
              >
                <Text
                  style={[
                    styles.chipTx,
                    priceBasis === "sac" && styles.chipTxOn
                  ]}
                >
                  {t("feedStock.sac")}
                </Text>
              </Pressable>
            </View>
          </View>
        </ModalSection>
      ) : (
        <ModalSection title={t("modals.sections.measurement")}>
          <View style={styles.fields}>
            <FieldLabel>{t("feedStock.fieldBagsCounted")}</FieldLabel>
            <TextInput
              style={styles.input}
              value={bagsCounted}
              onChangeText={setBagsCounted}
              keyboardType="decimal-pad"
            />
            {preview ? (
              <View style={styles.previewBox}>
                <Text style={styles.previewLine}>
                  {t("feedStock.previewPrevBags", {
                    n: preview.prevBags.toFixed(1)
                  })}
                </Text>
                <Text style={styles.previewLine}>
                  {t("feedStock.previewConsumed", {
                    n: preview.consumed.toFixed(1)
                  })}
                </Text>
                <Text style={styles.previewLine}>
                  {t("feedStock.previewDaily", {
                    n: preview.dailyKg.toLocaleString("fr-FR", {
                      maximumFractionDigits: 2
                    })
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
          </View>
        </ModalSection>
      )}

      <ModalSection title={t("modals.sections.note")}>
        <View style={styles.fields}>
          <FieldLabel>{t("feedStock.fieldNotes")}</FieldLabel>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
          {mut.error ? (
            <Text style={styles.err}>
              {mut.error instanceof Error
                ? mut.error.message
                : String(mut.error)}
            </Text>
          ) : null}
        </View>
      </ModalSection>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  fields: {
    gap: mobileSpacing.sm
  },
  rowBtns: {
    flexDirection: "row",
    gap: mobileSpacing.sm,
    flexWrap: "wrap"
  },
  chip: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.surfaceMuted
  },
  chipOn: { backgroundColor: mobileColors.accent },
  chipTx: { fontWeight: "700", color: mobileColors.textPrimary },
  chipTxOn: { color: "#fff" },
  fieldLabel: {
    ...mobileTypography.meta,
    fontSize: 13,
    fontWeight: "600",
    color: mobileColors.textSecondary
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.sm,
    padding: mobileSpacing.md,
    color: mobileColors.textPrimary,
    backgroundColor: mobileColors.background
  },
  notesInput: { minHeight: 72, textAlignVertical: "top" },
  typeList: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.sm },
  typeChip: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.background
  },
  typeChipOn: {
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.accentSoft
  },
  typeChipTx: { fontWeight: "600", color: mobileColors.textPrimary },
  typeChipTxOn: { color: mobileColors.accent, fontWeight: "700" },
  previewBox: {
    padding: mobileSpacing.md,
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.md,
    gap: 4
  },
  previewLine: { ...mobileTypography.body, color: mobileColors.textPrimary },
  hint: { ...mobileTypography.meta, color: mobileColors.textSecondary },
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
  err: { color: mobileColors.error }
});
