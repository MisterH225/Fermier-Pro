import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  fetchCheptelPens,
  type CheptelPenRowDto,
  type CheptelPensResponseDto
} from "./api";

export type CheptelPenOption = {
  penId: string;
  penName: string;
  barnId: string;
  barnName: string;
  capacity: number;
  occupancy?: number | null;
};

export function cheptelPensQueryKey(
  farmId: string,
  activeProfileId?: string | null,
  barnId?: string | null
): readonly [string, string, string | null, string | null] {
  return ["cheptelPens", farmId, activeProfileId ?? null, barnId ?? null];
}

export function mapCheptelPenOptions(
  pens: CheptelPenRowDto[]
): CheptelPenOption[] {
  return pens.map((pen) => ({
    penId: pen.id,
    penName: pen.code?.trim() || pen.name,
    barnId: pen.barnId,
    barnName: pen.barnName,
    capacity: pen.capacity ?? 0,
    occupancy: pen.occupancy
  }));
}

type UseCheptelPensOptions = {
  farmId: string;
  accessToken: string | null | undefined;
  activeProfileId?: string | null;
  /** Filtre serveur optionnel (onglet Cheptel par bâtiment). */
  barnId?: string | null;
  enabled?: boolean;
};

export function useCheptelPens(
  options: UseCheptelPensOptions
): UseQueryResult<CheptelPensResponseDto, Error> {
  const {
    farmId,
    accessToken,
    activeProfileId,
    barnId,
    enabled = true
  } = options;

  return useQuery({
    queryKey: cheptelPensQueryKey(farmId, activeProfileId, barnId),
    queryFn: () =>
      fetchCheptelPens(
        accessToken!,
        farmId,
        activeProfileId,
        barnId ?? undefined
      ),
    enabled: Boolean(accessToken) && enabled
  });
}
