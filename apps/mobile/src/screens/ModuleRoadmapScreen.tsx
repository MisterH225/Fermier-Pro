import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useBottomInset } from "../hooks/useBottomInset";
import { mobileColors, mobileRadius, mobileFontSize } from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "ModuleRoadmap">;

export function ModuleRoadmapScreen({ route }: Props) {
  const { t } = useTranslation();
  const { title, body } = route.params;
  const bottomInset = useBottomInset();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <View style={styles.note}>
        <Text style={styles.noteText}>{t("moduleRoadmap.note")}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: mobileColors.canvas
  },
  content: {
    padding: 20
  },
  title: {
    fontSize: mobileFontSize.xl,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    marginBottom: 14
  },
  body: {
    fontSize: mobileFontSize.lg,
    color: mobileColors.textSecondary,
    lineHeight: 24
  },
  note: {
    marginTop: 28,
    padding: 14,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.surfaceMuted,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  noteText: {
    fontSize: mobileFontSize.sm,
    color: mobileColors.textSecondary,
    lineHeight: 20
  }
});
