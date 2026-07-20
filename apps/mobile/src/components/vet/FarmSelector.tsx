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
import type { VetAssignedFarm } from "../../hooks/useVetFarms";
import { vetColors, vetRadius, vetShadow } from "../../theme/vetTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type Props = {
  farms: VetAssignedFarm[];
  selectedFarmId: string | null;
  onSelect: (farmId: string) => void;
  /** Libellé forcé (ex. route params) si la liste n'est pas encore hydratée. */
  fallbackLabel?: string;
};

/**
 * Sélecteur d'élevage — style maquette « selecteur ».
 */
export function FarmSelector({
  farms,
  selectedFarmId,
  onSelect,
  fallbackLabel
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => farms.find((f) => f.id === selectedFarmId) ?? null,
    [farms, selectedFarmId]
  );

  const label =
    selected?.name ??
    fallbackLabel ??
    t("vet.farmDetail.selectorPlaceholder");

  const location =
    selected?.address?.trim() ||
    selected?.producerName?.trim() ||
    null;

  const canSwitch = farms.length > 1;

  return (
    <>
      <Pressable
        style={[styles.wrap, vetShadow.soft]}
        onPress={() => {
          if (canSwitch) setOpen(true);
        }}
        disabled={!canSwitch}
        accessibilityRole="button"
        accessibilityLabel={t("vet.farmDetail.selectorA11y")}
      >
        <Ionicons name="home-outline" size={18} color={vetColors.primary} />
        <View style={styles.texts}>
          <Text style={styles.title} numberOfLines={1}>
            {label}
            {location ? ` — ${location}` : ""}
          </Text>
        </View>
        {canSwitch ? (
          <Text style={styles.change}>{t("vet.farmDetail.selectorChange")}</Text>
        ) : null}
        {canSwitch ? (
          <Ionicons
            name="chevron-down"
            size={16}
            color={vetColors.primary}
          />
        ) : null}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {t("vet.farmDetail.selectorTitle")}
            </Text>
            <ScrollView style={styles.sheetList}>
              {farms.map((f) => {
                const on = f.id === selectedFarmId;
                return (
                  <Pressable
                    key={f.id}
                    style={[styles.option, on && styles.optionOn]}
                    onPress={() => {
                      onSelect(f.id);
                      setOpen(false);
                    }}
                  >
                    <Text
                      style={[styles.optionTx, on && styles.optionTxOn]}
                      numberOfLines={2}
                    >
                      {f.name}
                      {f.address ? ` · ${f.address}` : ""}
                    </Text>
                    {on ? (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={vetColors.primary}
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
    backgroundColor: vetColors.cardBg,
    borderRadius: 14,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: vetColors.border
  },
  texts: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 13,
    fontWeight: "600",
    color: vetColors.textPrimary
  },
  change: {
    fontSize: 12,
    fontWeight: "600",
    color: vetColors.primary
  },
  backdrop: {
    flex: 1,
    backgroundColor: vetColors.modalScrim,
    justifyContent: "flex-end"
  },
  sheet: {
    backgroundColor: vetColors.cardBg,
    borderTopLeftRadius: vetRadius.card,
    borderTopRightRadius: vetRadius.card,
    padding: mobileSpacing.lg,
    maxHeight: "60%",
    gap: mobileSpacing.md
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: vetColors.textPrimary
  },
  sheetList: { maxHeight: 320 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: vetColors.border
  },
  optionOn: {},
  optionTx: {
    flex: 1,
    ...mobileTypography.body,
    color: vetColors.textPrimary
  },
  optionTxOn: { fontWeight: "700", color: vetColors.primary }
});
