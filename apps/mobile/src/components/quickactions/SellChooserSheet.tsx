import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BaseModal } from "../modals/BaseModal";
import { ModalSection } from "../modals/ModalSection";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

export type SellChooserChoice = "marketplace" | "recordedSale";

type Props = {
  visible: boolean;
  onClose: () => void;
  onChoose: (choice: SellChooserChoice) => void;
};

/**
 * Chooser unique « Vendre » (FAB P-33 + fiches animal/bande P-34).
 * Ne pas dupliquer — réutiliser ce composant.
 */
export function SellChooserSheet({ visible, onClose, onChoose }: Props) {
  const { t } = useTranslation();

  const choices: {
    id: SellChooserChoice;
    icon: keyof typeof Ionicons.glyphMap;
    titleKey: string;
    subtitleKey: string;
  }[] = [
    {
      id: "marketplace",
      icon: "storefront-outline",
      titleKey: "quickActions.sell.marketplaceTitle",
      subtitleKey: "quickActions.sell.marketplaceSubtitle"
    },
    {
      id: "recordedSale",
      icon: "cash-outline",
      titleKey: "quickActions.sell.recordedTitle",
      subtitleKey: "quickActions.sell.recordedSubtitle"
    }
  ];

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("quickActions.sell.title")}
    >
      <ModalSection plain>
        <View style={styles.list}>
          {choices.map((c) => (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              accessibilityLabel={t(c.titleKey)}
              testID={`sell-chooser-${c.id}`}
              onPress={() => {
                onClose();
                onChoose(c.id);
              }}
              style={({ pressed }) => [
                styles.row,
                pressed && styles.rowPressed
              ]}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={c.icon} size={22} color={mobileColors.accent} />
              </View>
              <View style={styles.textCol}>
                <Text style={styles.title}>{t(c.titleKey)}</Text>
                <Text style={styles.subtitle}>{t(c.subtitleKey)}</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={mobileColors.textSecondary}
              />
            </Pressable>
          ))}
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
    minHeight: 64,
    paddingVertical: mobileSpacing.md,
    paddingHorizontal: mobileSpacing.md,
    borderRadius: mobileRadius.lg,
    backgroundColor: mobileColors.surfaceMuted
  },
  rowPressed: { opacity: 0.88 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobileColors.accentSoft
  },
  textCol: { flex: 1, gap: 2 },
  title: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    fontSize: 15
  },
  subtitle: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    lineHeight: 18
  }
});
