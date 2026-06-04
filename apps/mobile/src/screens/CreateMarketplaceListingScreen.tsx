import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { View } from "react-native";
import { MarketplaceModuleGate } from "../components/MarketplaceModuleGate";
import { ListingModal } from "../components/marketplace/ListingModal";
import { useSession } from "../context/SessionContext";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "CreateMarketplaceListing">;

/**
 * Route stack conservée (menu ferme, navigation profonde).
 * Délègue au modal unifié `ListingModal` (mode création).
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
      <ListingModal
        visible
        mode="create"
        initialFarmId={initialFarmId}
        lockFarm={lockFarm}
        onClose={() => navigation.goBack()}
        onSuccess={(created) => {
          navigation.replace("MarketplaceListingDetail", {
            listingId: created.id,
            headline: created.title
          });
        }}
      />
    </View>
  );
}
