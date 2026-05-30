import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text } from "react-native";
import { mobileColors, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { BaseModal } from "../modals/BaseModal";

export const CURRENCY_OPTIONS = [
  { code: "XOF", label: "XOF — Franc CFA (UEMOA)", symbol: "FCFA" },
  { code: "XAF", label: "XAF — Franc CFA (CEMAC)", symbol: "FCFA" },
  { code: "GHS", label: "GHS — Cedi ghanéen", symbol: "₵" },
  { code: "NGN", label: "NGN — Naira nigérian", symbol: "₦" },
  { code: "GNF", label: "GNF — Franc guinéen", symbol: "FG" },
  { code: "EUR", label: "EUR — Euro", symbol: "€" },
  { code: "USD", label: "USD — Dollar américain", symbol: "$" }
] as const;

type Props = {
  visible: boolean;
  currentCode: string;
  onClose: () => void;
  onSelect: (code: string, symbol: string) => void;
};

export function CurrencyModal({
  visible,
  currentCode,
  onClose,
  onSelect
}: Props) {
  const { t } = useTranslation();

  return (
    <BaseModal visible={visible} onClose={onClose} title={t("settings.currencyTitle")}>
      {CURRENCY_OPTIONS.map((opt) => (
        <Pressable
          key={opt.code}
          onPress={() => {
            onSelect(opt.code, opt.symbol);
            onClose();
          }}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <Text style={styles.label}>{opt.label}</Text>
          {currentCode === opt.code ? (
            <Text style={styles.check}>✓</Text>
          ) : null}
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
