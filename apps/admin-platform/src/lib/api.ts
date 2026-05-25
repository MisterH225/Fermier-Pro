import { API_BASE } from "./utils";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export async function apiFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(init?.headers ?? {})
      },
      cache: "no-store"
    });
  } catch (e) {
    const hint =
      e instanceof TypeError && /fetch/i.test(e.message)
        ? `API injoignable (${API_BASE}). Lancez l’API : npm run dev:api depuis la racine du monorepo.`
        : e instanceof Error
          ? e.message
          : String(e);
    throw new ApiError(hint, 0);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(text || res.statusText, res.status);
  }
  return res.json() as Promise<T>;
}

export type AdminMe = {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: "superadmin";
};

export type OverviewDto = {
  kpis: {
    activeFarms: number;
    totalUsers: number;
    verifiedVets: number;
    pendingVets: number;
    activeAnimals: number;
    activeDiseases: number;
    monthTransactions: number;
    countriesCovered: number;
  };
  charts: {
    signups30d: Array<{ day: string; count: number }>;
    farmsByCountry: Array<{ country: string; count: number }>;
    profileDistribution: Array<{ profile: string; count: number }>;
  };
  recentActivity: {
    signups: Array<{ id: string; name: string; createdAt: string }>;
    vetRequests: Array<{ id: string; name: string; country: string; createdAt: string }>;
    sanitaryAlerts: Array<{ id: string; zoneName: string; level: string; message: string }>;
  };
};

export type VetProfileRow = {
  id: string;
  fullName: string;
  schoolName: string;
  schoolCountry: string;
  graduationYear: number;
  locationCity: string;
  locationCountry: string;
  primarySpecialty: string;
  verificationStatus: string;
  diplomaPhotoUrl: string;
  profilePhotoUrl: string | null;
  rejectionReason: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    avatarUrl: string | null;
    createdAt: string;
  };
};

export type UserListItem = {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
  profiles: Array<{ id: string; type: string; displayName: string | null }>;
  primaryFarm: { id: string; name: string } | null;
};

export type UsersListDto = {
  total: number;
  items: UserListItem[];
};

export type UserDetailDto = {
  user: {
    id: string;
    fullName: string | null;
    email: string | null;
    phone: string | null;
    avatarUrl: string | null;
    isActive: boolean;
    createdAt: string;
    homeLocationLabel: string | null;
  };
  profiles: Array<{ id: string; type: string; displayName: string | null; isDefault: boolean }>;
  vetProfile: VetProfileRow | null;
  farms: Array<{
    id: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
    address: string | null;
    activeAnimals: number;
    healthRecords: number;
  }>;
  memberships: Array<{ id: string; farm: { id: string; name: string } }>;
  healthSummary: {
    activeDiseases: number;
    mortalityRate30d: number;
    overdueVaccines: number;
  };
  livestockSummary: {
    totalActive: number;
    byCategory: Array<{ category: string; count: number }>;
  };
  financeSummary: {
    expenses3m: number;
    revenues3m: number;
    netMargin3m: number;
  };
  gestationSummary: {
    active: number;
    upcomingFarrowings: number;
  };
};

export type StatsDto = {
  period: "month" | "quarter" | "year";
  since: string;
  topDiseases: Array<{ label: string; count: number }>;
  mortalityHeadcount: number;
  newUsers: number;
  activeAnimals: number;
};

export type PlatformSettingsDto = {
  id: string;
  mapGeographicScope: string;
  mapCountryCodes: string[] | null;
  alertCaseThreshold: number;
  alertPeriodDays: number;
  alertDefaultLevel: string;
  adminNotifyEmail: string | null;
  reportFrequencyDays: number;
};

export type HealthMapDto = {
  periodDays: number;
  regions: Array<{
    country: string;
    activeCases: number;
    totalCases: number;
    farmCount: number;
    topDiseases: Array<{ name: string; count: number }>;
  }>;
  points: Array<{
    farmId: string;
    lat: number;
    lng: number;
    diagnosis: string;
    severity: string | null;
  }>;
};

export type SanitaryAlertRow = {
  id: string;
  zoneName: string;
  countryCode: string | null;
  level: string;
  alertType: string;
  diseaseName: string | null;
  caseCount: number | null;
  message: string;
  isActive: boolean;
  createdAt: string;
};

export type AdminEpidemicAnalysis = {
  summary: string;
  emergingDiseases: string[];
  riskZones: string[];
  trends: string[];
  recommendations: string[];
  generatedAt: string;
  unavailable?: boolean;
};

export type AdminAiAskResult = {
  answer: string;
  generatedAt: string;
  unavailable?: boolean;
};

export type AdminVetAssistResult = {
  readableDiploma: "yes" | "no" | "manual_check";
  infoConsistent: boolean;
  confidenceScore: number;
  recommendation: "approve" | "review" | "reject";
  notes: string;
  generatedAt: string;
  unavailable?: boolean;
  diplomaImageAnalyzed?: boolean;
};
