import {
  AnimalProductionCategory,
  PenCategory,
  Prisma
} from "@prisma/client";
import { formatTagCode } from "../livestock/animal-tag.helper";
import { lockFarmRowForUpdate } from "../livestock/farm-row-lock";

export type PenSlot = {
  id: string;
  capacity: number;
  occupancy: number;
};

export function barnLabelForIndex(index: number): string {
  const letter = String.fromCharCode(65 + index);
  return `Bâtiment ${letter}`;
}

export function barnCodeForIndex(index: number): string {
  return String.fromCharCode(65 + index);
}

export function penNameForBarn(code: string, sortOrder: number): string {
  return `${code}-${sortOrder + 1}`;
}

function freeCapacity(pen: PenSlot): number {
  return Math.max(0, pen.capacity - pen.occupancy);
}

function occupy(pen: PenSlot, amount: number) {
  pen.occupancy += amount;
}

/** Une loge si possible, sinon répartition selon capacité libre (ordre : plus de place d'abord). */
export function planBatchDistribution(
  headcount: number,
  pens: PenSlot[]
): Array<{ penId: string; headcount: number }> {
  if (headcount <= 0 || pens.length === 0) {
    return [];
  }
  const slots = pens.map((p) => ({ ...p }));

  const single = slots.find((p) => freeCapacity(p) >= headcount);
  if (single) {
    return [{ penId: single.id, headcount }];
  }

  const plan: Array<{ penId: string; headcount: number }> = [];
  let remaining = headcount;
  const ordered = [...slots].sort(
    (a, b) => freeCapacity(b) - freeCapacity(a)
  );

  for (const pen of ordered) {
    if (remaining <= 0) {
      break;
    }
    const free = freeCapacity(pen);
    if (free <= 0) {
      continue;
    }
    const take = Math.min(remaining, free);
    plan.push({ penId: pen.id, headcount: take });
    occupy(pen, take);
    remaining -= take;
  }

  return plan;
}

/** Affecte chaque animal individuellement (1 place par tête) dans l'ordre des loges. */
export function planIndividualAnimalPlacements(
  animalIds: string[],
  pens: PenSlot[]
): Map<string, string> {
  const map = new Map<string, string>();
  if (animalIds.length === 0 || pens.length === 0) {
    return map;
  }
  let penIdx = 0;
  for (const animalId of animalIds) {
    while (penIdx < pens.length && freeCapacity(pens[penIdx]) < 1) {
      penIdx += 1;
    }
    if (penIdx >= pens.length) {
      break;
    }
    const pen = pens[penIdx];
    map.set(animalId, pen.id);
    occupy(pen, 1);
    if (freeCapacity(pen) < 1) {
      penIdx += 1;
    }
  }
  return map;
}

export type OnboardingPlacementPlan = {
  femalePenByAnimalId: Map<string, string>;
  malePenByAnimalId: Map<string, string>;
  fatteningPenByAnimalId: Map<string, string>;
  starterPenByAnimalId: Map<string, string>;
};

export function buildDefaultPlacementPlan(params: {
  pensByBarn: PenSlot[][];
  femaleIds: string[];
  maleIds: string[];
  fatteningIds: string[];
  starterIds: string[];
}): OnboardingPlacementPlan {
  const pensA = (params.pensByBarn[0] ?? []).map((p) => ({ ...p }));
  const pensB = (params.pensByBarn[1] ?? []).map((p) => ({ ...p }));
  const allPens = [...pensA, ...pensB];

  const femalePenByAnimalId = planIndividualAnimalPlacements(
    params.femaleIds,
    pensA
  );

  const malePenPool = [...pensB, ...pensA.slice(1)];
  const malePenByAnimalId = planIndividualAnimalPlacements(
    params.maleIds,
    malePenPool
  );

  const productionPool = allPens.filter((p) => freeCapacity(p) > 0);
  const fatteningPenByAnimalId = planIndividualAnimalPlacements(
    params.fatteningIds,
    productionPool
  );
  for (const [, penId] of fatteningPenByAnimalId) {
    const pen = allPens.find((p) => p.id === penId);
    if (pen) {
      occupy(pen, 1);
    }
  }

  const starterPool = allPens.filter((p) => freeCapacity(p) > 0);
  const starterPenByAnimalId = planIndividualAnimalPlacements(
    params.starterIds,
    starterPool
  );

  return {
    femalePenByAnimalId,
    malePenByAnimalId,
    fatteningPenByAnimalId,
    starterPenByAnimalId
  };
}

