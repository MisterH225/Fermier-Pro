import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { AlertBadge } from "../smartAlerts/AlertBadge";
import { useNotificationsBadgeCount } from "../../hooks/useNotificationsBadgeCount";
import { mobileSpacing } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type Props = {
  iconColor: string;
  farmId?: string | null;
  farmName?: string | null;
  style?: StyleProp<ViewStyle>;
};

export function NotificationsHeaderButton({
  iconColor,
  farmId,
  farmName,
  style
}: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const badgeCount = useNotificationsBadgeCount(farmId);

  return (
    <Pressable
      onPress={() =>
        navigation.navigate(
          "SmartAlertsList",
          farmId && farmName ? { farmId, farmName } : {}
        )
      }
      style={({ pressed }) => [styles.btn, style, pressed && { opacity: 0.85 }]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={t("smartAlerts.bellA11y", "Notifications")}
    >
      <View style={styles.bellWrap}>
        <Ionicons name="notifications-outline" size={22} color={iconColor} />
        <AlertBadge count={badgeCount} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    padding: mobileSpacing.sm
  },
  bellWrap: {
    position: "relative"
  }
});
