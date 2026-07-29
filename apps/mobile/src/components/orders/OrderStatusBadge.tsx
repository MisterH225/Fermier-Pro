import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { ordersPalette, type OrderPalette } from "./orderTheme";
import { mobileFontSize } from "../../theme/mobileTheme";

export type OrderStatusTone =
  | "pending"
  | "active"
  | "success"
  | "danger"
  | "neutral";

type Props = {
  labelKey: string;
  tone: OrderStatusTone;
  palette?: OrderPalette;
  /** Libellé déjà traduit, utile aux adaptateurs historiques. */
  label?: string;
};

export function OrderStatusBadge({
  labelKey,
  tone,
  palette = ordersPalette,
  label
}: Props) {
  const { t, i18n } = useTranslation();
  const colors = palette.badges[tone];
  const resolvedLabel =
    label ??
    (i18n.exists(labelKey) ? t(labelKey) : t("orders.hub.statusFallback"));

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.background,
          borderRadius: palette.radius.pill
        }
      ]}
    >
      <Text
        style={[styles.label, { color: colors.foreground }]}
        numberOfLines={1}
      >
        {resolvedLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: "42%"
  },
  label: { fontSize: mobileFontSize.sm, fontWeight: "800" }
});