export function penCategoryForOnboardingRole(
  role: "maternity" | "male" | "starter" | "fattening" | "default"
): PenCategory {
  switch (role) {
    case "maternity":
      return PenCategory.maternity;
    case "starter":
      return PenCategory.starter;
    case "fattening":
      return PenCategory.fattening;
    default:
      return PenCategory.mixed;
  }
}

export type CreatedPenMeta = {
  id: string;
  barnIndex: number;
  sortOrder: number;
  code: string;
};

export function buildPensByBarnFromDb(
  pens: Array<{
    id: string;
    capacity: number;
    sortOrder: number;
    barn: { sortOrder: number };
    placements: Array<{
      animalId: string | null;
      batch: { headcount: number } | null;
    }>;
  }>,
  buildingsCount: number
): PenSlot[][] {
  const byBarn: PenSlot[][] = Array.from({ length: buildingsCount }, () => []);
  const sorted = [...pens].sort(
    (a, b) =>
      a.barn.sortOrder - b.barn.sortOrder || a.sortOrder - b.sortOrder
  );
  for (const pen of sorted) {
    const barnIndex = pen.barn.sortOrder;
    if (barnIndex < 0 || barnIndex >= buildingsCount) {
      continue;
    }
    let occupancy = 0;
    for (const pl of pen.placements) {
      if (pl.animalId) {
        occupancy += 1;
      } else if (pl.batch) {
        occupancy += pl.batch.headcount;
      }
    }
    byBarn[barnIndex].push({
      id: pen.id,
      capacity: pen.capacity,
      occupancy
    });
  }
  return byBarn;
}

export type PersistPlacementPlanParams = {
  farmId: string;
  userId: string;
  plan: OnboardingPlacementPlan;
  femaleIds: string[];
  maleIds: string[];
  fatteningIds: string[];
  starterIds: string[];
  speciesId: string;
};

type BatchPlacementParams = {
  farmId: string;
  userId: string;
  speciesId: string;
};

async function allocateTagCodesInTx(
  tx: Prisma.TransactionClient,
  farmId: string,
  prefix: "Trui" | "Ver" | "Eng" | "Dem",
  count: number
): Promise<string[]> {
  if (count <= 0) {
    return [];
  }

  await lockFarmRowForUpdate(tx, farmId);

  const counterKey =
    prefix === "Trui"
      ? "lastTruiTagNumber"
      : prefix === "Ver"
        ? "lastVerTagNumber"
        : prefix === "Eng"
          ? "lastEngTagNumber"
          : "lastDemTagNumber";

  const farm = await tx.farm.findUniqueOrThrow({
    where: { id: farmId },
    select: {
      lastTruiTagNumber: true,
      lastVerTagNumber: true,
      lastEngTagNumber: true,
      lastDemTagNumber: true
    }
  });

  let seq = farm[counterKey];
  const codes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    seq += 1;
    codes.push(formatTagCode(prefix, seq));
  }

  await tx.farm.update({
    where: { id: farmId },
    data: { [counterKey]: seq }
  });

  return codes;
}

function productionCategoryForPrefix(
  prefix: "Eng" | "Dem"
): AnimalProductionCategory {
  return prefix === "Eng" ? "fattening" : "starter";
}

