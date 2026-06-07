import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import i18n from "../../i18n/i18n";
import { type AppLocaleCode, setStoredAppLocale } from "../../lib/appLocale";
import { mobileColors, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { BaseModal } from "../modals/BaseModal";

const OPTIONS: { code: AppLocaleCode; label: string; flag: string }[] = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" }
];

type Props = {
  visible: boolean;
  current: AppLocaleCode;
  onClose: () => void;
  onSaved: (code: AppLocaleCode) => void;
};

export function LanguageModal({ visible, current, onClose, onSaved }: Props) {
  const { t } = useTranslation();

  const pick = async (code: AppLocaleCode) => {
    await setStoredAppLocale(code);
    await i18n.changeLanguage(code);
    onSaved(code);
    onClose();
  };

  return (
    <BaseModal visible={visible} onClose={onClose} title={t("settings.languageTitle")}>
      {OPTIONS.map((opt) => (
        <Pressable
          key={opt.code}
          onPress={() => void pick(opt.code)}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <Text style={styles.flag}>{opt.flag}</Text>
          <Text style={styles.label}>{opt.label}</Text>
          {current === opt.code ? (
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
    paddingVertical: mobileSpacing.md,
    gap: mobileSpacing.sm
  },
  rowPressed: { opacity: 0.7 },
  flag: { fontSize: 22 },
  label: { ...mobileTypography.body, flex: 1 },
  check: { color: mobileColors.accent, fontWeight: "700" }
});
