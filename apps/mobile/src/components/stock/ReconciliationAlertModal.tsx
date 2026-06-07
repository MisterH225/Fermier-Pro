import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { BaseModal } from "../modals/BaseModal";
import { useModal } from "../modals/useModal";
import type { ReconciliationOfferDto } from "../../lib/api";
import {
  dismissFeedReconciliation,
  reconcileFeedMovement,
  rejectFeedReconciliation
} from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  visible: boolean;
  onClose: () => void;
  offer: ReconciliationOfferDto;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  onDone: () => void;
};

export function ReconciliationAlertModal({
  visible,
  onClose,
  offer,
  farmId,
  accessToken,
  activeProfileId,
  onDone
}: Props) {
  const { t } = useTranslation();
  const { open } = useModal();
  const movementId = offer.movementId ?? offer.stock?.movementId ?? "";
  const [selectedExpenseId, setSelectedExpenseId] = useState(
    offer.expenseId ?? offer.candidates?.[0]?.expenseId ?? ""
  );
  const [step, setStep] = useState<"match" | "followup">("match");
  const [followCost, setFollowCost] = useState("");
  const [followSupplier, setFollowSupplier] = useState("");

  const mergeMut = useMutation({
    mutationFn: () =>
      reconcileFeedMovement(
        accessToken,
        farmId,
        movementId,
        selectedExpenseId,
        activeProfileId
      ),
    onSuccess: (res) => {
      open("success", {
        title: t("feedStock.reconciliation.mergeTitle"),
        message: t("feedStock.reconciliation.mergeMessage", {
          price: res.unitPricePerKg.toFixed(2),
          currency: res.currency
        })
      });
      onDone();
      onClose();
    }
  });

  const rejectMut = useMutation({
    mutationFn: () =>
      rejectFeedReconciliation(
        accessToken,
        farmId,
        movementId,
        { expenseId: selectedExpenseId },
        activeProfileId
      ),
    onSuccess: () => setStep("followup")
  });

  const saveFollowMut = useMutation({
    mutationFn: () =>
      rejectFeedReconciliation(
        accessToken,
        farmId,
        movementId,
        {
          expenseId: selectedExpenseId,
          totalCost: Number.parseFloat(followCost.replace(",", ".")),
          supplier: followSupplier.trim() || undefined
        },
        activeProfileId
      ),
    onSuccess: () => {
      onDone();
      onClose();
    }
  });

  const dismissMut = useMutation({
    mutationFn: () =>
      dismissFeedReconciliation(
        accessToken,
        farmId,
        movementId,
        activeProfileId
      ),
    onSuccess: () => {
      onDone();
      onClose();
    }
  });

  const finance =
    offer.finance ??
    offer.candidates?.find((c) => c.expenseId === selectedExpenseId);

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("feedStock.reconciliation.title")}
      sheetMaxHeight="90%"
    >
      {step === "match" ? (
        <View style={styles.wrap}>
          <Text style={styles.subtitle}>
            {t("feedStock.reconciliation.subtitle")}
          </Text>

          {offer.stock ? (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>
                {t("feedStock.reconciliation.stockCard")}
              </Text>
              <Text style={styles.cardTx}>
                {offer.stock.quantityKg} kg — {offer.stock.feedTypeName}
              </Text>
              <Text style={styles.cardMeta}>
                {new Date(offer.stock.occurredAt).toLocaleDateString("fr-FR")}
              </Text>
            </View>
          ) : null}

          {offer.status === "multiple" && offer.candidates ? (
            <ScrollView style={styles.candScroll}>
              {offer.candidates.map((c) => (
                <Pressable
                  key={c.expenseId}
                  style={[
                    styles.card,
                    selectedExpenseId === c.expenseId && styles.cardOn
                  ]}
                  onPress={() => setSelectedExpenseId(c.expenseId)}
                >
                  <Text style={styles.cardTx}>{c.label}</Text>
                  <Text style={styles.cardMeta}>
                    {c.amount} {c.currency} · ±{c.daysDelta}j
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : finance ? (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>
                {t("feedStock.reconciliation.financeCard")}
              </Text>
              <Text style={styles.cardTx}>{finance.label}</Text>
              <Text style={styles.cardMeta}>
                {finance.amount} {finance.currency}
              </Text>
            </View>
          ) : null}

          {offer.calculatedUnitPricePerKg != null ? (
            <View style={styles.pricePill}>
              <Text style={styles.pricePillTx}>
                {t("feedStock.reconciliation.pricePerKg", {
                  price: offer.calculatedUnitPricePerKg.toFixed(2),
                  currency: offer.currency ?? "XOF"
                })}
              </Text>
            </View>
          ) : null}

          <Pressable
            style={styles.primaryBtn}
            disabled={!selectedExpenseId || mergeMut.isPending}
            onPress={() => mergeMut.mutate()}
          >
            {mergeMut.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryTx}>
                {t("feedStock.reconciliation.mergeBtn")}
              </Text>
            )}
          </Pressable>

          <Pressable
            style={styles.secondaryBtn}
            disabled={rejectMut.isPending}
            onPress={() => rejectMut.mutate()}
          >
            <Text style={styles.secondaryTx}>
              {t("feedStock.reconciliation.rejectBtn")}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => dismissMut.mutate()}
            disabled={dismissMut.isPending}
          >
            <Text style={styles.mutedTx}>
              {t("feedStock.reconciliation.laterBtn")}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.wrap}>
          <Text style={styles.subtitle}>
            {t("feedStock.reconciliation.followTitle")}
          </Text>
          <Text style={styles.helper}>
            {t("feedStock.reconciliation.followMessage")}
          </Text>
          <TextInput
            style={styles.input}
            value={followCost}
            onChangeText={setFollowCost}
            keyboardType="decimal-pad"
            placeholder={t("feedStock.edit.totalCostPh")}
          />
          <TextInput
            style={styles.input}
            value={followSupplier}
            onChangeText={setFollowSupplier}
            placeholder={t("feedStock.fieldSupplier")}
          />
          <Pressable
            style={styles.primaryBtn}
            disabled={!followCost.trim() || saveFollowMut.isPending}
            onPress={() => saveFollowMut.mutate()}
          >
            <Text style={styles.primaryTx}>{t("common.save")}</Text>
          </Pressable>
          <Pressable onPress={() => dismissMut.mutate()}>
            <Text style={styles.mutedTx}>
              {t("feedStock.reconciliation.skipBtn")}
            </Text>
          </Pressable>
        </View>
      )}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.md },
  subtitle: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    textAlign: "center"
  },
  helper: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  card: {
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    gap: mobileSpacing.xs
  },
  cardOn: { borderWidth: 2, borderColor: mobileColors.accent },
  cardLabel: {
    ...mobileTypography.meta,
    fontWeight: "700",
    color: mobileColors.textSecondary
  },
  cardTx: { ...mobileTypography.body, fontWeight: "600" },
  cardMeta: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  candScroll: { maxHeight: 200 },
  pricePill: {
    alignSelf: "center",
    backgroundColor: "rgba(45,106,79,0.12)",
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.pill
  },
  pricePillTx: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.accent
  },
  primaryBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    paddingVertical: mobileSpacing.md,
    alignItems: "center"
  },
  primaryTx: { color: "#fff", fontWeight: "700" },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingVertical: mobileSpacing.md,
    alignItems: "center"
  },
  secondaryTx: { ...mobileTypography.body, fontWeight: "600" },
  mutedTx: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textAlign: "center"
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    ...mobileTypography.body
  }
});
