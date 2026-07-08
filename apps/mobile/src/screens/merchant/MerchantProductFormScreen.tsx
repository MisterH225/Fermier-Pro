import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { MerchantProductForm } from "../../components/merchant/MerchantProductForm";
import type { RootStackParamList } from "../../types/navigation";

/** Écran stack : formulaire produit unifié (création / édition). */
export function MerchantProductFormScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "MerchantProductForm">>();

  return (
    <MerchantProductForm
      mode="stack"
      shopId={route.params?.shopId}
      productId={route.params?.productId}
      onSuccess={() => navigation.goBack()}
      onNeedShop={() => navigation.navigate("MerchantShops")}
    />
  );
}
