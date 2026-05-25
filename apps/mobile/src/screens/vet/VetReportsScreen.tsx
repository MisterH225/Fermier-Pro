import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text } from "react-native";
import { VetMobileShell } from "../../components/layout";
import { useVetBottomChromePad } from "../../context/VetBottomChromeContext";
import { vetColors } from "../../theme/vetTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

export function VetReportsScreen() {
  const { t } = useTranslation();
  const bottomPad = useVetBottomChromePad();

  return (
    <VetMobileShell hideTopBar>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingBottom: bottomPad }]}>
        <Text style={styles.body}>{t("vet.reports.body")}</Text>
      </ScrollView>
    </VetMobileShell>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: mobileSpacing.lg },
  body: {
    ...mobileTypography.body,
    color: vetColors.textSecondary,
    lineHeight: 22
  }
});
