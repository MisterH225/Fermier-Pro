import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BaseModal } from "../modals/BaseModal";
import { ModalSection } from "../modals/ModalSection";
import {
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { vetColors } from "../../theme/vetTheme";
import {
  VET_QUICK_ACTION_IDS,
  type VetQuickActionId
} from "./vetQuickActions";

const ACTION_META: Record<
  VetQuickActionId,
  { icon: keyof typeof Ionicons.glyphMap; labelKey: string; a11yKey: string }
> = {
  farms: {
    icon: "leaf-outline",
    labelKey: "vet.dashboard.actionFarms",
    a11yKey: "vet.quickActions.actions.farmsA11y"
  },
  schedule: {
    icon: "calendar-outline",
    labelKey: "vet.dashboard.actionSchedule",
    a11yKey: "vet.quickActions.actions.scheduleA11y"
  },
  case: {
    icon: "medkit-outline",
    labelKey: "vet.dashboard.actionCase",
    a11yKey: "vet.quickActions.actions.caseA11y"
  }
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (id: VetQuickActionId) => void;
};

export function VetQuickActionsSheet({ visible, onClose, onSelect }: Props) {
  const { t } = useTranslation();

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("vet.quickActions.sheetTitle")}
    >
      <ModalSection plain>
        <View style={styles.list}>
          {VET_QUICK_ACTION_IDS.map((id) => {
            const meta = ACTION_META[id];
            return (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityLabel={t(meta.a11yKey)}
                testID={`vet-quick-action-${id}`}
                onPress={() => {
                  onClose();
                  onSelect(id);
                }}
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed
                ]}
              >
                <View style={styles.iconWrap}>
                  <Ionicons
                    name={meta.icon}
                    size={22}
                    color={vetColors.primary}
                  />
                </View>
                <Text style={styles.label}>{t(meta.labelKey)}</Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={vetColors.textSecondary}
                />
              </Pressable>
            );
          })}
        </View>
      </ModalSection>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  list: { gap: mobileSpacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.md,
    minHeight: 56,
    paddingVertical: mobileSpacing.md,
    paddingHorizontal: mobileSpacing.md,
    borderRadius: mobileRadius.lg,
    backgroundColor: vetColors.primaryLight
  },
  rowPressed: { opacity: 0.88 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: vetColors.cardBg
  },
  label: {
    ...mobileTypography.cardTitle,
    flex: 1,
    fontSize: 16,
    color: vetColors.textPrimary
  }
});
