import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text } from "react-native";
import { BuyerMobileShell } from "../../components/layout/BuyerMobileShell";
import { useBuyerBottomChromePad } from "../../context/BuyerBottomChromeContext";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { buyerColors } from "../../theme/buyerTheme";

export function BuyerAlertsScreen() {
  const { t } = useTranslation();
  const bottomPad = useBuyerBottomChromePad();

  return (
    <BuyerMobileShell>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingBottom: bottomPad }]}>
        <Text style={styles.title}>{t("buyer.alerts.title")}</Text>
        <Text style={styles.body}>{t("buyer.alerts.comingSoon")}</Text>
      </ScrollView>
    </BuyerMobileShell>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: mobileSpacing.lg, gap: mobileSpacing.md },
  title: { ...mobileTypography.cardTitle, fontSize: 20, color: buyerColors.textPrimary },
  body: { ...mobileTypography.body, color: buyerColors.textSecondary }
});
