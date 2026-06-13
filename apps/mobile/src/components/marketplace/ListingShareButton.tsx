import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  presentListingShareOptions,
  type ListingShareInput
} from "../../lib/shareMarketplaceListing";
import { mobileColors } from "../../theme/mobileTheme";
import type { RootStackParamList } from "../../types/navigation";

type Props = {
  listing: ListingShareInput;
  navigation: NativeStackNavigationProp<RootStackParamList>;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
  accessibilityLabel?: string;
};

export function ListingShareButton({
  listing,
  navigation,
  size = 22,
  color = mobileColors.textPrimary,
  style,
  hitSlop = 10,
  accessibilityLabel
}: Props) {
  const { t } = useTranslation();

  return (
    <Pressable
      style={({ pressed }) => [styles.btn, pressed && styles.pressed, style]}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? t("marketScreen.share.a11y")}
      onPress={(e) => {
        e.stopPropagation?.();
        presentListingShareOptions({
          listing,
          t,
          onShareInApp: () =>
            navigation.navigate("ChatSearchUser", {
              shareListingId: listing.id,
              shareListingTitle: listing.title
            })
        });
      }}
    >
      <Ionicons name="share-outline" size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: "center",
    justifyContent: "center"
  },
  pressed: {
    opacity: 0.7
  }
});
