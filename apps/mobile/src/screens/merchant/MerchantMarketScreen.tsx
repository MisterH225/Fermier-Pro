import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { MerchantMobileShell } from "../../components/layout/MerchantMobileShell";
import { useBottomChromePad } from "../../hooks/useBottomInset";
import { merchantColors } from "../../theme/merchantTheme";
import type { RootStackParamList } from "../../types/navigation";

type Route = RouteProp<RootStackParamList, "MerchantMarket">;

/** Ouvre le marketplace partagé en mode commerçant (même hub que les autres profils). */
export function MerchantMarketScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Route>();
  const bottomChromePad = useBottomChromePad();

  useFocusEffect(
    useCallback(() => {
      navigation.replace("MarketplaceList", {
        tab: route.params?.tab ?? "listings",
        offersSubTab: route.params?.offersSubTab ?? "sent",
        merchantView: true,
        searchQuery: route.params?.searchQuery
      });
    }, [
      navigation,
      route.params?.searchQuery,
      route.params?.tab,
      route.params?.offersSubTab
    ])
  );

  return (
    <MerchantMobileShell>
      <View style={[styles.wrap, { paddingBottom: bottomChromePad }]}>
        <ActivityIndicator color={merchantColors.primary} />
      </View>
    </MerchantMobileShell>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", alignItems: "center" }
});
