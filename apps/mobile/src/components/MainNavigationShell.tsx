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
import { FarmVetConsultationsScreen } from "../screens/FarmVetConsultationsScreen";
import { VetConsultationDetailScreen } from "../screens/VetConsultationDetailScreen";
import { CreateVetConsultationScreen } from "../screens/CreateVetConsultationScreen";
import { AddVetConsultationAttachmentScreen } from "../screens/AddVetConsultationAttachmentScreen";
import { FarmFinanceScreen } from "../screens/FarmFinanceScreen";
import { CreateFarmExpenseScreen } from "../screens/CreateFarmExpenseScreen";
import { CreateFarmRevenueScreen } from "../screens/CreateFarmRevenueScreen";
import { EditFarmExpenseScreen } from "../screens/EditFarmExpenseScreen";
import { EditFarmRevenueScreen } from "../screens/EditFarmRevenueScreen";
import { PenMoveScreen } from "../screens/PenMoveScreen";
import { FarmBarnsScreen } from "../screens/FarmBarnsScreen";
import { BarnDetailScreen } from "../screens/BarnDetailScreen";
import { PenDetailScreen } from "../screens/PenDetailScreen";
import { CreateBarnScreen } from "../screens/CreateBarnScreen";
import { CreatePenScreen } from "../screens/CreatePenScreen";
import { CreatePenLogScreen } from "../screens/CreatePenLogScreen";
import { CreateMarketplaceListingScreen } from "../screens/CreateMarketplaceListingScreen";
import { EditMarketplaceListingScreen } from "../screens/EditMarketplaceListingScreen";
import { MarketplaceListScreen } from "../screens/MarketplaceListScreen";
import { MarketplaceListingDetailScreen } from "../screens/MarketplaceListingDetailScreen";
import { MarketplaceMyListingsScreen } from "../screens/MarketplaceMyListingsScreen";
import { MarketplaceMyOffersScreen } from "../screens/MarketplaceMyOffersScreen";
import { ChatRoomsScreen } from "../screens/ChatRoomsScreen";
import { ChatRoomScreen } from "../screens/ChatRoomScreen";
import { ChatPickFarmScreen } from "../screens/ChatPickFarmScreen";
import { ChatPickPeerScreen } from "../screens/ChatPickPeerScreen";
import { ChatSearchUserScreen } from "../screens/ChatSearchUserScreen";
import { ModuleRoadmapScreen } from "../screens/ModuleRoadmapScreen";
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
        name="FarmVetConsultations"
        component={FarmVetConsultationsScreen}
        options={{ title: "Suivi vétérinaire" }}
      />
      <Stack.Screen
        name="VetConsultationDetail"
        component={VetConsultationDetailScreen}
        options={{ title: "Consultation" }}
      />
      <Stack.Screen
        name="CreateVetConsultation"
        component={CreateVetConsultationScreen}
        options={{ title: "Nouveau dossier véto" }}
      />
      <Stack.Screen
        name="AddVetConsultationAttachment"
        component={AddVetConsultationAttachmentScreen}
        options={{ title: "Pièce jointe" }}
      />
      <Stack.Screen
        name="FarmFinance"
        component={FarmFinanceScreen}
        options={{ title: "Finance" }}
      />
      <Stack.Screen
        name="CreateFarmExpense"
        component={CreateFarmExpenseScreen}
        options={{ title: "Nouvelle dépense" }}
      />
      <Stack.Screen
        name="CreateFarmRevenue"
        component={CreateFarmRevenueScreen}
        options={{ title: "Nouveau revenu" }}
      />
      <Stack.Screen
        name="EditFarmExpense"
        component={EditFarmExpenseScreen}
        options={{ title: "Modifier dépense" }}
      />
      <Stack.Screen
        name="EditFarmRevenue"
        component={EditFarmRevenueScreen}
        options={{ title: "Modifier revenu" }}
      />
      <Stack.Screen
        name="PenMove"
        component={PenMoveScreen}
        options={{ title: "Déplacer" }}
      />
      <Stack.Screen
        name="FarmBarns"
        component={FarmBarnsScreen}
        options={{ title: "Loges et parcours" }}
      />
      <Stack.Screen
        name="BarnDetail"
        component={BarnDetailScreen}
        options={{ title: "Bâtiment" }}
      />
      <Stack.Screen
        name="PenDetail"
        component={PenDetailScreen}
        options={{ title: "Loge" }}
      />
      <Stack.Screen
        name="CreateBarn"
        component={CreateBarnScreen}
        options={{ title: "Nouveau bâtiment" }}
      />
      <Stack.Screen
        name="CreatePen"
        component={CreatePenScreen}
        options={{ title: "Nouvelle loge" }}
      />
      <Stack.Screen
        name="CreatePenLog"
        component={CreatePenLogScreen}
        options={{ title: "Entrée journal" }}
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
      <Stack.Screen
        name="ChatRooms"
        component={ChatRoomsScreen}
        options={{ title: "Messages" }}
      />
      <Stack.Screen
        name="ChatRoom"
        component={ChatRoomScreen}
        options={({ route }) => ({
          title: route.params.headline ?? "Conversation"
        })}
      />
      <Stack.Screen
        name="ChatPickFarm"
        component={ChatPickFarmScreen}
        options={{ title: "Nouvelle conversation" }}
      />
      <Stack.Screen
        name="ChatPickPeer"
        component={ChatPickPeerScreen}
        options={({ route }) => ({
          title: route.params.farmName
        })}
      />
      <Stack.Screen
        name="ChatSearchUser"
        component={ChatSearchUserScreen}
        options={{ title: "Rechercher une personne" }}
      />
      <Stack.Screen
        name="ModuleRoadmap"
        component={ModuleRoadmapScreen}
        options={({ route }) => ({ title: route.params.title })}
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
