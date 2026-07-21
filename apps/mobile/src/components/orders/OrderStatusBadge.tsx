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
  const { t } = useTranslation();
  const colors = palette.badges[tone];

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
        {label ?? t(labelKey)}
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
