import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import {
  createBuyerPriceAlert,
  type CreateBuyerPriceAlertBody
} from "../../lib/api";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { buyerColors, buyerRadius } from "../../theme/buyerTheme";
import { BaseModal } from "../modals/BaseModal";
import { ModalSection } from "../modals/ModalSection";

type Props = {
  visible: boolean;
  accessToken: string;
  activeProfileId?: string | null;
  onClose: () => void;
  onCreated: () => void;
};

const CATEGORIES = [
  { key: "piglet", labelKey: "buyerOnboarding.cat.piglet" },
  { key: "breeder", labelKey: "buyerOnboarding.cat.breeder_female" },
  { key: "butcher", labelKey: "buyerOnboarding.cat.butcher" },
  { key: "reformed", labelKey: "buyerOnboarding.cat.reformed" }
] as const;

const FREQUENCIES = ["immediate", "daily"] as const;

export function CreatePriceAlertModal({
  visible,
  accessToken,
  activeProfileId,
  onClose,
  onCreated
}: Props) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<string>("piglet");
  const [maxPrice, setMaxPrice] = useState("");
  const [minWeight, setMinWeight] = useState("");
  const [radius, setRadius] = useState("");
  const [frequency, setFrequency] =
    useState<(typeof FREQUENCIES)[number]>("immediate");

  const reset = () => {
    setCategory("piglet");
    setMaxPrice("");
    setMinWeight("");
    setRadius("");
    setFrequency("immediate");
  };

  const createMut = useMutation({
    mutationFn: () => {
      const maxPricePerKg = Number(maxPrice.replace(",", "."));
      if (!Number.isFinite(maxPricePerKg) || maxPricePerKg <= 0) {
        throw new Error(t("buyer.alerts.invalidPrice"));
      }
      const body: CreateBuyerPriceAlertBody = {
        animalCategory: category,
        maxPricePerKg,
        notificationFrequency: frequency
      };
      const minW = minWeight.trim()
        ? Number(minWeight.replace(",", "."))
        : undefined;
      if (minW != null) {
        if (!Number.isFinite(minW) || minW <= 0) {
          throw new Error(t("buyer.alerts.invalidWeight"));
        }
        body.minWeightKg = minW;
      }
      const r = radius.trim() ? Number(radius.replace(",", ".")) : undefined;
      if (r != null) {
        if (!Number.isFinite(r) || r <= 0) {
          throw new Error(t("buyer.alerts.invalidRadius"));
        }
        body.radiusKm = Math.round(r);
      }
      return createBuyerPriceAlert(accessToken, activeProfileId, body);
    },
    onSuccess: () => {
      reset();
      onCreated();
      onClose();
    },
    onError: (e: Error) => Alert.alert(t("buyer.alerts.errorTitle"), e.message)
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <BaseModal
      visible={visible}
      onClose={handleClose}
      title={t("buyer.alerts.createTitle")}
      footerPrimary={
        <Pressable
          style={[styles.saveBtn, createMut.isPending && styles.saveDisabled]}
          disabled={createMut.isPending || !maxPrice.trim()}
          onPress={() => createMut.mutate()}
        >
          <Text style={styles.saveTx}>{t("buyer.alerts.createCta")}</Text>
        </Pressable>
      }
    >
      <ModalSection title={t("buyer.alerts.fieldCategory")}>
        <View style={styles.row}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c.key}
              style={[styles.chip, category === c.key && styles.chipOn]}
              onPress={() => setCategory(c.key)}
            >
              <Text style={styles.chipTx}>{t(c.labelKey)}</Text>
            </Pressable>
          ))}
        </View>
      </ModalSection>

      <ModalSection title={t("buyer.alerts.sectionCriteria")}>
        <Text style={styles.lab}>{t("buyer.alerts.fieldMaxPrice")}</Text>
        <TextInput
          style={styles.input}
          value={maxPrice}
          onChangeText={setMaxPrice}
          keyboardType="decimal-pad"
          placeholder="1500"
          placeholderTextColor={buyerColors.textMuted}
        />
        <Text style={styles.lab}>{t("buyer.alerts.fieldMinWeight")}</Text>
        <TextInput
          style={styles.input}
          value={minWeight}
          onChangeText={setMinWeight}
          keyboardType="decimal-pad"
          placeholder={t("buyer.alerts.optional")}
          placeholderTextColor={buyerColors.textMuted}
        />
      </ModalSection>

      <ModalSection title={t("buyer.alerts.sectionZone")}>
        <Text style={styles.lab}>{t("buyer.alerts.fieldRadius")}</Text>
        <TextInput
          style={styles.input}
          value={radius}
          onChangeText={setRadius}
          keyboardType="number-pad"
          placeholder={t("buyer.alerts.optional")}
          placeholderTextColor={buyerColors.textMuted}
        />
      </ModalSection>

      <ModalSection title={t("buyer.alerts.fieldFrequency")}>
        <View style={styles.row}>
          {FREQUENCIES.map((f) => (
            <Pressable
              key={f}
              style={[styles.chip, frequency === f && styles.chipOn]}
              onPress={() => setFrequency(f)}
            >
              <Text style={styles.chipTx}>{t(`buyer.alerts.freq.${f}`)}</Text>
            </Pressable>
          ))}
        </View>
      </ModalSection>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  lab: {
    ...mobileTypography.meta,
    color: buyerColors.textSecondary,
    marginBottom: 4,
    marginTop: mobileSpacing.xs
  },
  input: {
    borderWidth: 1,
    borderColor: buyerColors.border,
    borderRadius: buyerRadius.button,
    padding: mobileSpacing.sm,
    color: buyerColors.textPrimary,
    backgroundColor: buyerColors.canvas
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.xs },
  chip: {
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 6,
    borderRadius: buyerRadius.pill,
    borderWidth: 1,
    borderColor: buyerColors.border,
    backgroundColor: buyerColors.cardBg
  },
  chipOn: {
    borderColor: buyerColors.primary,
    backgroundColor: `${buyerColors.primary}14`
  },
  chipTx: { fontSize: 12, color: buyerColors.textPrimary },
  saveBtn: {
    backgroundColor: buyerColors.primary,
    padding: mobileSpacing.md,
    borderRadius: buyerRadius.button,
    alignItems: "center"
  },
  saveDisabled: { opacity: 0.5 },
  saveTx: { color: "#fff", fontWeight: "700" }
});
