import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CollaborationScreen } from "../components/collaboration/CollaborationScreen";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "Collaboration">;

export function CollaborationScreenWrapper({ route }: Props) {
  const { farmId, farmName } = route.params;
  return <CollaborationScreen farmId={farmId} farmName={farmName} />;
}
