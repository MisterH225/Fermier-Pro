import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { CollaborationScreen } from "../components/collaboration/CollaborationScreen";
import { useScreenTitle } from "../hooks/useScreenTitle";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "Collaboration">;

export function CollaborationScreenWrapper({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { t } = useTranslation();
  useScreenTitle(navigation, t("collab.screenTitle"));
  return <CollaborationScreen farmId={farmId} farmName={farmName} />;
}
