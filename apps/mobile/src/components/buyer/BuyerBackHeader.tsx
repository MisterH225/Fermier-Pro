import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { buyerColors } from "../../theme/buyerTheme";
import { mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type BuyerBackHeaderProps = {
  title?: string;
  onBack?: () => void;
};

export function BuyerBackHeader({ title, onBack }: BuyerBackHeaderProps) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleBack =
    onBack ??
    (() => {
      if (navigation.canGoBack()) {
        navigation.goBack();
        return;
      }
      navigation.navigate("BuyerDashboard");
    });

  return (
    <View style={styles.row}>
      <Pressable
        onPress={handleBack}
        style={styles.backBtn}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={t("buyer.backToHome")}
      >
        <Ionicons name="chevron-back" size={22} color={buyerColors.primary} />
        <Text style={styles.backTx}>{t("buyer.backToHome")}</Text>
      </Pressable>
      {title ? (
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.sm,
    backgroundColor: buyerColors.canvas,
    gap: mobileSpacing.sm,
    minHeight: 48
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    flexShrink: 0
  },
  backTx: {
    ...mobileTypography.body,
    color: buyerColors.primary,
    fontWeight: "600",
    fontSize: 16
  },
  title: {
    ...mobileTypography.cardTitle,
    flex: 1,
    textAlign: "center",
    color: buyerColors.textPrimary,
    marginRight: 72
  }
});
