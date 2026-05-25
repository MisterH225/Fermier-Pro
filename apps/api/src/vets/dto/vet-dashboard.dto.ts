export type VetDashboardKpisDto = {
  farmsFollowed: number;
  visitsThisMonth: number;
  healthAlerts: number;
  pendingTasks: number;
};

export type VetDashboardUpcomingVisitDto = {
  id: string;
  farmId: string;
  farmName: string;
  producerName: string | null;
  producerPhone: string | null;
  scheduledAt: string;
  subject: string;
  location: string | null;
  status: string;
};

export type VetDashboardActivityDto = {
  id: string;
  kind: "consultation" | "vet_visit" | "vaccination" | "disease" | "treatment" | "alert";
  title: string;
  subtitle: string;
  occurredAt: string;
  farmId: string;
  farmName: string;
};

export type VetDashboardAssignedFarmDto = {
  id: string;
  name: string;
  address: string | null;
  producerName: string | null;
  producerPhone: string | null;
};

export type VetDashboardDto = {
  kpis: VetDashboardKpisDto;
  upcomingVisits: VetDashboardUpcomingVisitDto[];
  assignedFarms: VetDashboardAssignedFarmDto[];
  recentActivity: VetDashboardActivityDto[];
  stats: {
    farmsFollowed: number;
    visitsCompleted: number;
    averageRating: number | null;
  };
};
