import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import { mobileColors } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type SupportHeaderButtonProps = {
  iconColor?: string;
  style?: StyleProp<ViewStyle>;
};

export function SupportHeaderButton({
  iconColor = mobileColors.accent,
  style
}: SupportHeaderButtonProps) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <Pressable
      onPress={() => navigation.navigate("Support")}
      style={({ pressed }) => [style, pressed && { opacity: 0.85 }]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={t("support.buttonA11y")}
    >
      <Ionicons name="headset-outline" size={22} color={iconColor} />
    </Pressable>
  );
}
