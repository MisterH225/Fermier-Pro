import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect } from "react";
import { ActivityIndicator } from "react-native";
import { MerchantMobileShell } from "../../components/layout/MerchantMobileShell";
import { merchantColors } from "../../theme/merchantTheme";
import type { RootStackParamList } from "../../types/navigation";

/**
 * Ancien point d'entrée « Mes intrants » (Dashboard).
 * Redirige vers Produits — les intrants sont une catégorie du catalogue unifié.
 */
export function MillIngredientsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    navigation.replace("MerchantProducts");
  }, [navigation]);

  return (
    <MerchantMobileShell omitBottomTabBar>
      <ActivityIndicator
        color={merchantColors.primary}
        style={{ marginTop: 40 }}
        testID="mill-ingredients-redirect"
      />
    </MerchantMobileShell>
  );
}
