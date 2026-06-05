import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { View } from "react-native";
import { MarketplaceModuleGate } from "../components/MarketplaceModuleGate";
import { CreateMarketplaceListingModal } from "../components/marketplace/CreateMarketplaceListingModal";
import { useSession } from "../context/SessionContext";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "CreateMarketplaceListing">;

/**
 * Route stack conservée (menu ferme, navigation profonde).
 * Délègue au modal canonique `CreateMarketplaceListingModal`.
 */
export function CreateMarketplaceListingScreen({ navigation, route }: Props) {
  const { clientFeatures } = useSession();
  const initialFarmId = route.params?.farmId ?? null;
  const lockFarm = Boolean(initialFarmId);

  if (!clientFeatures.marketplace) {
    return (
      <MarketplaceModuleGate>
        <View />
      </MarketplaceModuleGate>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CreateMarketplaceListingModal
        visible
        initialFarmId={initialFarmId}
        lockFarm={lockFarm}
        onClose={() => navigation.goBack()}
        onCreated={(created) => {
          navigation.replace("MarketplaceListingDetail", {
            listingId: created.id,
            headline: created.title
          });
        }}
      />
    </View>
  );
}
