import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { mobileColors } from "../theme/mobileTheme";

/** Options stack partagées : titre centré, retour sans libellé iOS. */
export const defaultStackScreenOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: mobileColors.background },
  headerTintColor: mobileColors.accent,
  headerTitleStyle: {
    fontWeight: "700",
    fontSize: 17,
    color: mobileColors.textPrimary
  },
  headerShadowVisible: false,
  headerBackTitle: "",
  contentStyle: {
    backgroundColor: mobileColors.canvas
  }
};
