import { useTranslation } from "react-i18next";
import { StyleSheet, Text } from "react-native";
import { ordersPalette, type OrderPalette } from "./orderTheme";

type Props = {
  deadlineAt: string;
  labelKey: string;
  palette?: OrderPalette;
};

function formatDeadline(iso: string, locale: string) {
  try {
    return new Date(iso).toLocaleString(locale, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}

export function OrderDeadlineBanner({
  deadlineAt,
  labelKey,
  palette = ordersPalette
}: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";

  return (
    <Text style={[styles.label, { color: palette.warning }]}>
      {t(labelKey, { when: formatDeadline(deadlineAt, locale) })}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    fontWeight: "700",
    fontSize: 13
  }
});
