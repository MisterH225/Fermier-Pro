import {
  NavigationContainer,
  DefaultTheme,
  type LinkingOptions
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Linking from "expo-linking";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProducerPersistentTabBar } from "./ProducerPersistentTabBar";
import { VetPersistentTabBar } from "./VetPersistentTabBar";
import { TechPersistentTabBar } from "./TechPersistentTabBar";
import { BuyerPersistentTabBar } from "./BuyerPersistentTabBar";
import { MerchantPersistentTabBar } from "./MerchantPersistentTabBar";
import { techBottomChromeHeight } from "./navigation/technician/techNavMetrics";
import { buyerBottomChromeHeight } from "./navigation/buyer/buyerNavMetrics";
import { merchantBottomChromeHeight } from "./navigation/merchant/merchantNavMetrics";
import { TechBottomChromeProvider } from "../context/TechBottomChromeContext";
import { BuyerBottomChromeProvider } from "../context/BuyerBottomChromeContext";
import { MerchantBottomChromeProvider } from "../context/MerchantBottomChromeContext";
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
  BuyerAccountScreen,
  MerchantDashboardScreen,
  MerchantShopsScreen,
  MerchantShopDetailScreen,
  MerchantProductsScreen,
  MerchantMarketScreen,
  MerchantOrdersScreen,
  MerchantOrderDetailScreen,
  MerchantOrderDisputeScreen,
  MerchantSubscriptionScreen,
  ProducerSubscriptionScreen,
  MerchantShopScreen,
  MerchantProductFormScreen,
  MerchantProductDetailScreen,
  MerchantMyProductDetailScreen,
  ChatPickFarmScreen,
  ChatPickPeerScreen,
  ChatRoomScreen,
  ChatRoomsScreen,
  ChatSearchUserScreen,
  CollaborationScreen,
  CreateFarmInvitationScreen,
  CreateFarmScreen,
  CreateMarketplaceListingScreen,
  CreatePenLogScreen,
  CreatePenScreen,
  CreateVetConsultationScreen,
  FarmBarnsScreen,
  FarmDetailScreen,
  FarmFeedStockScreen,
  FarmGestationScreen,
  FarmFinanceScreen,
  HistoricalRecordsScreen,
  FarmListScreen,
  FarmLivestockScreen,
  FarmHealthScreen,
  VetSearchScreen,
  ProducerScheduleVetVisitScreen,
  VetAppointmentDetailScreen,
  FarmMembersScreen,
  FarmTasksScreen,
  FarmVetConsultationsScreen,
  MarketplaceListingDetailScreen,
  MarketplaceListScreen,
  MarketplaceMyListingsScreen,
  MarketplaceMyOffersScreen,
  MarketplaceTransactionScreen,
  CreditDashboardScreen,
  ModuleRoadmapScreen,
  ProducerDashboardScreen,
  ProducerFarmSettingsScreen,
  SupportScreen,
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
  BuyerFinanceScreen,
  UserWalletScreen,
  WalletOperationScreen,
  walletOperationScreenTitle,
  BuyerAlertsScreen,
  BuyerFavoritesScreen,
  VeterinarianDashboardScreen,
  VetAccountScreen,
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
import { rootNavigationRef } from "../lib/navigationRef";
import { defaultStackScreenOptions } from "../lib/navigationHeaderOptions";
import { mobileColors } from "../theme/mobileTheme";
import { techStackScreenOptions } from "../theme/technicianTheme";
import { buyerStackScreenOptions } from "../theme/buyerTheme";
import { merchantStackScreenOptions } from "../theme/merchantTheme";
import { vetStackScreenOptions } from "../theme/vetTheme";
import { AccountModerationGate } from "./auth/AccountModerationGate";
import { OfflineBanner } from "./OfflineBanner";
import { usePendingInviteNavigation } from "../hooks/usePendingInviteNavigation";
import { useSmartAlertPushNavigation } from "../hooks/useSmartAlertPushNavigation";
import { ExpenseCategoriesScreen } from "../screens/settings/ExpenseCategoriesScreen";
import { FeedScreen } from "../screens/feed/FeedScreen";
import { ProducerScoreDashboardScreen } from "../screens/producer/ProducerScoreDashboardScreen";

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
 * annonces marketplace (`fermier-pro://listing/:listingId`) +
 * Universal Link HTTPS optionnel via `EXPO_PUBLIC_INVITE_BASE_URL` /
 * `EXPO_PUBLIC_LISTING_BASE_URL`.
 */
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    Linking.createURL("/", { scheme: "fermier-pro" }),
    "fermier-pro://",
    ...(process.env.EXPO_PUBLIC_INVITE_BASE_URL
      ? [process.env.EXPO_PUBLIC_INVITE_BASE_URL.replace(/\/invite\/?$/, "")]
      : []),
    ...(process.env.EXPO_PUBLIC_LISTING_BASE_URL
      ? [process.env.EXPO_PUBLIC_LISTING_BASE_URL.replace(/\/listing\/?$/, "")]
      : [])
  ],
  config: {
    screens: {
      AcceptFarmInvitation: {
        path: "invite/:prefilledToken"
      },
      MarketplaceListingDetail: {
        path: "listing/:listingId"
      },
      MerchantSubscription: {
        path: "merchant/subscription"
      },
      ProducerSubscription: {
        path: "producer/subscription"
      },
      MerchantShops: {
        path: "merchant/shops"
      },
      MerchantProductForm: {
        path: "merchant/product-form",
        parse: {
          shopId: (shopId: string) => shopId,
          productId: (productId: string) => productId
        }
      },
      MarketplaceList: {
        path: "market/list"
      }
    }
  }
};

