import { useTranslation } from "react-i18next";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authColors } from "../../theme/authTheme";

type Props = {
  content: string;
  onClose: () => void;
};

/** Écran plein politique de confidentialité (empilé sur CGU). */
export function PrivacyPolicyScreen({ content, onClose }: Props) {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
          <Text style={styles.back}>{t("cgu.privacy.back")}</Text>
        </Pressable>
        <Text style={styles.title}>{t("cgu.privacy.title")}</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
      >
        <Text style={styles.body}>{content}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: authColors.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: authColors.border
  },
  back: {
    fontSize: 15,
    color: authColors.forest,
    fontWeight: "600",
    marginBottom: 8
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: authColors.forest
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 32 },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: authColors.body
  }
});
