import type { RootStackParamList } from "../../types/navigation";

export type DeepNavProfile = "producer" | "technician" | "veterinarian" | "buyer";

/** Paramètres contextuels partagés (deep link depuis alertes). */
export type FarmLivestockDeepParams = {
  farmId: string;
  farmName: string;
  initialTab?: "overview" | "cheptel" | "weight" | "history";
  openPenId?: string;
  highlightPen?: boolean;
  autoOpenTransfer?: boolean;
  showRequalificationBanner?: boolean;
};

export type FarmHealthDeepParams = {
  farmId: string;
  farmName: string;
  initialTab?:
    | "overview"
    | "disease"
    | "vaccination"
    | "mortality"
    | "vet_visit"
    | "treatment";
  openDiseaseId?: string;
  openVisitId?: string;
  openVaccineName?: string;
};

export type FarmFinanceDeepParams = {
  farmId: string;
  farmName: string;
  initialTab?: "overview" | "revenus" | "depenses" | "budget";
  openCategoryId?: string;
  highlightOverrun?: boolean;
};

export type FarmFeedStockDeepParams = {
  farmId: string;
  farmName: string;
  feedTab?: "overview" | "movements" | "controls";
  openFeedTypeId?: string;
  highlightFeedType?: boolean;
  autoOpenEntry?: boolean;
  autoOpenControl?: boolean;
  filterCostMissing?: boolean;
  costFilter?: "missing";
};

export type FarmGestationDeepParams = {
  farmId: string;
  farmName: string;
  initialTab?: "overview" | "active" | "planning" | "birth" | "history";
  openGestationId?: string;
  autoOpenDetail?: boolean;
  highlightUrgent?: boolean;
  highlightSowId?: string;
  tab?: string;
};

export type DeepNavTarget = {
  [K in keyof RootStackParamList]: {
    screen: K;
    params: RootStackParamList[K];
  };
}[keyof RootStackParamList];

export type SmartAlertNavInput = {
  id: string;
  module: string;
  ruleKey?: string;
  action?: {
    label: string;
    route: string;
    params?: Record<string, unknown>;
  };
};

export type PushSmartAlertData = {
  type?: string;
  ruleKey?: string;
  module?: string;
  farmId?: string;
  route?: string;
  params?: string;
};

export type PushVetAppointmentData = {
  type?: string;
  appointmentId?: string;
  farmId?: string;
};

export type PushMarketplaceData = {
  type?: string;
  transactionId?: string;
  listingId?: string;
  offerId?: string;
};
