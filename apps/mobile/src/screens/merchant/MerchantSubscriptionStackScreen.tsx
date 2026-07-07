import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MerchantSubscriptionScreen } from "./MerchantSubscriptionScreen";
import type { RootStackParamList } from "../../types/navigation";

/** Écran stack : réutilise le comparatif Free/Premium hors onboarding. */
export function MerchantSubscriptionStackScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <MerchantSubscriptionScreen
      onChosen={() => navigation.goBack()}
      onCancel={() => navigation.goBack()}
    />
  );
}
