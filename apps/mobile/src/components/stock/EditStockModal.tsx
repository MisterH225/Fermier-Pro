import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { AppDatePicker } from "../common/AppDatePicker";
import { BaseModal } from "../modals/BaseModal";
import { ModalSection } from "../modals/ModalSection";
import { useModal } from "../modals/useModal";
import type { FeedStockMovementDto, FeedTypeDto } from "../../lib/api";
import {
  deleteFarmFeedMovement,
  patchFarmFeedMovement,
  type PostFarmFeedMovementResponse
} from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { getUserFacingError } from "../../lib/userFacingError";

type Props = {
  visible: boolean;
  onClose: () => void;
  movement: FeedStockMovementDto;
  types: FeedTypeDto[];
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  onSaved: (result: PostFarmFeedMovementResponse) => void;
};

export function EditStockModal({
  visible,
  onClose,
  movement,
  types,
  farmId,
  accessToken,
  activeProfileId,
  onSaved
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { open } = useModal();

  const [feedTypeId, setFeedTypeId] = useState(movement.feedTypeId);
  const [qty, setQty] = useState("");
  const [qtyUnit, setQtyUnit] = useState<"kg" | "tonne" | "sac">("kg");
  const [occurredAt, setOccurredAt] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!visible) {
      return;
    }
    setFeedTypeId(movement.feedTypeId);
    const kg = Number.parseFloat(movement.quantityKg ?? "0");
    const unit = movement.feedType.unit as "kg" | "tonne" | "sac";
    setQtyUnit(unit === "tonne" ? "tonne" : unit === "sac" ? "sac" : "kg");
    setQty(String(kg || ""));
    setOccurredAt(movement.occurredAt.slice(0, 10));
    setTotalCost(movement.totalCost ?? "");
    setUnitPrice(movement.unitPrice ?? "");
    setSupplier(movement.supplier ?? "");
    setNotes(movement.notes ?? "");
  }, [visible, movement]);

  const unitPricePreview = useMemo(() => {
    const cost = Number.parseFloat(totalCost.replace(",", "."));
    const kg = Number.parseFloat(qty.replace(",", "."));
    if (!Number.isFinite(cost) || !Number.isFinite(kg) || kg <= 0) {
      return null;
    }
    return (cost / kg).toFixed(2);
  }, [totalCost, qty]);

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = {
        feedTypeId,
        quantityInput: Number.parseFloat(qty.replace(",", ".")),
        quantityUnit: qtyUnit,
        occurredAt: `${occurredAt}T12:00:00.000Z`,
        supplier: supplier.trim() || undefined,
        notes: notes.trim() || undefined,
        totalCost: totalCost.trim()
          ? Number.parseFloat(totalCost.replace(",", "."))
          : undefined,
        unitPrice: unitPrice.trim()
          ? Number.parseFloat(unitPrice.replace(",", "."))
          : undefined
      };
      return patchFarmFeedMovement(
        accessToken,
        farmId,
        movement.id,
        payload,
        activeProfileId
      );
    },
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["farmFeed", farmId] });
      open("success", {
        title: t("feedStock.edit.savedTitle"),
        message: t("feedStock.edit.savedMessage")
      });
      onSaved(res);
      onClose();
    },
    onError: (e: Error) => Alert.alert(t("common.error"), getUserFacingError(e, t))
  });

  const deleteMut = useMutation({
    mutationFn: () =>
      deleteFarmFeedMovement(accessToken, farmId, movement.id, activeProfileId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["farmFeed", farmId] });
      onClose();
    },
    onError: (e: Error) => Alert.alert(t("common.error"), getUserFacingError(e, t))
  });

  const confirmDelete = () => {
    Alert.alert(
      t("feedStock.edit.deleteTitle"),
      t("feedStock.edit.deleteMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => deleteMut.mutate()
        }
      ]
    );
  };

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("feedStock.edit.title")}
      sheetMaxHeight="92%"
      footerPrimary={
        <Pressable
          style={styles.primaryBtn}
          disabled={saveMut.isPending}
          onPress={() => saveMut.mutate()}
        >
          {saveMut.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryTx}>{t("feedStock.confirm")}</Text>
          )}
        </Pressable>
      }
    >
      {movement.linkedExpenseId ? (
        <View style={styles.warnBox}>
          <Text style={styles.warnTx}>{t("feedStock.edit.linkedWarning")}</Text>
        </View>
      ) : null}

      <ModalSection title={t("feedStock.sectionType")} plain>
        <View style={styles.pillRow}>
          {types.map((ft) => (
            <Pressable
              key={ft.id}
              style={[styles.pill, feedTypeId === ft.id && styles.pillOn]}
              onPress={() => setFeedTypeId(ft.id)}
            >
              <Text
                style={[
                  styles.pillTx,
                  feedTypeId === ft.id && styles.pillTxOn
                ]}
              >
                {ft.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </ModalSection>

      <ModalSection title={t("feedStock.fieldQuantity")} plain>
        <TextInput style={styles.input} value={qty} onChangeText={setQty} keyboardType="decimal-pad" />
        <View style={styles.pillRow}>
          {(["kg", "sac", "tonne"] as const).map((u) => (
            <Pressable
              key={u}
              style={[styles.pill, qtyUnit === u && styles.pillOn]}
              onPress={() => setQtyUnit(u)}
            >
              <Text style={[styles.pillTx, qtyUnit === u && styles.pillTxOn]}>
                {u}
              </Text>
            </Pressable>
          ))}
        </View>
      </ModalSection>

      <AppDatePicker
        label={t("feedStock.fieldDate")}
        isoValue={occurredAt}
        onIsoChange={setOccurredAt}
        farmId={farmId}
        maxDate={new Date()}
      />

      <ModalSection title={t("feedStock.edit.costSection")} plain>
        <Text style={styles.helper}>{t("feedStock.edit.costHelper")}</Text>
        <TextInput
          style={styles.input}
          value={totalCost}
          onChangeText={setTotalCost}
          keyboardType="decimal-pad"
          placeholder={t("feedStock.edit.totalCostPh")}
        />
        <TextInput
          style={styles.input}
          value={unitPrice}
          onChangeText={setUnitPrice}
          keyboardType="decimal-pad"
          placeholder={t("feedStock.edit.unitPricePh")}
        />
        {unitPricePreview ? (
          <Text style={styles.preview}>
            {t("feedStock.edit.calculatedPerKg", { price: unitPricePreview })}
          </Text>
        ) : null}
      </ModalSection>

      <TextInput
        style={styles.input}
        value={supplier}
        onChangeText={setSupplier}
        placeholder={t("feedStock.fieldSupplier")}
      />
      <TextInput
        style={[styles.input, styles.notes]}
        value={notes}
        onChangeText={setNotes}
        placeholder={t("feedStock.fieldNotes")}
        multiline
      />

      <Pressable onPress={confirmDelete} style={styles.deleteBtn}>
        <Text style={styles.deleteTx}>{t("feedStock.edit.deleteBtn")}</Text>
      </Pressable>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  warnBox: {
    backgroundColor: "rgba(230,126,34,0.12)",
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.md
  },
  warnTx: { ...mobileTypography.meta, color: "#B45309" },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.sm
  },
  pill: {
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.surfaceMuted
  },
  pillOn: { backgroundColor: mobileColors.accent },
  pillTx: { ...mobileTypography.meta, color: mobileColors.textPrimary },
  pillTxOn: { color: "#fff", fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.sm,
    ...mobileTypography.body
  },
  notes: { minHeight: 72, textAlignVertical: "top" },
  helper: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.xs
  },
  preview: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    fontWeight: "700"
  },
  primaryBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    paddingVertical: mobileSpacing.md,
    alignItems: "center"
  },
  primaryTx: { color: "#fff", fontWeight: "700" },
  deleteBtn: { marginTop: mobileSpacing.lg, paddingVertical: mobileSpacing.md },
  deleteTx: {
    ...mobileTypography.body,
    color: mobileColors.error,
    textAlign: "center",
    fontWeight: "600"
  }
});
