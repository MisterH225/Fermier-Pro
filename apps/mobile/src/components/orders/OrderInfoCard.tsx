import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { ordersPalette, type OrderPalette } from "./orderTheme";

export type OrderInfoRow = {
  labelKey: string;
  value: string;
  tone?: "default" | "danger";
};

type Props = {
  titleKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  rows: OrderInfoRow[];
  palette?: OrderPalette;
  children?: ReactNode;
};

export function OrderInfoCard({
  titleKey,
  icon,
  rows,
  palette = ordersPalette,
  children
}: Props) {
  const { t } = useTranslation();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.cardBg,
          borderRadius: palette.radius.card,
          borderColor: palette.border
        },
        palette.shadow.card
      ]}
    >
      <View style={styles.header}>
        <Ionicons name={icon} size={18} color={palette.primary} />
        <Text style={[styles.title, { color: palette.textPrimary }]}>
          {t(titleKey)}
        </Text>
      </View>

      {rows.map((row, index) => (
        <View key={`${row.labelKey}-${index}`} style={styles.row}>
          <Text style={[styles.rowLabel, { color: palette.textSecondary }]}>
            {t(row.labelKey)}
          </Text>
          <Text
            style={[
              styles.rowValue,
              {
                color:
                  row.tone === "danger"
                    ? palette.danger
                    : palette.textPrimary
              }
            ]}
            numberOfLines={3}
          >
            {row.value}
          </Text>
        </View>
      ))}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: mobileSpacing.md,
    borderWidth: 1,
    gap: 12
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2
  },
  title: {
    fontSize: mobileFontSize.md,
    fontWeight: "800"
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12
  },
  rowLabel: {
    ...mobileTypography.meta,
    flexShrink: 0
  },
  rowValue: {
    flex: 1,
    textAlign: "right",
    fontWeight: "700",
    fontSize: mobileFontSize.md
  }
});
