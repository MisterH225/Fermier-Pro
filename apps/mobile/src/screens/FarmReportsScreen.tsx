import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ReportScreen } from "../components/reports/ReportScreen";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "FarmReports">;

export function FarmReportsScreen({ route }: Props) {
  const { farmId, farmName } = route.params;
  return <ReportScreen farmId={farmId} farmName={farmName} />;
}
