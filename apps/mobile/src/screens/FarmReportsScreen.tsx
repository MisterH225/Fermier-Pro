import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { ReportScreen } from "../components/reports/ReportScreen";
import { useScreenTitle } from "../hooks/useScreenTitle";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "FarmReports">;

export function FarmReportsScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const { t } = useTranslation();
  useScreenTitle(navigation, t("navigation.extended.reports"));
  return <ReportScreen farmId={farmId} farmName={farmName} />;
}
