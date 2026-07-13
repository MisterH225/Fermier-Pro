import { apiGetJson, apiPatchJson, apiDeleteJson } from "./http";

export type FarmMemberDto = {
  id: string;
  farmId: string;
  userId: string;
  role: string;
  scopes?: string[];
  user: {
    id: string;
    fullName: string | null;
    email: string | null;
    phone: string | null;
  };
};

export function fetchFarmMembers(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FarmMemberDto[]> {
  return apiGetJson<FarmMemberDto[]>(
    `/farms/${farmId}/members`,
    accessToken,
    activeProfileId
  );
}

export type PatchFarmMemberPayload = {
  role?: string;
  scopes?: string[];
};

export function patchFarmMember(
  accessToken: string,
  farmId: string,
  membershipId: string,
  payload: PatchFarmMemberPayload,
  activeProfileId?: string | null
): Promise<FarmMemberDto> {
  return apiPatchJson<FarmMemberDto>(
    `/farms/${farmId}/members/${membershipId}`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function removeFarmMember(
  accessToken: string,
  farmId: string,
  membershipId: string,
  activeProfileId?: string | null
): Promise<{ ok: boolean }> {
  return apiDeleteJson<{ ok: boolean }>(
    `/farms/${farmId}/members/${membershipId}`,
    accessToken,
    activeProfileId
  );
}

