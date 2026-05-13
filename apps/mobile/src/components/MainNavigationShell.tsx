import {
  NavigationContainer,
  DefaultTheme,
  type LinkingOptions
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Linking from "expo-linking";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BOTTOM_TAB_BAR_CONTENT_HEIGHT } from "./layout/BottomTabBar";
import { ProducerPersistentTabBar } from "./ProducerPersistentTabBar";
import { ProducerFabBottomLiftProvider } from "../context/ProducerFabBottomLiftContext";
import {
  AcceptFarmInvitationScreen,
  AccountScreen,
  AddVetConsultationAttachmentScreen,
  AnimalDetailScreen,
  BarnDetailScreen,
  BatchDetailScreen,
  BuyerDashboardScreen,
  ChatPickFarmScreen,
  ChatPickPeerScreen,
  ChatRoomScreen,
  ChatRoomsScreen,
  ChatSearchUserScreen,
  CreateBarnScreen,
  CreateFarmExpenseScreen,
  CreateFarmInvitationScreen,
  CreateFarmRevenueScreen,
  CreateFarmScreen,
  CreateFeedPurchaseScreen,
  CreateMarketplaceListingScreen,
  CreatePenLogScreen,
  CreatePenScreen,
  CreateTaskScreen,
  CreateVetConsultationScreen,
  EditFarmExpenseScreen,
  EditFarmRevenueScreen,
  EditMarketplaceListingScreen,
  FarmBarnsScreen,
  FarmDetailScreen,
  FarmEventsFeedScreen,
  FarmFeedStockScreen,
  FarmFinanceScreen,
  FarmListScreen,
  FarmLivestockScreen,
  FarmHealthScreen,
  FarmMembersScreen,
  FarmTasksScreen,
  FarmVetConsultationsScreen,
  MarketplaceListingDetailScreen,
  MarketplaceListScreen,
  MarketplaceMyListingsScreen,
  MarketplaceMyOffersScreen,
  ModuleRoadmapScreen,
  ProducerDashboardScreen,
  ProducerFarmSettingsScreen,
  PenDetailScreen,
  PenMoveScreen,
  TechnicianDashboardScreen,
  VeterinarianDashboardScreen,
  VetConsultationDetailScreen
} from "../features";
import type { RootStackParamList } from "../types/navigation";
import { useSession } from "../context/SessionContext";
import { dashboardRouteForActiveProfileType } from "../lib/dashboardHomeRoute";
import { mobileColors } from "../theme/mobileTheme";
import { OfflineBanner } from "./OfflineBanner";

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: mobileColors.surface,
    primary: mobileColors.accent,
    text: mobileColors.textPrimary,
    card: mobileColors.background,
    border: mobileColors.border
  }
};

/**
 * Deep links « accès collaboratif » (`fermier-pro://invite/:token`) +
 * Universal Link HTTPS optionnel via `EXPO_PUBLIC_INVITE_BASE_URL`.
 * Le token est passé en `prefilledToken` à l'écran AcceptFarmInvitation
 * (qui appelle `GET /invitations/by-token/:token` pour décider de la suite).
 */
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    Linking.createURL("/", { scheme: "fermier-pro" }),
    "fermier-pro://",
    ...(process.env.EXPO_PUBLIC_INVITE_BASE_URL
      ? [process.env.EXPO_PUBLIC_INVITE_BASE_URL.replace(/\/invite\/?$/, "")]
      : [])
  ],
  config: {
    screens: {
      AcceptFarmInvitation: {
        path: "invite/:prefilledToken"
      }
    }
  }
};

function MainStack() {
  const { authMe, activeProfileId } = useSession();
  const activeType = authMe?.profiles.find((p) => p.id === activeProfileId)?.type;
  const initialRouteName = dashboardRouteForActiveProfileType(activeType);

  return (
    <Stack.Navigator
      key={activeProfileId ?? "none"}
      initialRouteName={initialRouteName}
      screenOptions={{
        headerStyle: { backgroundColor: mobileColors.background },
        headerTintColor: mobileColors.accent,
        headerTitleStyle: {
          fontWeight: "700",
          color: mobileColors.textPrimary
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: mobileColors.surface }
      }}
    >
      <Stack.Screen
        name="ProducerDashboard"
        component={ProducerDashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ProducerFarmSettings"
        component={ProducerFarmSettingsScreen}
        options={{ title: "" }}
      />
      <Stack.Screen
        name="BuyerDashboard"
        component={BuyerDashboardScreen}
        options={{ title: "Accueil acheteur" }}
      />
      <Stack.Screen
        name="VeterinarianDashboard"
        component={VeterinarianDashboardScreen}
        options={{ title: "Accueil vétérinaire" }}
      />
      <Stack.Screen
        name="TechnicianDashboard"
        component={TechnicianDashboardScreen}
        options={{ title: "Accueil technicien" }}
      />
      <Stack.Screen
        name="FarmList"
        component={FarmListScreen}
        options={{ title: "Mes fermes" }}
      />
      <Stack.Screen
        name="FarmEventsFeed"
        component={FarmEventsFeedScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Account"
        component={AccountScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AcceptFarmInvitation"
        component={AcceptFarmInvitationScreen}
        options={{ title: "Invitation" }}
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
        name="FarmHealth"
        component={FarmHealthScreen}
        options={{ headerShown: false }}
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
      <Stack.Screen
        name="FarmMembers"
        component={FarmMembersScreen}
        options={{ title: "Équipe" }}
      />
      <Stack.Screen
        name="CreateFarmInvitation"
        component={CreateFarmInvitationScreen}
        options={{ title: "Inviter" }}
      />
      <Stack.Screen
        name="FarmFeedStock"
        component={FarmFeedStockScreen}
        options={{ title: "Nutrition et stock" }}
      />
      <Stack.Screen
        name="CreateFeedPurchase"
        component={CreateFeedPurchaseScreen}
        options={{ title: "Achat aliments" }}
      />
    </Stack.Navigator>
  );
}

function MainNavigationWithChrome() {
  const insets = useSafeAreaInsets();
  const { authMe, activeProfileId } = useSession();
  const profileType = authMe?.profiles.find((p) => p.id === activeProfileId)?.type;
  const isProducer = profileType === "producer";
  const fabLift = isProducer ? BOTTOM_TAB_BAR_CONTENT_HEIGHT + insets.bottom : 0;

  return (
    <ProducerFabBottomLiftProvider value={fabLift}>
      <View style={styles.flex}>
        <View style={styles.flex}>
          <MainStack />
        </View>
        <ProducerPersistentTabBar />
      </View>
    </ProducerFabBottomLiftProvider>
  );
}

/** À l’intérieur de `PersistQueryClientProvider` (réhydratation cache offline). */
export function MainNavigationShell() {
  return (
    <View style={styles.flex}>
      <OfflineBanner />
      <NavigationContainer theme={navTheme} linking={linking}>
        <MainNavigationWithChrome />
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }
});
