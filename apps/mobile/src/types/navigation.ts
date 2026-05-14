export type RootStackParamList = {
  ProducerDashboard: undefined;
  /** Paramètres ferme (devise / seuils) — producteur. */
  ProducerFarmSettings: { farmId: string; farmName: string };
  BuyerDashboard: undefined;
  VeterinarianDashboard: undefined;
  TechnicianDashboard: undefined;
  FarmList: undefined;
  /** Fil d’événements terrain (liste des dossiers santé ferme). */
  FarmEventsFeed: undefined;
  /** Compte : déconnexion, langue, aide. */
  Account: undefined;
  /** Saisie du jeton d’invitation (lien partagé par un gestionnaire de ferme). */
  AcceptFarmInvitation: { prefilledToken?: string };
  FarmDetail: { farmId: string; farmName: string };
  FarmLivestock: { farmId: string; farmName: string };
  /** Santé ferme (dossiers vaccins, maladies, véto, traitements, mortalités). */
  FarmHealth: { farmId: string; farmName: string };
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
  CreateTask: { farmId: string; farmName: string };
  MarketplaceList: undefined;
  MarketplaceListingDetail: { listingId: string; headline?: string };
  MarketplaceMyOffers: undefined;
  MarketplaceMyListings: undefined;
  CreateMarketplaceListing: { farmId?: string };
  EditMarketplaceListing: { listingId: string };
  ChatRooms: undefined;
  ChatRoom: { roomId: string; headline?: string };
  ChatPickFarm: undefined;
  ChatPickPeer: { farmId: string; farmName: string };
  ChatSearchUser: undefined;
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
  FarmFinance: { farmId: string; farmName: string };
  CreateFarmExpense: { farmId: string; farmName: string };
  CreateFarmRevenue: { farmId: string; farmName: string };
  EditFarmExpense: {
    farmId: string;
    farmName: string;
    expenseId: string;
  };
  EditFarmRevenue: {
    farmId: string;
    farmName: string;
    revenueId: string;
  };
  FarmBarns: { farmId: string; farmName: string };
  CreateBarn: { farmId: string; farmName: string };
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
  FarmFeedStock: { farmId: string; farmName: string };
  CreateFeedPurchase: { farmId: string; farmName: string };
};