async function placeBatchSplitsInTx(
  tx: Prisma.TransactionClient,
  params: BatchPlacementParams,
  splits: Array<{ penId: string; headcount: number }>,
  baseName: string,
  categoryKey: string,
  category: PenCategory,
  unplacedBatches: Array<{ id: string; headcount: number }>
): Promise<number> {
  if (splits.length === 0) {
    return 0;
  }
  let placed = 0;

  if (
    unplacedBatches.length === 1 &&
    splits.length > 1 &&
    unplacedBatches[0].headcount > splits[0].headcount
  ) {
    const source = unplacedBatches[0];
    await tx.livestockBatch.update({
      where: { id: source.id },
      data: {
        headcount: splits[0].headcount,
        name: splits.length > 1 ? `${baseName} 1` : baseName
      }
    });
    await tx.penPlacement.create({
      data: {
        penId: splits[0].penId,
        batchId: source.id,
        createdByUserId: params.userId,
        note: `Affectation onboarding — ${baseName}`
      }
    });
    placed += 1;
    await tx.pen.update({
      where: { id: splits[0].penId },
      data: { category, categoryForced: false }
    });

    for (let i = 1; i < splits.length; i += 1) {
      const part = splits[i];
      const batch = await tx.livestockBatch.create({
        data: {
          farmId: params.farmId,
          speciesId: params.speciesId,
          name: `${baseName} ${i + 1}`,
          categoryKey,
          headcount: part.headcount,
          status: "active",
          notes: "Lot scindé — répartition loges"
        }
      });
      await tx.penPlacement.create({
        data: {
          penId: part.penId,
          batchId: batch.id,
          createdByUserId: params.userId,
          note: `Affectation onboarding — ${baseName}`
        }
      });
      placed += 1;
      await tx.pen.update({
        where: { id: part.penId },
        data: { category, categoryForced: false }
      });
    }
    return placed;
  }

  for (let i = 0; i < splits.length; i += 1) {
    const part = splits[i];
    const existing = unplacedBatches[i];
    const batch =
      existing != null
        ? await tx.livestockBatch.update({
            where: { id: existing.id },
            data: {
              headcount: part.headcount,
              name: splits.length > 1 ? `${baseName} ${i + 1}` : baseName
            }
          })
        : await tx.livestockBatch.create({
            data: {
              farmId: params.farmId,
              speciesId: params.speciesId,
              name: splits.length > 1 ? `${baseName} ${i + 1}` : baseName,
              categoryKey,
              headcount: part.headcount,
              status: "active",
              notes: "Lot créé à l'onboarding (répartition loges)"
            }
          });

    await tx.penPlacement.create({
      data: {
        penId: part.penId,
        batchId: batch.id,
        createdByUserId: params.userId,
        note: `Affectation onboarding — ${baseName}`
      }
    });
    placed += 1;
    await tx.pen.update({
      where: { id: part.penId },
      data: { category, categoryForced: false }
    });
  }
  return placed;
}

async function placeAnimalGroupInTx(
  tx: Prisma.TransactionClient,
  params: PersistPlacementPlanParams,
  animalIds: string[],
  penByAnimalId: Map<string, string>,
  note: string,
  penCategory?: PenCategory
): Promise<number> {
  if (animalIds.length === 0) {
    return 0;
  }
  const alreadyPlaced = new Set(
    (
      await tx.penPlacement.findMany({
        where: {
          endedAt: null,
          animalId: { in: animalIds }
        },
        select: { animalId: true }
      })
    )
      .map((p) => p.animalId)
      .filter((id): id is string => Boolean(id))
  );

  let placed = 0;
  const pensTouched = new Set<string>();

  for (const animalId of animalIds) {
    const penId = penByAnimalId.get(animalId);
    if (!penId || alreadyPlaced.has(animalId)) {
      continue;
    }
    await tx.penPlacement.create({
      data: {
        penId,
        animalId,
        createdByUserId: params.userId,
        note
      }
    });
    pensTouched.add(penId);
    placed += 1;
  }

  if (penCategory) {
    for (const penId of pensTouched) {
      await tx.pen.update({
        where: { id: penId },
        data: { category: penCategory, categoryForced: false }
      });
    }
  }

  return placed;
}

export async function persistOnboardingPlacementPlan(
  tx: Prisma.TransactionClient,
  params: PersistPlacementPlanParams
): Promise<{ animalsPlaced: number; batchesPlaced: number }> {
  let animalsPlaced = 0;

  animalsPlaced += await placeAnimalGroupInTx(
    tx,
    params,
    params.femaleIds,
    params.plan.femalePenByAnimalId,
    "Affectation onboarding — truie",
    penCategoryForOnboardingRole("maternity")
  );
  animalsPlaced += await placeAnimalGroupInTx(
    tx,
    params,
    params.maleIds,
    params.plan.malePenByAnimalId,
    "Affectation onboarding — verrat (1 par loge)",
    penCategoryForOnboardingRole("male")
  );
  animalsPlaced += await placeAnimalGroupInTx(
    tx,
    params,
    params.fatteningIds,
    params.plan.fatteningPenByAnimalId,
    "Affectation onboarding — engraissement",
    penCategoryForOnboardingRole("fattening")
  );
  animalsPlaced += await placeAnimalGroupInTx(
    tx,
    params,
    params.starterIds,
    params.plan.starterPenByAnimalId,
    "Affectation onboarding — démarrage",
    penCategoryForOnboardingRole("starter")
  );

  return { animalsPlaced, batchesPlaced: 0 };
}

