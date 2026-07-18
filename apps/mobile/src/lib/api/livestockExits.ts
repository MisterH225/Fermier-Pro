import type { LivestockExitKind } from "../../components/cheptel/exits/livestockExitKind";
import { apiPostJson } from "./http";

export type CreateLivestockExitPayload = {
  kind: LivestockExitKind;
  animalId?: string;
  batchId?: string;
  headcountAffected?: number;
  occurredAt?: string;
  buyerName?: string;
  price?: number;
  currency?: string;
  weightKg?: number;
  deathCause?: string;
  transferDestination?: string;
  slaughterDestination?: string;
  note?: string;
};

export function createLivestockExit(
  accessToken: string,
  farmId: string,
  body: CreateLivestockExitPayload,
  activeProfileId?: string | null
): Promise<unknown> {
  return apiPostJson(`/farms/${farmId}/exits`, body, accessToken, activeProfileId);
}
