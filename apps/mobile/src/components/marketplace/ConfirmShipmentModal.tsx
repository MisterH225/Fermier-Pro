import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { AppDatePicker } from "../common/AppDatePicker";
import { BaseModal } from "../modals/BaseModal";
import { PrimaryButton } from "../ui/PrimaryButton";
import { mobileColors, mobileSpacing, mobileTypography, mobileRadius } from "../../theme/mobileTheme";

type ShipmentMethod = "handover" | "third_party" | "seller_delivery";

type Props = {
  visible: boolean;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    shippedAt: string;
    method?: ShipmentMethod;
    notes?: string;
  }) => void;
};

const METHODS: ShipmentMethod[] = ["handover", "third_party", "seller_delivery"];

export function ConfirmShipmentModal({
  visible,
  submitting,
  onClose,
  onConfirm
}: Props) {
  const { t } = useTranslation();
  const [shippedAt, setShippedAt] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<ShipmentMethod>("handover");
  const [notes, setNotes] = useState("");

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("marketScreen.shipmentModal.title")}
      footerPrimary={
        <PrimaryButton
          label={t("marketScreen.shipmentModal.confirm")}
          onPress={() =>
            onConfirm({
              shippedAt,
              method,
              notes: notes.trim() || undefined
            })
          }
          loading={submitting}
          disabled={!shippedAt.trim()}
        />
      }
    >
      <Text style={styles.info}>{t("marketScreen.shipmentModal.info")}</Text>
      <AppDatePicker
        label={t("marketScreen.shipmentModal.date")}
        mode="date"
        presentation="inline"
        isoValue={shippedAt}
        onIsoChange={setShippedAt}
      />
      <Text style={styles.label}>{t("marketScreen.shipmentModal.method")}</Text>
      <View style={styles.methodRow}>
        {METHODS.map((m) => (
          <Text
            key={m}
            style={[styles.methodChip, method === m && styles.methodChipOn]}
            onPress={() => setMethod(m)}
          >
            {t(`marketScreen.shipmentModal.methods.${m}`)}
          </Text>
        ))}
      </View>
      <Text style={styles.label}>{t("marketScreen.shipmentModal.notes")}</Text>
      <TextInput
        style={styles.input}
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder={t("marketScreen.shipmentModal.notesPh")}
      />
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  info: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.md
  },
  label: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm,
    marginBottom: 4
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.sm,
    padding: mobileSpacing.md,
    minHeight: 80,
    textAlignVertical: "top"
  },
  methodRow: { flexDirection: "row", flexWrap: "wrap", gap: mobileSpacing.sm },
  methodChip: {
    ...mobileTypography.meta,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.xl,
    borderWidth: 1,
    borderColor: mobileColors.border,
    color: mobileColors.textSecondary
  },
  methodChipOn: {
    borderColor: mobileColors.accent,
    color: mobileColors.accent,
    backgroundColor: mobileColors.surfaceMuted
  }
});
