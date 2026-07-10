import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ProducerSubscriptionScreen } from "./ProducerSubscriptionScreen";
import type { RootStackParamList } from "../../types/navigation";

export function ProducerSubscriptionStackScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <ProducerSubscriptionScreen
      onChosen={() => navigation.goBack()}
      onCancel={() => navigation.goBack()}
    />
  );
}
