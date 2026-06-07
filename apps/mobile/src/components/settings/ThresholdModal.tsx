import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { mobileColors, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { BaseModal } from "../modals/BaseModal";

type Props = {
  visible: boolean;
  weightKg: number;
  ageWeeks: number;
  onClose: () => void;
  onSave: (weightKg: number, ageWeeks: number) => void;
};

export function ThresholdModal({
  visible,
  weightKg,
  ageWeeks,
  onClose,
  onSave
}: Props) {
  const { t } = useTranslation();
  const [w, setW] = useState(String(weightKg));
  const [a, setA] = useState(String(ageWeeks));

  useEffect(() => {
    if (visible) {
      setW(String(weightKg));
      setA(String(ageWeeks));
    }
  }, [visible, weightKg, ageWeeks]);

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("settings.starterThresholdTitle")}
      footerPrimary={
        <Pressable
          style={styles.saveBtn}
          onPress={() => {
            const wn = Number.parseFloat(w.replace(",", "."));
            const an = Number.parseInt(a, 10);
            if (Number.isFinite(wn) && Number.isFinite(an)) {
              onSave(wn, an);
              onClose();
            }
          }}
        >
          <Text style={styles.saveBtnTx}>{t("settings.save")}</Text>
        </Pressable>
      }
    >
      <View style={styles.field}>
        <Text style={styles.lab}>{t("settings.starterWeightKg")}</Text>
        <TextInput
          style={styles.input}
          value={w}
          onChangeText={setW}
          keyboardType="decimal-pad"
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.lab}>{t("settings.starterAgeWeeks")}</Text>
        <TextInput
          style={styles.input}
          value={a}
          onChangeText={setA}
          keyboardType="number-pad"
        />
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: mobileSpacing.md },
  lab: { ...mobileTypography.meta, color: mobileColors.textSecondary, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: 8,
    padding: mobileSpacing.sm,
    ...mobileTypography.body
  },
  saveBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: 10,
    paddingVertical: mobileSpacing.md,
    alignItems: "center"
  },
  saveBtnTx: {
    ...mobileTypography.body,
    color: "#fff",
    fontWeight: "600"
  }
});
