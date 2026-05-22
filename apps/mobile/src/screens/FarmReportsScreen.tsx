import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ReportScreen } from "../components/reports/ReportScreen";
import { useScreenTitle } from "../hooks/useScreenTitle";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "FarmReports">;

export function FarmReportsScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const title = farmName?.trim() || "Rapports";
  useScreenTitle(navigation, title);
  return <ReportScreen farmId={farmId} farmName={farmName} />;
}
