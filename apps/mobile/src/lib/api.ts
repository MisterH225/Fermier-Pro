import { getExpoPublicEnv } from "../env";

function apiBaseUrl(): string {
  const { apiUrl } = getExpoPublicEnv();
  if (!apiUrl) {
    throw new Error("EXPO_PUBLIC_API_URL manquant");
  }
  return apiUrl.replace(/\/$/, "");
}

/** GET JSON sous /api/v1/... avec Bearer. */
export async function apiGetJson<T>(
  path: string,
  accessToken: string
): Promise<T> {
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = `${apiBaseUrl()}/api/v1${p}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return JSON.parse(text) as T;
}

export type FarmDto = {
  id: string;
  name: string;
  ownerId: string;
  speciesFocus: string;
  livestockMode: string;
  address: string | null;
  capacity: number | null;
  latitude: string | null;
  longitude: string | null;
  createdAt: string;
  updatedAt: string;
  livestockCategoryPolicies?: unknown;
};

export function fetchFarms(accessToken: string): Promise<FarmDto[]> {
  return apiGetJson<FarmDto[]>("/farms", accessToken);
}

export function fetchFarm(
  accessToken: string,
  farmId: string
): Promise<FarmDto> {
  return apiGetJson<FarmDto>(`/farms/${farmId}`, accessToken);
}

export type AuthMeResponse = {
  user: {
    id: string;
    supabaseUserId: string;
    email: string | null;
    phone: string | null;
    fullName: string | null;
    isActive: boolean;
  };
  profiles: Array<{
    id: string;
    type: string;
    displayName: string | null;
    isDefault: boolean;
  }>;
  activeProfile: {
    id: string;
    type: string;
    displayName: string | null;
    isDefault: boolean;
  } | null;
};

/** GET /api/v1/auth/me (Bearer = access_token Supabase). */
export async function fetchAuthMe(
  accessToken: string,
  activeProfileId?: string
): Promise<AuthMeResponse> {
  const url = `${apiBaseUrl()}/api/v1/auth/me`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`
  };
  if (activeProfileId) {
    headers["X-Profile-Id"] = activeProfileId;
  }
  const res = await fetch(url, { headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return JSON.parse(text) as AuthMeResponse;
}
