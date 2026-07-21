import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";

type Props = {
  visible: boolean;
  title: string;
  content: string;
  onClose: () => void;
};

/**
 * Modal plein écran pour afficher un document légal (CGU ou Politique de confidentialité)
 * depuis l'écran Paramètres.
 */
export function LegalDocumentModal({ visible, title, content, onClose }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          { paddingTop: insets.top, paddingBottom: insets.bottom + 8 }
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            style={styles.closeBtn}
          >
            <Text style={styles.closeTx}>✕</Text>
          </Pressable>
        </View>

        {/* Contenu scrollable */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
        >
          <Text style={styles.body}>{content}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: mobileColors.background
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border,
    gap: mobileSpacing.md
  },
  title: {
    ...mobileTypography.sectionTitle,
    color: mobileColors.textPrimary,
    flex: 1,
    fontSize: mobileFontSize.lg
  },
  closeBtn: {
    padding: mobileSpacing.xs,
    marginTop: 2
  },
  closeTx: {
    fontSize: mobileFontSize.lg,
    color: mobileColors.textSecondary,
    fontWeight: "600"
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.md,
    paddingBottom: mobileSpacing.xl * 2
  },
  body: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    lineHeight: 22,
    fontSize: mobileFontSize.md
  }
});
