import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { BuyerMobileShell } from "../../components/layout/BuyerMobileShell";
import { useBottomChromePad } from "../../hooks/useBottomInset";
import { buyerColors } from "../../theme/buyerTheme";
import type { RootStackParamList } from "../../types/navigation";

type Route = RouteProp<RootStackParamList, "BuyerMarket">;

/** Ouvre le marketplace (liste publique) en mode acheteur — onglet Market. */
export function BuyerMarketScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Route>();
  const bottomChromePad = useBottomChromePad();

  useFocusEffect(
    useCallback(() => {
      navigation.replace("MarketplaceList", {
        tab: route.params?.tab ?? "listings",
        offersSubTab: route.params?.offersSubTab ?? "sent",
        buyerView: true,
        searchQuery: route.params?.searchQuery,
        favoritesOnly: route.params?.favoritesOnly
      });
    }, [
      navigation,
      route.params?.searchQuery,
      route.params?.favoritesOnly,
      route.params?.tab,
      route.params?.offersSubTab
    ])
  );

  return (
    <BuyerMobileShell>
      <View style={[styles.wrap, { paddingBottom: bottomChromePad }]}>
        <ActivityIndicator color={buyerColors.primary} />
      </View>
    </BuyerMobileShell>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", alignItems: "center" }
});
