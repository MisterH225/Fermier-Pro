import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text } from "react-native";
import { mobileColors, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { BaseModal } from "../modals/BaseModal";

export type BreedingMode = "individual" | "batch" | "hybrid";

type Props = {
  visible: boolean;
  current: BreedingMode;
  onClose: () => void;
  onSelect: (mode: BreedingMode) => void;
};

export function BreedingModeModal({
  visible,
  current,
  onClose,
  onSelect
}: Props) {
  const { t } = useTranslation();
  const options: BreedingMode[] = ["individual", "batch", "hybrid"];

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("settings.breedingModeTitle")}
    >
      {options.map((mode) => (
        <Pressable
          key={mode}
          onPress={() => {
            onSelect(mode);
            onClose();
          }}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <Text style={styles.label}>
            {mode === "individual"
              ? t("cheptel.modeIndividual")
              : mode === "batch"
                ? t("cheptel.modeBatch")
                : t("cheptel.modeMixed")}
          </Text>
          {current === mode ? <Text style={styles.check}>✓</Text> : null}
        </Pressable>
      ))}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: mobileSpacing.md
  },
  rowPressed: { opacity: 0.7 },
  label: { ...mobileTypography.body, flex: 1 },
  check: { color: mobileColors.accent, fontWeight: "700" }
});
