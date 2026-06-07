import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { MarketplaceModuleGate } from "../components/MarketplaceModuleGate";
import { mobileColors } from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "MarketplaceMyListings">;

/** Redirige vers l’onglet « Mes annonces » du hub Market unifié. */
export function MarketplaceMyListingsScreen({ navigation }: Props) {
  useEffect(() => {
    navigation.replace("MarketplaceList", { tab: "mine" });
  }, [navigation]);

  return (
    <MarketplaceModuleGate>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={mobileColors.accent} />
      </View>
    </MarketplaceModuleGate>
  );
}
