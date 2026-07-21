import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BaseModal } from "../modals/BaseModal";
import { ModalSection } from "../modals/ModalSection";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import {
  PRODUCER_QUICK_ACTION_IDS,
  type ProducerQuickActionId
} from "./producerQuickActions";

const ACTION_META: Record<
  ProducerQuickActionId,
  { icon: keyof typeof Ionicons.glyphMap; labelKey: string; a11yKey: string }
> = {
  weigh: {
    icon: "scale-outline",
    labelKey: "quickActions.actions.weigh",
    a11yKey: "quickActions.actions.weighA11y"
  },
  mortality: {
    icon: "skull-outline",
    labelKey: "quickActions.actions.mortality",
    a11yKey: "quickActions.actions.mortalityA11y"
  },
  farrowing: {
    icon: "egg-outline",
    labelKey: "quickActions.actions.farrowing",
    a11yKey: "quickActions.actions.farrowingA11y"
  },
  sell: {
    icon: "pricetag-outline",
    labelKey: "quickActions.actions.sell",
    a11yKey: "quickActions.actions.sellA11y"
  },
  expense: {
    icon: "wallet-outline",
    labelKey: "quickActions.actions.expense",
    a11yKey: "quickActions.actions.expenseA11y"
  },
  feedIn: {
    icon: "cube-outline",
    labelKey: "quickActions.actions.feedIn",
    a11yKey: "quickActions.actions.feedInA11y"
  },
  stockCheck: {
    icon: "clipboard-outline",
    labelKey: "quickActions.actions.stockCheck",
    a11yKey: "quickActions.actions.stockCheckA11y"
  }
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (id: ProducerQuickActionId) => void;
};

export function QuickActionsSheet({ visible, onClose, onSelect }: Props) {
  const { t } = useTranslation();

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("quickActions.sheetTitle")}
    >
      <ModalSection plain>
        <View style={styles.list}>
          {PRODUCER_QUICK_ACTION_IDS.map((id) => {
            const meta = ACTION_META[id];
            return (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityLabel={t(meta.a11yKey)}
                testID={`quick-action-${id}`}
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
                    color={mobileColors.accent}
                  />
                </View>
                <Text style={styles.label}>{t(meta.labelKey)}</Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={mobileColors.textSecondary}
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
    backgroundColor: mobileColors.surfaceMuted
  },
  rowPressed: { opacity: 0.88 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: mobileRadius.xl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobileColors.accentSoft
  },
  label: {
    ...mobileTypography.cardTitle,
    flex: 1,
    fontSize: mobileFontSize.lg,
    color: mobileColors.textPrimary
  }
});
