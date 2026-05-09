import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StyleSheet, View } from "react-native";
import { AnimalDetailScreen } from "../screens/AnimalDetailScreen";
import { BatchDetailScreen } from "../screens/BatchDetailScreen";
import { CreateFarmScreen } from "../screens/CreateFarmScreen";
import { CreateTaskScreen } from "../screens/CreateTaskScreen";
import { FarmDetailScreen } from "../screens/FarmDetailScreen";
import { FarmListScreen } from "../screens/FarmListScreen";
import { FarmLivestockScreen } from "../screens/FarmLivestockScreen";
import { FarmTasksScreen } from "../screens/FarmTasksScreen";
import { CreateMarketplaceListingScreen } from "../screens/CreateMarketplaceListingScreen";
import { EditMarketplaceListingScreen } from "../screens/EditMarketplaceListingScreen";
import { MarketplaceListScreen } from "../screens/MarketplaceListScreen";
import { MarketplaceListingDetailScreen } from "../screens/MarketplaceListingDetailScreen";
import { MarketplaceMyListingsScreen } from "../screens/MarketplaceMyListingsScreen";
import { MarketplaceMyOffersScreen } from "../screens/MarketplaceMyOffersScreen";
import type { RootStackParamList } from "../types/navigation";
import { OfflineBanner } from "./OfflineBanner";

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#f9f8ea",
    primary: "#5d7a1f"
  }
};

function MainStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#5d7a1f" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: "#f9f8ea" }
      }}
    >
      <Stack.Screen
        name="FarmList"
        component={FarmListScreen}
        options={{ title: "Mes fermes" }}
      />
      <Stack.Screen
        name="FarmDetail"
        component={FarmDetailScreen}
        options={({ route }) => ({ title: route.params.farmName })}
      />
      <Stack.Screen
        name="FarmLivestock"
        component={FarmLivestockScreen}
        options={{ title: "Cheptel" }}
      />
      <Stack.Screen
        name="FarmTasks"
        component={FarmTasksScreen}
        options={{ title: "Tâches terrain" }}
      />
      <Stack.Screen
        name="CreateTask"
        component={CreateTaskScreen}
        options={{ title: "Nouvelle tâche" }}
      />
      <Stack.Screen
        name="CreateFarm"
        component={CreateFarmScreen}
        options={{ title: "Nouvelle ferme" }}
      />
      <Stack.Screen
        name="AnimalDetail"
        component={AnimalDetailScreen}
        options={({ route }) => ({ title: route.params.headline })}
      />
      <Stack.Screen
        name="BatchDetail"
        component={BatchDetailScreen}
        options={({ route }) => ({ title: route.params.batchName })}
      />
      <Stack.Screen
        name="MarketplaceList"
        component={MarketplaceListScreen}
        options={{ title: "Marché" }}
      />
      <Stack.Screen
        name="MarketplaceListingDetail"
        component={MarketplaceListingDetailScreen}
        options={({ route }) => ({
          title: route.params.headline ?? "Annonce"
        })}
      />
      <Stack.Screen
        name="MarketplaceMyOffers"
        component={MarketplaceMyOffersScreen}
        options={{ title: "Mes offres" }}
      />
      <Stack.Screen
        name="MarketplaceMyListings"
        component={MarketplaceMyListingsScreen}
        options={{ title: "Mes annonces" }}
      />
      <Stack.Screen
        name="CreateMarketplaceListing"
        component={CreateMarketplaceListingScreen}
        options={{ title: "Nouvelle annonce" }}
      />
      <Stack.Screen
        name="EditMarketplaceListing"
        component={EditMarketplaceListingScreen}
        options={{ title: "Modifier l'annonce" }}
      />
    </Stack.Navigator>
  );
}

/** À l’intérieur de `PersistQueryClientProvider` (réhydratation cache offline). */
export function MainNavigationShell() {
  return (
    <View style={styles.flex}>
      <OfflineBanner />
      <NavigationContainer theme={navTheme}>
        <MainStack />
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }
});