/** Renomme bâtiments (A, B…) et loges (A-1, B-2…) selon le plan onboarding. */
export async function normalizeFarmPenNaming(
  tx: Prisma.TransactionClient,
  farmId: string
): Promise<void> {
  const barns = await tx.barn.findMany({
    where: { farmId },
    orderBy: { sortOrder: "asc" }
  });
  for (let i = 0; i < barns.length; i += 1) {
    const code = barnCodeForIndex(i);
    const label = barnLabelForIndex(i);
    await tx.barn.update({
      where: { id: barns[i].id },
      data: { name: label, code }
    });
    const pens = await tx.pen.findMany({
      where: { barnId: barns[i].id },
      orderBy: { sortOrder: "asc" }
    });
    for (const pen of pens) {
      const penCode = penNameForBarn(code, pen.sortOrder);
      await tx.pen.update({
        where: { id: pen.id },
        data: { name: penCode, code: penCode }
      });
    }
  }
}

/** Déplace les lots surpeuplés vers plusieurs loges (scinde le lot si besoin). */
export async function rebalanceOvercrowdedBatchPlacements(
  tx: Prisma.TransactionClient,
  farmId: string,
  userId: string,
  speciesId: string
): Promise<number> {
  const pens = await tx.pen.findMany({
    where: { barn: { farmId } },
    include: {
      barn: { select: { sortOrder: true } },
      placements: {
        where: { endedAt: null },
        include: { batch: { select: { id: true, headcount: true, categoryKey: true, name: true } } }
      }
    },
    orderBy: [{ barn: { sortOrder: "asc" } }, { sortOrder: "asc" }]
  });

  let rebalanced = 0;

  const defaultCap = 12;

  for (const pen of pens) {
    const cap = pen.capacity ?? defaultCap;
    if (cap <= 0) {
      continue;
    }

    let occupancy = 0;
    for (const pl of pen.placements) {
      if (pl.batch) {
        occupancy += pl.batch.headcount;
      } else if (pl.animalId) {
        occupancy += 1;
      }
    }

    if (occupancy <= cap) {
      continue;
    }

    const batchPlacements = pen.placements.filter((pl) => pl.batchId && pl.batch);
    if (batchPlacements.length !== 1 || !batchPlacements[0].batch) {
      continue;
    }

    const pl = batchPlacements[0];
    const batch = pl.batch!;
    const headcount = batch.headcount;

    await tx.penPlacement.update({
      where: { id: pl.id },
      data: { endedAt: new Date() }
    });

    const farm = await tx.farm.findUnique({
      where: { id: farmId },
      select: { housingBuildingsCount: true }
    });
    const buildingsCount = farm?.housingBuildingsCount ?? 2;
    const pensByBarn = buildPensByBarnFromDb(
      pens.map((p) => ({
        id: p.id,
        capacity: p.capacity ?? cap,
        sortOrder: p.sortOrder,
        barn: { sortOrder: p.barn.sortOrder },
        placements: p.placements
          .filter((x) => x.id !== pl.id)
          .map((x) => ({
            animalId: x.animalId,
            batch: x.batch ? { headcount: x.batch.headcount } : null
          }))
      })),
      buildingsCount
    );
    const allSlots = pensByBarn.flat();
    const targetPens = allSlots.filter((s) => freeCapacity(s) > 0);
    const splits = planBatchDistribution(headcount, targetPens);
    if (splits.length === 0) {
      continue;
    }

    const categoryKey = batch.categoryKey ?? "finisher";
    const baseName = batch.name ?? "Lot";
    const category =
      categoryKey === "nursery"
        ? penCategoryForOnboardingRole("starter")
        : penCategoryForOnboardingRole("fattening");

    rebalanced += await placeBatchSplitsInTx(
      tx,
      { farmId, userId, speciesId },
      splits,
      baseName,
      categoryKey,
      category,
      [{ id: batch.id, headcount }]
    );
  }

  return rebalanced;
}

