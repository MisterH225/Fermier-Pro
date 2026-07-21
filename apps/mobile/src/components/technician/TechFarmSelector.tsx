import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { mobileSpacing, mobileTypography, mobileRadius, mobileFontSize } from "../../theme/mobileTheme";
import { techColors, techRadius, techShadow } from "../../theme/technicianTheme";

export type TechFarmSelectorItem = {
  farmId: string;
  farmName: string;
};

type Props = {
  farms: TechFarmSelectorItem[];
  selectedFarmId: string | null;
  onSelect: (farmId: string) => void;
  fallbackLabel?: string;
};

/**
 * Sélecteur multi-élevages technicien (pattern FarmSelector véto, thème tech).
 * Une seule ferme → rien n’est affiché (zéro friction).
 */
export function TechFarmSelector({
  farms,
  selectedFarmId,
  onSelect,
  fallbackLabel
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => farms.find((f) => f.farmId === selectedFarmId) ?? null,
    [farms, selectedFarmId]
  );

  if (farms.length <= 1) {
    return null;
  }

  const label =
    selected?.farmName ??
    fallbackLabel ??
    t("tech.farm.selectorPlaceholder");

  return (
    <>
      <Pressable
        style={[styles.wrap, techShadow.card]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t("tech.farm.selectorA11y")}
      >
        <Ionicons name="home-outline" size={18} color={techColors.primary} />
        <View style={styles.texts}>
          <Text style={styles.title} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <Text style={styles.change}>{t("tech.farm.selectorChange")}</Text>
        <Ionicons name="chevron-down" size={16} color={techColors.primary} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t("tech.farm.selectorTitle")}</Text>
            <ScrollView style={styles.sheetList}>
              {farms.map((f) => {
                const on = f.farmId === selectedFarmId;
                return (
                  <Pressable
                    key={f.farmId}
                    style={[styles.option, on && styles.optionOn]}
                    onPress={() => {
                      onSelect(f.farmId);
                      setOpen(false);
                    }}
                  >
                    <Text
                      style={[styles.optionTx, on && styles.optionTxOn]}
                      numberOfLines={2}
                    >
                      {f.farmName}
                    </Text>
                    {on ? (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={techColors.primary}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: techColors.cardBg,
    borderRadius: mobileRadius.lg,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: techColors.border,
    marginBottom: mobileSpacing.sm
  },
  texts: { flex: 1, minWidth: 0 },
  title: {
    fontSize: mobileFontSize.sm,
    fontWeight: "600",
    color: techColors.textPrimary
  },
  change: {
    fontSize: mobileFontSize.sm,
    fontWeight: "600",
    color: techColors.primary
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end"
  },
  sheet: {
    backgroundColor: techColors.cardBg,
    borderTopLeftRadius: techRadius.card,
    borderTopRightRadius: techRadius.card,
    padding: mobileSpacing.lg,
    maxHeight: "60%",
    gap: mobileSpacing.md
  },
  sheetTitle: {
    fontSize: mobileFontSize.lg,
    fontWeight: "700",
    color: techColors.textPrimary
  },
  sheetList: { maxHeight: 320 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: techColors.border
  },
  optionOn: {},
  optionTx: {
    flex: 1,
    ...mobileTypography.body,
    color: techColors.textPrimary
  },
  optionTxOn: { fontWeight: "700", color: techColors.primary }
});
