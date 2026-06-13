import type { QueryClient } from "@tanstack/react-query";
import type {
  AnimalListItem,
  CheptelOverviewDto,
  CreateAnimalPayload,
  FarmHealthRecordRowDto,
  PatchCheptelAnimalStatusPayload,
  PostFinanceTransactionPayload
} from "../api";
import { offlineLocalId } from "./types";
import { isAnimalInCheptelHerd } from "../cheptelHerd";

function patchFarmAnimalsList(
  qc: QueryClient,
  farmId: string,
  activeProfileId: string | null | undefined,
  updater: (list: AnimalListItem[]) => AnimalListItem[]
): void {
  const keys = qc
    .getQueryCache()
    .findAll({ queryKey: ["farmAnimals", farmId], exact: false });
  for (const q of keys) {
    const prev = q.state.data as AnimalListItem[] | undefined;
    if (!prev) {
      continue;
    }
    qc.setQueryData(q.queryKey, updater(prev));
  }
}

export function optimisticCreateAnimal(
  qc: QueryClient,
  farmId: string,
  activeProfileId: string | null | undefined,
  queueItemId: string,
  payload: CreateAnimalPayload,
  speciesName = "Porcin"
): void {
  const localId = offlineLocalId(queueItemId);
  const item: AnimalListItem = {
    id: localId,
    publicId: localId,
    tagCode: payload.tagCode ?? null,
    sex: payload.sex ?? "unknown",
    productionCategory: payload.productionCategory,
    status: "active",
    healthStatus: "healthy",
    species: {
      id: payload.speciesId ?? "local",
      code: "porcin",
      name: speciesName
    },
    breed: null,
    weights: [],
    currentPen: null
  };
  patchFarmAnimalsList(qc, farmId, activeProfileId, (list) => [item, ...list]);
}

export function optimisticPatchAnimalStatus(
  qc: QueryClient,
  farmId: string,
  activeProfileId: string | null | undefined,
  animalId: string,
  payload: PatchCheptelAnimalStatusPayload
): void {
  let wasInHerd = false;
  patchFarmAnimalsList(qc, farmId, activeProfileId, (list) =>
    list.map((a) => {
      if (a.id !== animalId) {
        return a;
      }
      wasInHerd = isAnimalInCheptelHerd(a.status);
      return {
        ...a,
        status: payload.status,
        healthStatus:
          payload.status === "active" && a.healthStatus === "sick"
            ? "healthy"
            : a.healthStatus,
        currentPen:
          payload.status === "active" ? a.currentPen : null
      };
    })
  );

  const nowInHerd = isAnimalInCheptelHerd(payload.status);
  if (wasInHerd === nowInHerd) {
    return;
  }

  const delta = nowInHerd ? 1 : -1;
  const cheptelKeys = qc
    .getQueryCache()
    .findAll({ queryKey: ["farmCheptel", farmId], exact: false });
  for (const q of cheptelKeys) {
    const prev = q.state.data as CheptelOverviewDto | undefined;
    if (!prev?.kpis) {
      continue;
    }
    const nextHeadcount = Math.max(0, (prev.kpis.totalHeadcount ?? 0) + delta);
    qc.setQueryData(q.queryKey, {
      ...prev,
      kpis: {
        ...prev.kpis,
        totalHeadcount: nextHeadcount
      }
    });
  }
}

export function optimisticSellAnimal(
  qc: QueryClient,
  farmId: string,
  activeProfileId: string | null | undefined,
  animalId: string
): void {
  patchFarmAnimalsList(qc, farmId, activeProfileId, (list) =>
    list.map((a) =>
      a.id === animalId ? { ...a, status: "sold" } : a
    )
  );
}

export function optimisticAnimalWeight(
  qc: QueryClient,
  farmId: string,
  activeProfileId: string | null | undefined,
  animalId: string,
  weightKg: number
): void {
  const measuredAt = new Date().toISOString();
  patchFarmAnimalsList(qc, farmId, activeProfileId, (list) =>
    list.map((a) =>
      a.id === animalId
        ? {
            ...a,
            weights: [{ weightKg, measuredAt }, ...a.weights]
          }
        : a
    )
  );
}

export function optimisticHealthEvent(
  qc: QueryClient,
  farmId: string,
  queueItemId: string,
  draft: Partial<FarmHealthRecordRowDto> & { type: string }
): void {
  const row = {
    id: offlineLocalId(queueItemId),
    farmId,
    ...draft,
    occurredAt: draft.occurredAt ?? new Date().toISOString(),
    createdAt: new Date().toISOString()
  } as FarmHealthRecordRowDto;
  const keys = qc
    .getQueryCache()
    .findAll({ queryKey: ["farmHealthEvents", farmId], exact: false });
  for (const q of keys) {
    const prev = q.state.data as FarmHealthRecordRowDto[] | undefined;
    if (!prev) {
      continue;
    }
    qc.setQueryData(q.queryKey, [row, ...prev]);
  }
}

export function optimisticPenMove(
  qc: QueryClient,
  farmId: string,
  animalId: string,
  toPenId: string,
  toPenName: string,
  barnId: string,
  barnName: string
): void {
  patchFarmAnimalsList(qc, farmId, undefined, (list) =>
    list.map((a) =>
      a.id === animalId
        ? {
            ...a,
            currentPen: {
              placementId: `pending-${toPenId}`,
              penId: toPenId,
              penName: toPenName,
              barnId,
              barnName
            }
          }
        : a
    )
  );
}

export function optimisticFinanceTransaction(
  qc: QueryClient,
  farmId: string,
  queueItemId: string,
  payload: PostFinanceTransactionPayload
): void {
  const keys = qc
    .getQueryCache()
    .findAll({ queryKey: ["financeTransactions", farmId], exact: false });
  const draft = {
    id: offlineLocalId(queueItemId),
    kind: payload.type === "income" ? "income" : "expense",
    amount: String(payload.amount),
    label: payload.label,
    occurredAt: payload.occurredAt,
    pendingSync: true
  };
  for (const q of keys) {
    const prev = q.state.data;
    if (!Array.isArray(prev)) {
      continue;
    }
    qc.setQueryData(q.queryKey, [draft, ...prev]);
  }
}
