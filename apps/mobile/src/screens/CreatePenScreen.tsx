import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { View } from "react-native";
import { HousingModuleGate } from "../components/HousingModuleGate";
import { CreateLogeModal } from "../components/cheptel/pens/CreateLogeModal";
import { useSession } from "../context/SessionContext";
import { fetchFarmBarns } from "../lib/api";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "CreatePen">;

/**
 * Route stack conservée pour liens profonds / menu bâtiment.
 * Délègue au modal canonique `CreateLogeModal`.
 */
export function CreatePenScreen({ route, navigation }: Props) {
  const { farmId, barnId, barnName } = route.params;
  const { accessToken, activeProfileId, clientFeatures } = useSession();

  const barnsQ = useQuery({
    queryKey: ["farmBarns", farmId, activeProfileId],
    queryFn: () => fetchFarmBarns(accessToken, farmId, activeProfileId),
    enabled: Boolean(accessToken && clientFeatures.housing)
  });

  if (!clientFeatures.housing) {
    return (
      <HousingModuleGate>
        <View />
      </HousingModuleGate>
    );
  }

  const barns =
    barnsQ.data?.map((b) => ({ id: b.id, name: b.name })) ??
    (barnId ? [{ id: barnId, name: barnName ?? "Bâtiment" }] : []);

  return (
    <View style={{ flex: 1 }}>
      <CreateLogeModal
        visible
        farmId={farmId}
        accessToken={accessToken}
        activeProfileId={activeProfileId}
        barns={barns}
        defaultBarnId={barnId}
        lockBarn={Boolean(barnId)}
        onClose={() => navigation.goBack()}
        onCreated={() => {
          void barnsQ.refetch();
        }}
      />
    </View>
  );
}
