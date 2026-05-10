export type RootStackParamList = {
  FarmList: undefined;
  FarmDetail: { farmId: string; farmName: string };
  FarmLivestock: { farmId: string; farmName: string };
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
};
