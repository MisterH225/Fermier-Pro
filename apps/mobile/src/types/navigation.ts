export type RootStackParamList = {
  ProducerDashboard: undefined;
  /** Paramètres ferme (devise / seuils) — producteur. */
  ProducerFarmSettings: { farmId: string; farmName: string };
  BuyerDashboard: undefined;
  MerchantDashboard: undefined;
  MerchantShops: undefined;
  MerchantShopDetail: { shopId: string };
  MerchantProducts: undefined;
  MerchantMarket:
    | {
        searchQuery?: string;
        tab?: "listings" | "offers" | "partners" | "boutiques";
        offersSubTab?: "sent" | "received";
      }
    | undefined;
  MerchantOrders: { filter?: string } | undefined;
  MerchantOrderDetail: { orderId: string };
  MerchantOrderDispute: { orderId: string };
  MerchantSubscription: undefined;
  MerchantShop: undefined;
  MerchantProductForm: { productId?: string; shopId?: string } | undefined;
  MerchantProductDetail: { productId: string };
  BuyerMarket:
    | {
        favoritesOnly?: boolean;
        searchQuery?: string;
        tab?: "listings" | "offers" | "boutiques";
        offersSubTab?: "sent" | "received";
      }
    | undefined;
  BuyerMessages: undefined;
  BuyerHistory: { initialTab?: "proposals" | "purchases" | "reviews"; fromDashboard?: boolean } | undefined;
  BuyerFinance: undefined;
  UserWallet: undefined;
  WalletOperation: {
    operation: "topup" | "withdraw" | "transfer";
  };
  BuyerAlerts: undefined;
  BuyerFavorites: undefined;
  VeterinarianDashboard: undefined;
  VetAgenda: undefined;
  VetFarms: undefined;
  VetFarmDetail: { farmId: string; farmName: string };
  VetMessages: undefined;
  VetTasks: undefined;
  VetReports: undefined;
  TechnicianDashboard: undefined;
  TechTasks: undefined;
  TechFarm: undefined;
  TechTracking: undefined;
  FarmList: undefined;
  /** Compte : déconnexion, langue, aide. */
  Account: undefined;
  /** Support : appel téléphonique ou Telegram. */
  Support: undefined;
  DeleteAccountProcess: undefined;
  DeleteAccountComplete: undefined;
  /** Saisie du jeton d’invitation (lien partagé par un gestionnaire de ferme). */
  AcceptFarmInvitation: { prefilledToken?: string };
  FarmDetail: { farmId: string; farmName: string };
  FarmLivestock: {
    farmId: string;
    farmName: string;
    initialTab?: "overview" | "batches" | "cheptel" | "weight" | "history";
    openPenId?: string;
    highlightPen?: boolean;
    autoOpenTransfer?: boolean;
    showRequalificationBanner?: boolean;
  };
  /** Santé ferme (dossiers vaccins, maladies, véto, traitements, mortalités). */
  FarmHealth: {
    farmId: string;
    farmName: string;
    initialTab?:
      | "overview"
      | "disease"
      | "vaccination"
      | "mortality"
      | "vet_visit"
      | "treatment";
    /** Ouvre directement le formulaire d’ajout (ex. depuis dashboard technicien). */
    openFormKind?: "mortality" | "vaccination" | "vet_visit" | "treatment";
    openDiseaseId?: string;
    openVisitId?: string;
    openVaccineName?: string;
  };
  VetSearch: { farmId: string; farmName: string };
  ProducerScheduleVetVisit: {
    farmId: string;
    farmName: string;
    vetProfileId: string;
  };
  VetAppointmentDetail: { appointmentId: string };
  CreateFarm: undefined;
  AnimalDetail: {
    farmId: string;
    farmName: string;
    animalId: string;
    headline: string;
  };
  BatchDetail: {
    farmId: string;
    farmName: string;
    batchId: string;
    batchName: string;
  };
  FarmTasks: { farmId: string; farmName: string };
  MarketplaceList:
    | {
        tab?: "listings" | "mine" | "offers" | "partners" | "boutiques";
        offersSubTab?: "received" | "sent";
        offersListingId?: string;
        highlightOfferId?: string;
        buyerView?: boolean;
        merchantView?: boolean;
        fromDashboard?: boolean;
        favoritesOnly?: boolean;
        searchQuery?: string;
      }
    | undefined;
  MarketplaceListingDetail: { listingId: string; headline?: string };
  MarketplaceTransaction: { transactionId: string };
  CreditDashboard: undefined;
  ProducerScoreDashboard: undefined;
  MarketplaceMyOffers: undefined;
  MarketplaceMyListings: undefined;
  CreateMarketplaceListing: { farmId?: string };
  TechProfileEdit: undefined;
  ChatRooms: undefined;
  ChatRoom: {
    roomId: string;
    headline?: string;
    listingId?: string;
    peerUserId?: string;
    farmId?: string;
  };
  ChatPickFarm: undefined;
  ChatPickPeer: { farmId: string; farmName: string };
  ChatSearchUser:
    | {
        shareListingId?: string;
        shareListingTitle?: string;
      }
    | undefined;
  /** Messagerie producteur — liste de toutes les conversations. */
  ProducerMessages: undefined;
  /** Feed communautaire — accessible à tous les profils. */
  CommunityFeed: undefined;
  /** Écran générique « module prévu » (véto, finance, loges…). */
  ModuleRoadmap: { title: string; body: string };
  FarmVetConsultations: { farmId: string; farmName: string };
  VetConsultationDetail: {
    farmId: string;
    farmName: string;
    consultationId: string;
  };
  CreateVetConsultation: { farmId: string; farmName: string };
  AddVetConsultationAttachment: {
    farmId: string;
    farmName: string;
    consultationId: string;
  };
  FarmFinance: {
    farmId: string;
    farmName: string;
    initialTab?: "overview" | "rentabilite" | "revenus" | "depenses" | "budget" | "portefeuille";
    openCategoryId?: string;
    highlightOverrun?: boolean;
  };
  HistoricalRecords: { farmId: string; farmName: string };
  FarmBarns: { farmId: string; farmName: string };
  CreatePen: {
    farmId: string;
    farmName: string;
    barnId: string;
    barnName?: string;
  };
  BarnDetail: {
    farmId: string;
    farmName: string;
    barnId: string;
    barnName?: string;
  };
  PenDetail: {
    farmId: string;
    farmName: string;
    penId: string;
    penLabel?: string;
  };
  /** Détail loge — cheptel fusionné (animaux par loge). */
  LogeDetail: {
    farmId: string;
    farmName: string;
    penId: string;
    penLabel?: string;
  };
  CreatePenLog: {
    farmId: string;
    farmName: string;
    penId: string;
    penLabel?: string;
  };
  PenMove: {
    farmId: string;
    farmName: string;
    fromPenId: string;
    fromPenLabel?: string;
    animalId?: string;
    batchId?: string;
    occupantSummary?: string;
  };
  FarmMembers: {
    farmId: string;
    farmName: string;
    effectiveScopes?: string[];
  };
  CreateFarmInvitation: { farmId: string; farmName: string };
  /** Écran principal Collaboration (onglet barre basse). */
  Collaboration: { farmId: string; farmName: string };
  FarmFeedStock: {
    farmId: string;
    farmName: string;
    feedTab?: "overview" | "movements" | "controls";
    openFeedTypeId?: string;
    highlightFeedType?: boolean;
    autoOpenControl?: boolean;
    filterCostMissing?: boolean;
    costFilter?: "missing";
  };
  FarmGestation: {
    farmId: string;
    farmName: string;
    initialTab?: "overview" | "active" | "planning" | "birth" | "history";
    openGestationId?: string;
    autoOpenDetail?: boolean;
    highlightUrgent?: boolean;
    highlightSowId?: string;
    tab?: string;
  };
  SmartAlertsList: { farmId?: string; farmName?: string };
  FarmReports: { farmId: string; farmName: string };
  SettingsExpenseCategories: { farmId: string; farmName: string };
};