function isNurseryCategoryKey(categoryKey: string | null | undefined): boolean {
  const k = (categoryKey ?? "").toLowerCase();
  return (
    k === "nursery" ||
    k.includes("starter") ||
    k.includes("demarrage") ||
    k.includes("porcelet")
  );
}

async function loadPensForLayout(
  tx: Prisma.TransactionClient,
  farmId: string
) {
  return tx.pen.findMany({
    where: { barn: { farmId } },
    select: {
      id: true,
      capacity: true,
      sortOrder: true,
      barn: { select: { sortOrder: true } },
      placements: {
        where: { endedAt: null },
        select: {
          animalId: true,
          batch: { select: { headcount: true } }
        }
      }
    },
    orderBy: [{ barn: { sortOrder: "asc" } }, { sortOrder: "asc" }]
  });
}

async function forcePlaceBreederAnimals(
  tx: Prisma.TransactionClient,
  userId: string,
  plan: OnboardingPlacementPlan,
  femaleIds: string[],
  maleIds: string[]
): Promise<number> {
  let placed = 0;

  for (const femaleId of femaleIds) {
    const penId = plan.femalePenByAnimalId.get(femaleId);
    if (!penId) {
      continue;
    }
    await tx.penPlacement.create({
      data: {
        penId,
        animalId: femaleId,
        createdByUserId: userId,
        note: "Réaffectation — truie"
      }
    });
    await tx.pen.update({
      where: { id: penId },
      data: {
        category: penCategoryForOnboardingRole("maternity"),
        categoryForced: false
      }
    });
    placed += 1;
  }

  for (const maleId of maleIds) {
    const penId = plan.malePenByAnimalId.get(maleId);
    if (!penId) {
      continue;
    }
    await tx.penPlacement.create({
      data: {
        penId,
        animalId: maleId,
        createdByUserId: userId,
        note: "Réaffectation — verrat (1 par loge)"
      }
    });
    await tx.pen.update({
      where: { id: penId },
      data: {
        category: penCategoryForOnboardingRole("male"),
        categoryForced: false
      }
    });
    placed += 1;
  }

  return placed;
}

/** Réaffecte toutes les truies et verrats selon le plan onboarding (1 verrat / loge). */
export async function relocateBreederAnimalsToDefaultPlan(
  tx: Prisma.TransactionClient,
  farmId: string,
  userId: string,
  buildingsCount: number
): Promise<number> {
  const females = await tx.animal.findMany({
    where: { farmId, status: "active", sex: "female" },
    select: { id: true },
    orderBy: { createdAt: "asc" }
  });
  const males = await tx.animal.findMany({
    where: { farmId, status: "active", sex: "male" },
    select: { id: true },
    orderBy: { createdAt: "asc" }
  });
  const femaleIds = females.map((a) => a.id);
  const maleIds = males.map((a) => a.id);
  if (femaleIds.length === 0 && maleIds.length === 0) {
    return 0;
  }

  await tx.penPlacement.updateMany({
    where: {
      endedAt: null,
      animalId: { in: [...femaleIds, ...maleIds] }
    },
    data: { endedAt: new Date() }
  });

  const pens = await loadPensForLayout(tx, farmId);
  const defaultCap = 12;
  const pensByBarn = buildPensByBarnFromDb(
    pens.map((pen) => ({
      ...pen,
      capacity: pen.capacity ?? defaultCap
    })),
    buildingsCount
  );
  const plan = buildDefaultPlacementPlan({
    pensByBarn,
    femaleIds,
    maleIds,
    fatteningIds: [],
    starterIds: []
  });

  return forcePlaceBreederAnimals(tx, userId, plan, femaleIds, maleIds);
}

