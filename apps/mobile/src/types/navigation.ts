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
};