function MainStack() {
  const { t } = useTranslation();
  const { authMe, activeProfileId } = useSession();
  const activeType = authMe?.profiles.find((p) => p.id === activeProfileId)?.type;
  const initialRouteName = dashboardRouteForActiveProfileType(activeType);
  const st = (key: string) => t(`navigation.screenTitles.${key}`);
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
        name="Support"
        component={SupportScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SettingsExpenseCategories"
        component={ExpenseCategoriesScreen}
        options={{ title: "" }}
      />
      <Stack.Screen
        name="SmartAlertsList"
        component={SmartAlertsListScreen}
        options={{ title: st("notifications") }}
      />
      <Stack.Screen
        name="FarmReports"
        component={FarmReportsScreen}
        options={{ title: st("reports") }}
      />
      <Stack.Screen
        name="BuyerDashboard"
        component={BuyerDashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="BuyerAccount"
        component={BuyerAccountScreen}
        options={{ ...buyerStackScreenOptions, title: st("buyerAccount") }}
      />
      <Stack.Screen
        name="MerchantDashboard"
        component={MerchantDashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MerchantShops"
        component={MerchantShopsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MerchantShopDetail"
        component={MerchantShopDetailScreen}
        options={{ title: st("merchantShop") }}
      />
      <Stack.Screen
        name="MerchantProducts"
        component={MerchantProductsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MerchantMarket"
        component={MerchantMarketScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MerchantOrders"
        component={MerchantOrdersScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MerchantOrderDetail"
        component={MerchantOrderDetailScreen}
        options={{
          ...merchantStackScreenOptions,
          title: st("merchantOrderDetails")
        }}
      />
      <Stack.Screen
        name="MerchantOrderDispute"
        component={MerchantOrderDisputeScreen}
        options={{ ...merchantStackScreenOptions, title: st("merchantDispute") }}
      />
      <Stack.Screen
        name="MerchantSubscription"
        component={MerchantSubscriptionScreen}
        options={{ ...merchantStackScreenOptions, title: st("merchantSubscription") }}
      />
      <Stack.Screen
        name="ProducerSubscription"
        component={ProducerSubscriptionScreen}
        options={{ title: st("producerSubscription") }}
      />
      <Stack.Screen
        name="MerchantShop"
        component={MerchantShopScreen}
        options={{ title: st("merchantShop") }}
      />
      <Stack.Screen
        name="MerchantProductForm"
        component={MerchantProductFormScreen}
        options={{ title: st("merchantProduct") }}
      />
      <Stack.Screen
        name="MerchantProductDetail"
        component={MerchantProductDetailScreen}
        options={{ title: st("merchantProduct") }}
      />
      <Stack.Screen
        name="MerchantMyProductDetail"
        component={MerchantMyProductDetailScreen}
        options={{ title: st("merchantProduct") }}
      />
      <Stack.Screen
        name="BuyerMarket"
        component={BuyerMarketScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="BuyerMessages"
        component={BuyerMessagesScreen}
        options={{ ...buyerStackScreenOptions, title: st("messages") }}
      />
      <Stack.Screen
        name="BuyerHistory"
        component={BuyerHistoryScreen}
        options={{ ...buyerStackScreenOptions, title: st("buyerHistory") }}
      />
      <Stack.Screen
        name="BuyerFinance"
        component={BuyerFinanceScreen}
        options={{ ...buyerStackScreenOptions, title: st("buyerFinance") }}
      />
      <Stack.Screen
        name="UserWallet"
        component={UserWalletScreen}
        options={{ ...defaultStackScreenOptions, title: st("userWallet") }}
      />
      <Stack.Screen
        name="WalletOperation"
        component={WalletOperationScreen}
        options={({ route }) => ({
          ...defaultStackScreenOptions,
          title: walletOperationScreenTitle(route.params.operation, t)
        })}
      />
      <Stack.Screen
        name="BuyerAlerts"
        component={BuyerAlertsScreen}
        options={{ ...buyerStackScreenOptions, title: st("buyerAlerts") }}
      />
      <Stack.Screen
        name="BuyerFavorites"
        component={BuyerFavoritesScreen}
        options={{ ...buyerStackScreenOptions, title: st("buyerFavorites") }}
      />
      <Stack.Screen
        name="TechTasks"
        component={TechTasksScreen}
        options={{ ...techStackScreenOptions, title: st("tasks") }}
      />
      <Stack.Screen
        name="TechFarm"
        component={TechFarmScreen}
        options={{ ...techStackScreenOptions, title: st("techFarm") }}
      />
      <Stack.Screen
        name="TechTracking"
        component={TechTrackingScreen}
        options={{ ...techStackScreenOptions, title: st("techTracking") }}
      />
      <Stack.Screen
        name="TechProfileEdit"
        component={TechProfileEditScreen}
        options={{ ...techStackScreenOptions, title: st("techProfile") }}
      />
      <Stack.Screen
        name="VeterinarianDashboard"
        component={VeterinarianDashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="VetAccount"
        component={VetAccountScreen}
        options={{ ...vetStackScreenOptions, title: st("vetAccount") }}
      />
      <Stack.Screen
        name="VetAgenda"
        component={VetAgendaScreen}
        options={{ ...vetStackScreenOptions, title: st("vetAgenda") }}
      />
      <Stack.Screen
        name="VetFarms"
        component={VetFarmsScreen}
        options={{ ...vetStackScreenOptions, title: st("farmList") }}
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
        options={{ ...vetStackScreenOptions, title: st("messages") }}
      />
      <Stack.Screen
        name="VetTasks"
        component={VetTasksScreen}
        options={{ ...vetStackScreenOptions, title: st("tasks") }}
      />
      <Stack.Screen
        name="VetReports"
        component={VetReportsScreen}
        options={{ ...vetStackScreenOptions, title: st("vetReports") }}
      />
      <Stack.Screen
        name="TechnicianDashboard"
        component={TechnicianDashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="FarmList"
        component={FarmListScreen}
        options={{ title: st("farmList") }}
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
        options={{ title: st("invitation") }}
      />
      <Stack.Screen
        name="FarmDetail"
        component={FarmDetailScreen}
        options={{ title: st("farm") }}
      />
      <Stack.Screen
        name="FarmLivestock"
        component={FarmLivestockScreen}
        options={{ title: st("cheptel") }}
      />
      <Stack.Screen
        name="FarmHealth"
        component={FarmHealthScreen}
        options={{ title: st("health") }}
      />
      <Stack.Screen
        name="VetSearch"
        component={VetSearchScreen}
        options={{ title: st("vetSearch") }}
      />
      <Stack.Screen
        name="ProducerScheduleVetVisit"
        component={ProducerScheduleVetVisitScreen}
        options={{ title: st("scheduleVetVisit") }}
      />
      <Stack.Screen
        name="VetAppointmentDetail"
        component={VetAppointmentDetailScreen}
        options={{ title: st("vetAppointment") }}
      />
      <Stack.Screen
        name="ProducerMessages"
        component={ProducerMessagesScreen}
        options={{ title: st("messages") }}
      />
      <Stack.Screen
        name="CommunityFeed"
        component={FeedScreen}
        options={{ title: st("communityFeed") }}
      />
      <Stack.Screen
        name="FarmTasks"
        component={FarmTasksScreen}
        options={{ title: st("tasks") }}
      />
      <Stack.Screen
        name="FarmVetConsultations"
        component={FarmVetConsultationsScreen}
        options={{ title: st("vetConsultations") }}
      />
      <Stack.Screen
        name="VetConsultationDetail"
        component={VetConsultationDetailScreen}
        options={{ title: st("vetConsultation") }}
      />
      <Stack.Screen
        name="CreateVetConsultation"
        component={CreateVetConsultationScreen}
        options={{ title: st("createVetConsultation") }}
      />
      <Stack.Screen
        name="AddVetConsultationAttachment"
        component={AddVetConsultationAttachmentScreen}
        options={{ title: st("attachment") }}
      />
      <Stack.Screen
        name="FarmFinance"
        component={FarmFinanceScreen}
        options={{ title: st("finance") }}
      />
      <Stack.Screen
        name="HistoricalRecords"
        component={HistoricalRecordsScreen}
        options={{ title: st("finance") }}
      />
      <Stack.Screen
        name="PenMove"
        component={PenMoveScreen}
        options={{ title: st("movePen") }}
      />
      <Stack.Screen
        name="FarmBarns"
        component={FarmBarnsScreen}
        options={{ title: st("barns") }}
      />
      <Stack.Screen
        name="BarnDetail"
        component={BarnDetailScreen}
        options={{ title: st("barn") }}
      />
      <Stack.Screen
        name="PenDetail"
        component={PenDetailScreen}
        options={{ title: st("pen") }}
      />
      <Stack.Screen
        name="LogeDetail"
        component={LogeDetailScreen}
        options={{ title: st("pen") }}
      />
      <Stack.Screen
        name="CreatePen"
        component={CreatePenScreen}
        options={{ title: st("createPen") }}
      />
      <Stack.Screen
        name="CreatePenLog"
        component={CreatePenLogScreen}
        options={{ title: st("penLog") }}
      />
      <Stack.Screen
        name="CreateFarm"
        component={CreateFarmScreen}
        options={{ title: st("createFarm") }}
      />
      <Stack.Screen
        name="AnimalDetail"
        component={AnimalDetailScreen}
        options={{ title: st("animalDetail") }}
      />
      <Stack.Screen
        name="BatchDetail"
        component={BatchDetailScreen}
        options={{ title: st("batch") }}
      />
      <Stack.Screen
        name="MarketplaceList"
        component={MarketplaceListScreen}
        options={{ title: st("market") }}
      />
      <Stack.Screen
        name="MarketplaceListingDetail"
        component={MarketplaceListingDetailScreen}
        options={({ route }) => ({
          title: route.params.headline ?? st("listing")
        })}
      />
      <Stack.Screen
        name="MarketplaceTransaction"
        component={MarketplaceTransactionScreen}
        options={{ title: st("transaction") }}
      />
      <Stack.Screen
        name="CreditDashboard"
        component={CreditDashboardScreen}
        options={{ title: st("creditScore") }}
      />
      <Stack.Screen
        name="ProducerScoreDashboard"
        component={ProducerScoreDashboardScreen}
        options={{ title: st("producerScoreTitle") }}
      />
      <Stack.Screen
        name="MarketplaceMyOffers"
        component={MarketplaceMyOffersScreen}
        options={{ title: st("myOffers") }}
      />
      <Stack.Screen
        name="MarketplaceMyListings"
        component={MarketplaceMyListingsScreen}
        options={{ title: st("myListings") }}
      />
      <Stack.Screen
        name="CreateMarketplaceListing"
        component={CreateMarketplaceListingScreen}
        options={{ title: st("createListing") }}
      />
      <Stack.Screen
        name="ChatRooms"
        component={ChatRoomsScreen}
        options={{ title: st("messages") }}
      />
      <Stack.Screen
        name="ChatRoom"
        component={ChatRoomScreen}
        options={{ title: st("conversation") }}
      />
      <Stack.Screen
        name="ChatPickFarm"
        component={ChatPickFarmScreen}
        options={{ title: st("newConversation") }}
      />
      <Stack.Screen
        name="ChatPickPeer"
        component={ChatPickPeerScreen}
        options={{ title: st("newConversation") }}
      />
      <Stack.Screen
        name="ChatSearchUser"
        component={ChatSearchUserScreen}
        options={{ title: st("searchUser") }}
      />
      <Stack.Screen
        name="ModuleRoadmap"
        component={ModuleRoadmapScreen}
        options={({ route }) => ({ title: route.params.title })}
      />
      <Stack.Screen
        name="Collaboration"
        component={CollaborationScreen}
        options={{ title: st("collaboration") }}
      />
      <Stack.Screen
        name="FarmMembers"
        component={FarmMembersScreen}
        options={{ title: st("team") }}
      />
      <Stack.Screen
        name="CreateFarmInvitation"
        component={CreateFarmInvitationScreen}
        options={{ title: st("invite") }}
      />
      <Stack.Screen
        name="FarmFeedStock"
        component={FarmFeedStockScreen}
        options={{ title: st("feedStock") }}
      />
      <Stack.Screen
        name="FarmGestation"
        component={FarmGestationScreen}
        options={{ title: st("gestation") }}
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
  const isMerchant = profileType === "merchant";
  const producerPad = isProducer ? producerBottomChromeHeight(insets.bottom) : 0;
  const vetPad = isVeterinarian ? vetBottomChromeHeight(insets.bottom) : 0;
  const buyerPad = isBuyer ? buyerBottomChromeHeight(insets.bottom) : 0;
  const techPad = isTechnician ? techBottomChromeHeight(insets.bottom) : 0;
  const merchantPad = isMerchant ? merchantBottomChromeHeight(insets.bottom) : 0;

  return (
    <ProducerBottomChromeProvider value={producerPad}>
      <VetBottomChromeProvider value={vetPad}>
        <BuyerBottomChromeProvider value={buyerPad}>
          <TechBottomChromeProvider value={techPad}>
            <MerchantBottomChromeProvider value={merchantPad}>
              <AccountModerationGate>
                <View key={activeProfileId ?? "none"} style={styles.flex}>
                  <View style={styles.flex}>
                    <MainStack />
                  </View>
                  <ProducerPersistentTabBar />
                  <VetPersistentTabBar />
                  <BuyerPersistentTabBar />
                  <TechPersistentTabBar />
                  <MerchantPersistentTabBar />
                </View>
              </AccountModerationGate>
            </MerchantBottomChromeProvider>
          </TechBottomChromeProvider>
        </BuyerBottomChromeProvider>
      </VetBottomChromeProvider>
    </ProducerBottomChromeProvider>
  );
}

/** À l’intérieur de `PersistQueryClientProvider` (réhydratation cache offline). */
function MainNavigationShellInner() {
  const { activeProfileId } = useSession();
  useSmartAlertPushNavigation(rootNavigationRef);
  usePendingInviteNavigation(rootNavigationRef);
  const navContainerKey = activeProfileId ?? "none";

  return (
    <View style={styles.flex}>
      <OfflineBanner />
      <NavigationContainer
        key={navContainerKey}
        ref={rootNavigationRef}
        theme={navTheme}
        linking={linking}
      >
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