/** Convertit les lots onboarding legacy (placement par bande) en animaux individuels. */
export async function migrateOnboardingBatchesToIndividualAnimals(
  tx: Prisma.TransactionClient,
  farmId: string,
  speciesId: string,
  userId: string
): Promise<number> {
  await lockFarmRowForUpdate(tx, farmId);

  const batchPlacements = await tx.penPlacement.findMany({
    where: {
      endedAt: null,
      batchId: { not: null },
      pen: { barn: { farmId } }
    },
    include: {
      batch: {
        select: {
          id: true,
          headcount: true,
          categoryKey: true,
          name: true
        }
      },
      pen: { select: { id: true } }
    }
  });

  let created = 0;

  for (const pl of batchPlacements) {
    if (!pl.batch || pl.batch.headcount <= 0) {
      continue;
    }
    const prefix: "Eng" | "Dem" = isNurseryCategoryKey(pl.batch.categoryKey)
      ? "Dem"
      : "Eng";
    const prodCategory = productionCategoryForPrefix(prefix);
    const tags = await allocateTagCodesInTx(
      tx,
      farmId,
      prefix,
      pl.batch.headcount
    );

    await tx.penPlacement.update({
      where: { id: pl.id },
      data: { endedAt: new Date() }
    });

    const penCategory = penCategoryForOnboardingRole(
      prefix === "Dem" ? "starter" : "fattening"
    );

    for (const tagCode of tags) {
      const animal = await tx.animal.create({
        data: {
          farmId,
          speciesId,
          sex: "unknown",
          status: "active",
          tagCode,
          productionCategory: prodCategory,
          notes: `Migré depuis lot « ${pl.batch.name ?? "lot"} »`
        }
      });
      await tx.penPlacement.create({
        data: {
          penId: pl.pen.id,
          animalId: animal.id,
          createdByUserId: userId,
          note: "Migration lot → sujet individuel"
        }
      });
      created += 1;
    }

    await tx.pen.update({
      where: { id: pl.pen.id },
      data: { category: penCategory, categoryForced: false }
    });

    await tx.livestockBatch.update({
      where: { id: pl.batch.id },
      data: { status: "inactive", headcount: 0 }
    });
  }

  return created;
}

/** Réaffecte les animaux de production (Eng/Dem) sans loge active. */
export async function relocateProductionAnimalsToDefaultPlan(
  tx: Prisma.TransactionClient,
  params: {
    farmId: string;
    userId: string;
    buildingsCount: number;
  }
): Promise<number> {
  const productionAnimals = await tx.animal.findMany({
    where: {
      farmId: params.farmId,
      status: "active",
      productionCategory: { in: ["fattening", "starter"] }
    },
    select: { id: true, productionCategory: true },
    orderBy: { createdAt: "asc" }
  });

  if (productionAnimals.length === 0) {
    return 0;
  }

  const ids = productionAnimals.map((a) => a.id);
  await tx.penPlacement.updateMany({
    where: { endedAt: null, animalId: { in: ids } },
    data: { endedAt: new Date() }
  });

  const pens = await loadPensForLayout(tx, params.farmId);
  const defaultCap = 12;
  const pensByBarn = buildPensByBarnFromDb(
    pens.map((pen) => ({
      ...pen,
      capacity: pen.capacity ?? defaultCap
    })),
    params.buildingsCount
  );

  const fatteningIds = productionAnimals
    .filter((a) => a.productionCategory === "fattening")
    .map((a) => a.id);
  const starterIds = productionAnimals
    .filter((a) => a.productionCategory === "starter")
    .map((a) => a.id);

  const plan = buildDefaultPlacementPlan({
    pensByBarn,
    femaleIds: [],
    maleIds: [],
    fatteningIds,
    starterIds
  });

  const persistParams: PersistPlacementPlanParams = {
    farmId: params.farmId,
    userId: params.userId,
    plan,
    femaleIds: [],
    maleIds: [],
    fatteningIds,
    starterIds,
    speciesId: ""
  };

  let placed = 0;
  placed += await placeAnimalGroupInTx(
    tx,
    persistParams,
    fatteningIds,
    plan.fatteningPenByAnimalId,
    "Réaffectation — engraissement",
    penCategoryForOnboardingRole("fattening")
  );
  placed += await placeAnimalGroupInTx(
    tx,
    persistParams,
    starterIds,
    plan.starterPenByAnimalId,
    "Réaffectation — démarrage",
    penCategoryForOnboardingRole("starter")
  );

  return placed;
}
