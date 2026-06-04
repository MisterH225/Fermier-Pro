import {
  NavigationContainer,
  createNavigationContainerRef,
  DefaultTheme,
  type LinkingOptions
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Linking from "expo-linking";
import { useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProducerPersistentTabBar } from "./ProducerPersistentTabBar";
import { VetPersistentTabBar } from "./VetPersistentTabBar";
import { TechPersistentTabBar } from "./TechPersistentTabBar";
import { BuyerPersistentTabBar } from "./BuyerPersistentTabBar";
import { techBottomChromeHeight } from "./navigation/technician/techNavMetrics";
import { buyerBottomChromeHeight } from "./navigation/buyer/buyerNavMetrics";
import { TechBottomChromeProvider } from "../context/TechBottomChromeContext";
import { BuyerBottomChromeProvider } from "../context/BuyerBottomChromeContext";
import { producerBottomChromeHeight } from "./navigation";
import { vetBottomChromeHeight } from "./navigation/vet/vetNavMetrics";
import { ProducerBottomChromeProvider } from "../context/ProducerBottomChromeContext";
import { VetBottomChromeProvider } from "../context/VetBottomChromeContext";
import {
  AcceptFarmInvitationScreen,
  AccountScreen,
  DeleteAccountCompleteScreen,
  DeleteAccountProcessScreen,
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
  CollaborationScreen,
  CreateFarmExpenseScreen,
  CreateFarmInvitationScreen,
  CreateFarmRevenueScreen,
  CreateFarmScreen,
  CreateMarketplaceListingScreen,
  CreatePenLogScreen,
  CreatePenScreen,
  CreateVetConsultationScreen,
  EditFarmExpenseScreen,
  EditFarmRevenueScreen,
  EditMarketplaceListingScreen,
  FarmBarnsScreen,
  FarmDetailScreen,
  FarmFeedStockScreen,
  FarmGestationScreen,
  FarmFinanceScreen,
  FarmListScreen,
  FarmLivestockScreen,
  FarmHealthScreen,
  VetSearchScreen,
  ProducerScheduleVetVisitScreen,
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
  ProducerMessagesScreen,
  SmartAlertsListScreen,
  FarmReportsScreen,
  PenDetailScreen,
  LogeDetailScreen,
  PenMoveScreen,
  TechnicianDashboardScreen,
  TechTasksScreen,
  TechFarmScreen,
  TechTrackingScreen,
  TechProfileEditScreen,
  BuyerMarketScreen,
  BuyerMessagesScreen,
  BuyerHistoryScreen,
  BuyerAlertsScreen,
  BuyerFavoritesScreen,
  VeterinarianDashboardScreen,
  VetAgendaScreen,
  VetFarmDetailScreen,
  VetFarmsScreen,
  VetMessagesScreen,
  VetReportsScreen,
  VetTasksScreen,
  VetConsultationDetailScreen
} from "../features";
import type { RootStackParamList } from "../types/navigation";
import { useSession } from "../context/SessionContext";
import { dashboardRouteForActiveProfileType } from "../lib/dashboardHomeRoute";
import { defaultStackScreenOptions } from "../lib/navigationHeaderOptions";
import { mobileColors } from "../theme/mobileTheme";
import { techStackScreenOptions } from "../theme/technicianTheme";
import { buyerStackScreenOptions } from "../theme/buyerTheme";
import { vetStackScreenOptions } from "../theme/vetTheme";
import { AccountModerationGate } from "./auth/AccountModerationGate";
import { OfflineBanner } from "./OfflineBanner";
import { useSmartAlertPushNavigation } from "../hooks/useSmartAlertPushNavigation";
import { ExpenseCategoriesScreen } from "../screens/settings/ExpenseCategoriesScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: mobileColors.canvas,
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
      screenOptions={defaultStackScreenOptions}
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
        name="SettingsExpenseCategories"
        component={ExpenseCategoriesScreen}
        options={{ title: "" }}
      />
      <Stack.Screen
        name="SmartAlertsList"
        component={SmartAlertsListScreen}
        options={{ title: "Recommandations" }}
      />
      <Stack.Screen
        name="FarmReports"
        component={FarmReportsScreen}
        options={{ title: "Rapports" }}
      />
      <Stack.Screen
        name="BuyerDashboard"
        component={BuyerDashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="BuyerMarket"
        component={BuyerMarketScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="BuyerMessages"
        component={BuyerMessagesScreen}
        options={{ ...buyerStackScreenOptions, title: "Messages" }}
      />
      <Stack.Screen
        name="BuyerHistory"
        component={BuyerHistoryScreen}
        options={{ ...buyerStackScreenOptions, title: "Mes achats" }}
      />
      <Stack.Screen
        name="BuyerAlerts"
        component={BuyerAlertsScreen}
        options={{ ...buyerStackScreenOptions, title: "Alertes prix" }}
      />
      <Stack.Screen
        name="BuyerFavorites"
        component={BuyerFavoritesScreen}
        options={{ ...buyerStackScreenOptions, title: "Favoris" }}
      />
      <Stack.Screen
        name="TechTasks"
        component={TechTasksScreen}
        options={{ ...techStackScreenOptions, title: "Tâches" }}
      />
      <Stack.Screen
        name="TechFarm"
        component={TechFarmScreen}
        options={{ ...techStackScreenOptions, title: "Ma ferme" }}
      />
      <Stack.Screen
        name="TechTracking"
        component={TechTrackingScreen}
        options={{ ...techStackScreenOptions, title: "Suivi" }}
      />
      <Stack.Screen
        name="TechProfileEdit"
        component={TechProfileEditScreen}
        options={{ ...techStackScreenOptions, title: "Mon profil" }}
      />
      <Stack.Screen
        name="VeterinarianDashboard"
        component={VeterinarianDashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="VetAgenda"
        component={VetAgendaScreen}
        options={{ ...vetStackScreenOptions, title: "Agenda" }}
      />
      <Stack.Screen
        name="VetFarms"
        component={VetFarmsScreen}
        options={{ ...vetStackScreenOptions, title: "Mes fermes" }}
      />
      <Stack.Screen
        name="VetFarmDetail"
        component={VetFarmDetailScreen}
        options={({ route }) => ({
          ...vetStackScreenOptions,
          title: route.params.farmName
        })}
      />
      <Stack.Screen
        name="VetMessages"
        component={VetMessagesScreen}
        options={{ ...vetStackScreenOptions, title: "Messages" }}
      />
      <Stack.Screen
        name="VetTasks"
        component={VetTasksScreen}
        options={{ ...vetStackScreenOptions, title: "Tâches" }}
      />
      <Stack.Screen
        name="VetReports"
        component={VetReportsScreen}
        options={{ ...vetStackScreenOptions, title: "Rapports" }}
      />
      <Stack.Screen
        name="TechnicianDashboard"
        component={TechnicianDashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="FarmList"
        component={FarmListScreen}
        options={{ title: "Mes fermes" }}
      />
      <Stack.Screen
        name="Account"
        component={AccountScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DeleteAccountProcess"
        component={DeleteAccountProcessScreen}
        options={{
          title: "",
          headerBackVisible: false,
          gestureEnabled: false
        }}
      />
      <Stack.Screen
        name="DeleteAccountComplete"
        component={DeleteAccountCompleteScreen}
        options={{
          title: "",
          headerShown: false,
          gestureEnabled: false
        }}
      />
      <Stack.Screen
        name="AcceptFarmInvitation"
        component={AcceptFarmInvitationScreen}
        options={{ title: "Invitation" }}
      />
      <Stack.Screen
        name="FarmDetail"
        component={FarmDetailScreen}
        options={{ title: "Ferme" }}
      />
      <Stack.Screen
        name="FarmLivestock"
        component={FarmLivestockScreen}
        options={{ title: "Cheptel" }}
      />
      <Stack.Screen
        name="FarmHealth"
        component={FarmHealthScreen}
        options={{ title: "Santé" }}
      />
      <Stack.Screen
        name="VetSearch"
        component={VetSearchScreen}
        options={{ title: "Trouver un vétérinaire" }}
      />
      <Stack.Screen
        name="ProducerScheduleVetVisit"
        component={ProducerScheduleVetVisitScreen}
        options={{ title: "Planifier une visite" }}
      />
      <Stack.Screen
        name="ProducerMessages"
        component={ProducerMessagesScreen}
        options={{ title: "Messages" }}
      />
      <Stack.Screen
        name="FarmTasks"
        component={FarmTasksScreen}
        options={{ title: "Tâches" }}
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
        name="LogeDetail"
        component={LogeDetailScreen}
        options={{ title: "Loge" }}
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
        options={{ title: "Fiche animal" }}
      />
      <Stack.Screen
        name="BatchDetail"
        component={BatchDetailScreen}
        options={{ title: "Lot" }}
      />
      <Stack.Screen
        name="MarketplaceList"
        component={MarketplaceListScreen}
        options={{ title: "Market" }}
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
        options={{ title: "Conversation" }}
      />
      <Stack.Screen
        name="ChatPickFarm"
        component={ChatPickFarmScreen}
        options={{ title: "Nouvelle conversation" }}
      />
      <Stack.Screen
        name="ChatPickPeer"
        component={ChatPickPeerScreen}
        options={{ title: "Nouvelle conversation" }}
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
        name="Collaboration"
        component={CollaborationScreen}
        options={{ title: "Collaboration" }}
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
        options={{ title: "Stock aliment" }}
      />
      <Stack.Screen
        name="FarmGestation"
        component={FarmGestationScreen}
        options={{ title: "Gestation" }}
      />
    </Stack.Navigator>
  );
}

function MainNavigationWithChrome() {
  const insets = useSafeAreaInsets();
  const { authMe, activeProfileId } = useSession();
  const profileType = authMe?.profiles.find((p) => p.id === activeProfileId)?.type;
  const isProducer = profileType === "producer";
  const isVeterinarian = profileType === "veterinarian";
  const isBuyer = profileType === "buyer";
  const isTechnician = profileType === "technician";
  const producerPad = isProducer ? producerBottomChromeHeight(insets.bottom) : 0;
  const vetPad = isVeterinarian ? vetBottomChromeHeight(insets.bottom) : 0;
  const buyerPad = isBuyer ? buyerBottomChromeHeight(insets.bottom) : 0;
  const techPad = isTechnician ? techBottomChromeHeight(insets.bottom) : 0;

  return (
    <ProducerBottomChromeProvider value={producerPad}>
      <VetBottomChromeProvider value={vetPad}>
        <BuyerBottomChromeProvider value={buyerPad}>
          <TechBottomChromeProvider value={techPad}>
            <AccountModerationGate>
              <View style={styles.flex}>
                <View style={styles.flex}>
                  <MainStack />
                </View>
                <ProducerPersistentTabBar />
                <VetPersistentTabBar />
                <BuyerPersistentTabBar />
                <TechPersistentTabBar />
              </View>
            </AccountModerationGate>
          </TechBottomChromeProvider>
        </BuyerBottomChromeProvider>
      </VetBottomChromeProvider>
    </ProducerBottomChromeProvider>
  );
}

/** À l’intérieur de `PersistQueryClientProvider` (réhydratation cache offline). */
const navigationRef = createNavigationContainerRef<RootStackParamList>();

function MainNavigationShellInner() {
  useSmartAlertPushNavigation(navigationRef);
  return (
    <View style={styles.flex}>
      <OfflineBanner />
      <NavigationContainer ref={navigationRef} theme={navTheme} linking={linking}>
        <MainNavigationWithChrome />
      </NavigationContainer>
    </View>
  );
}

export function MainNavigationShell() {
  return <MainNavigationShellInner />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }
});
