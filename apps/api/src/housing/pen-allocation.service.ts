import {
  BadRequestException,
  Injectable,
  Logger
} from "@nestjs/common";
import {
  AnimalProductionCategory,
  PenCategory,
  Prisma,
  type Prisma as PrismaTypes
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/** Rôle d'affectation — une seule catégorie par loge. */
export type AnimalAllocationRole =
  | "breeding_female"
  | "breeding_male"
  | "fattening"
  | "starter";

export type PenSlot = {
  id: string;
  capacity: number;
  occupancy: number;
  /** Catégorie réservée à la création onboarding (null = loge spare mixed). */
  reservedFor: AnimalAllocationRole | "spare" | null;
};

export type OnboardingPlacementPlan = {
  femalePenByAnimalId: Map<string, string>;
  malePenByAnimalId: Map<string, string>;
  fatteningPenByAnimalId: Map<string, string>;
  starterPenByAnimalId: Map<string, string>;
};

export type PenAllocationRow = {
  animalId: string;
  penId: string | null;
  role: AnimalAllocationRole;
};

export type PenCompatibilityResult =
  | { ok: true }
  | { ok: false; reason: string };

@Injectable()
export class PenAllocationService {
  private readonly logger = new Logger(PenAllocationService.name);

  constructor(private readonly prisma: PrismaService) {}

  static roleFromAnimal(animal: {
    sex: string;
    productionCategory: AnimalProductionCategory;
    tagCode?: string | null;
  }): AnimalAllocationRole | null {
    switch (animal.productionCategory) {
      case "breeding_female":
        return "breeding_female";
      case "breeding_male":
        return "breeding_male";
      case "fattening":
        return "fattening";
      case "starter":
        return "starter";
      default:
        break;
    }
    const tag = (animal.tagCode ?? "").trim();
    if (tag.startsWith("Trui")) {
      return "breeding_female";
    }
    if (tag.startsWith("Ver")) {
      return "breeding_male";
    }
    if (tag.startsWith("Eng")) {
      return "fattening";
    }
    if (tag.startsWith("Dem")) {
      return "starter";
    }
    if (animal.sex === "female") {
      return "breeding_female";
    }
    if (animal.sex === "male") {
      return "breeding_male";
    }
    return null;
  }

  static penCategoryForRole(
    role: AnimalAllocationRole | "spare"
  ): PenCategory {
    switch (role) {
      case "breeding_female":
        return PenCategory.maternity;
      case "breeding_male":
      case "spare":
        return PenCategory.mixed;
      case "fattening":
        return PenCategory.fattening;
      case "starter":
        return PenCategory.starter;
      default:
        return PenCategory.mixed;
    }
  }

  static pensNeeded(
    count: number,
    capacity: number,
    onePerPen: boolean
  ): number {
    if (count <= 0) {
      return 0;
    }
    if (onePerPen) {
      return count;
    }
    const cap = Math.max(1, capacity);
    return Math.ceil(count / cap);
  }

  /**
   * Réserve chaque loge pour une catégorie (priorité : truies → verrats → engraissement → démarrage → spare).
   */
  static assignPenReservationsAtOnboarding(
    pens: Array<{ id: string; barnIndex: number; sortOrder: number }>,
    counts: {
      female: number;
      male: number;
      fattening: number;
      starter: number;
    },
    capacity: number
  ): Map<string, AnimalAllocationRole | "spare"> {
    const sorted = [...pens].sort(
      (a, b) =>
        a.barnIndex - b.barnIndex || a.sortOrder - b.sortOrder
    );
    const result = new Map<string, AnimalAllocationRole | "spare">();
    let idx = 0;

    const segments: Array<{
      role: AnimalAllocationRole | "spare";
      count: number;
    }> = [
      {
        role: "breeding_female",
        count: PenAllocationService.pensNeeded(
          counts.female,
          capacity,
          false
        )
      },
      {
        role: "breeding_male",
        count: PenAllocationService.pensNeeded(counts.male, capacity, true)
      },
      {
        role: "fattening",
        count: PenAllocationService.pensNeeded(
          counts.fattening,
          capacity,
          false
        )
      },
      {
        role: "starter",
        count: PenAllocationService.pensNeeded(
          counts.starter,
          capacity,
          false
        )
      }
    ];

    for (const seg of segments) {
      for (let k = 0; k < seg.count && idx < sorted.length; k += 1, idx += 1) {
        result.set(sorted[idx].id, seg.role);
      }
    }
    while (idx < sorted.length) {
      result.set(sorted[idx].id, "spare");
      idx += 1;
    }
    return result;
  }

  static buildPenSlotsForOnboarding(
    pens: Array<{ id: string; capacity: number }>,
    reservations: Map<string, AnimalAllocationRole | "spare">
  ): PenSlot[] {
    return pens.map((p) => ({
      id: p.id,
      capacity: p.capacity,
      occupancy: 0,
      reservedFor: reservations.get(p.id) ?? "spare"
    }));
  }

  private static freeCapacity(pen: PenSlot): number {
    return Math.max(0, pen.capacity - pen.occupancy);
  }

  private static occupy(pen: PenSlot, amount: number) {
    pen.occupancy += amount;
  }

  /** Une tête par place, loges du pool uniquement (pas de débordement). */
  static planIndividualAnimalPlacements(
    animalIds: string[],
    pens: PenSlot[]
  ): Map<string, string> {
    const map = new Map<string, string>();
    if (animalIds.length === 0 || pens.length === 0) {
      return map;
    }
    const slots = pens.map((p) => ({ ...p }));
    let penIdx = 0;
    for (const animalId of animalIds) {
      while (
        penIdx < slots.length &&
        PenAllocationService.freeCapacity(slots[penIdx]) < 1
      ) {
        penIdx += 1;
      }
      if (penIdx >= slots.length) {
        break;
      }
      const pen = slots[penIdx];
      map.set(animalId, pen.id);
      PenAllocationService.occupy(pen, 1);
      if (PenAllocationService.freeCapacity(pen) < 1) {
        penIdx += 1;
      }
    }
    return map;
  }

  static allocateAnimalsAtOnboarding(
    pens: PenSlot[],
    params: {
      femaleIds: string[];
      maleIds: string[];
      fatteningIds: string[];
      starterIds: string[];
    }
  ): OnboardingPlacementPlan {
    const pool = (role: AnimalAllocationRole) =>
      pens.filter((p) => p.reservedFor === role);

    return {
      femalePenByAnimalId: PenAllocationService.planIndividualAnimalPlacements(
        params.femaleIds,
        pool("breeding_female")
      ),
      malePenByAnimalId: PenAllocationService.planIndividualAnimalPlacements(
        params.maleIds,
        pool("breeding_male")
      ),
      fatteningPenByAnimalId:
        PenAllocationService.planIndividualAnimalPlacements(
          params.fatteningIds,
          pool("fattening")
        ),
      starterPenByAnimalId: PenAllocationService.planIndividualAnimalPlacements(
        params.starterIds,
        pool("starter")
      )
    };
  }

  validatePenCompatibility(
    animal: {
      sex: string;
      productionCategory: AnimalProductionCategory;
      tagCode?: string | null;
    },
    pen: {
      category: PenCategory | null;
      capacity: number | null;
      status: string;
      activeOccupancy: number;
    }
  ): PenCompatibilityResult {
    if (pen.status === "inactive") {
      return { ok: false, reason: "Loge inactive" };
    }
    const role = PenAllocationService.roleFromAnimal(animal);
    if (!role) {
      return { ok: false, reason: "Catégorie animal indéterminée" };
    }
    const cap = pen.capacity ?? 0;
    if (cap > 0 && pen.activeOccupancy >= cap) {
      return { ok: false, reason: "Capacité maximale atteinte" };
    }
    const category = pen.category ?? PenCategory.mixed;
    if (!PenAllocationService.penAcceptsRole(category, role)) {
      return {
        ok: false,
        reason: `La loge (${category}) n'accepte pas ce type d'animal (${role})`
      };
    }
    return { ok: true };
  }

  static penAcceptsRole(
    penCategory: PenCategory,
    role: AnimalAllocationRole
  ): boolean {
    switch (role) {
      case "breeding_female":
        return penCategory === PenCategory.maternity;
      case "breeding_male":
        return penCategory === PenCategory.mixed;
      case "fattening":
        return penCategory === PenCategory.fattening;
      case "starter":
        return penCategory === PenCategory.starter;
      default:
        return false;
    }
  }

  async recalculatePenCategory(
    tx: PrismaTypes.TransactionClient,
    penId: string
  ): Promise<PenCategory> {
    const pen = await tx.pen.findUnique({
      where: { id: penId },
      select: {
        categoryForced: true,
        placements: {
          where: { endedAt: null },
          select: {
            animal: {
              select: {
                sex: true,
                productionCategory: true,
                tagCode: true
              }
            },
            batch: { select: { categoryKey: true, headcount: true } }
          }
        }
      }
    });
    if (!pen) {
      return PenCategory.empty;
    }
    if (pen.categoryForced) {
      const row = await tx.pen.findUnique({
        where: { id: penId },
        select: { category: true }
      });
      return row?.category ?? PenCategory.empty;
    }

    const roles = new Set<AnimalAllocationRole>();
    let occupancy = 0;
    for (const pl of pen.placements) {
      if (pl.animal) {
        occupancy += 1;
        const role = PenAllocationService.roleFromAnimal(pl.animal);
        if (role) {
          roles.add(role);
        }
      } else if (pl.batch) {
        occupancy += pl.batch.headcount;
        const key = (pl.batch.categoryKey ?? "").toLowerCase();
        if (
          key.includes("nursery") ||
          key.includes("starter") ||
          key.includes("demarrage")
        ) {
          roles.add("starter");
        } else {
          roles.add("fattening");
        }
      }
    }

    let category: PenCategory;
    if (occupancy === 0) {
      category = PenCategory.empty;
    } else if (roles.size > 1) {
      category = PenCategory.mixed;
    } else if (roles.size === 1) {
      const [only] = [...roles];
      category = PenAllocationService.penCategoryForRole(only);
    } else {
      category = PenCategory.mixed;
    }

    await tx.pen.update({
      where: { id: penId },
      data: { category, categoryForced: false }
    });
    return category;
  }

  async countActiveOccupancy(
    tx: PrismaTypes.TransactionClient,
    penId: string
  ): Promise<number> {
    const placements = await tx.penPlacement.findMany({
      where: { penId, endedAt: null },
      include: {
        batch: { select: { headcount: true } }
      }
    });
    let n = 0;
    for (const pl of placements) {
      if (pl.animalId) {
        n += 1;
      } else if (pl.batch) {
        n += pl.batch.headcount;
      }
    }
    return n;
  }

  async assertAnimalPenCompatible(
    tx: PrismaTypes.TransactionClient,
    animalId: string,
    penId: string
  ): Promise<void> {
    const [animal, pen] = await Promise.all([
      tx.animal.findUnique({
        where: { id: animalId },
        select: {
          sex: true,
          productionCategory: true,
          tagCode: true
        }
      }),
      tx.pen.findUnique({
        where: { id: penId },
        select: {
          category: true,
          capacity: true,
          status: true
        }
      })
    ]);
    if (!animal || !pen) {
      throw new BadRequestException("Animal ou loge introuvable");
    }
    const occupancy = await this.countActiveOccupancy(tx, penId);
    const check = this.validatePenCompatibility(animal, {
      category: pen.category,
      capacity: pen.capacity,
      status: pen.status,
      activeOccupancy: occupancy
    });
    if (!check.ok) {
      throw new BadRequestException(check.reason);
    }
  }

  /** Détecte les loges avec plusieurs catégories d'animaux actifs. */
  async findMixedCategoryPenIds(farmId: string): Promise<string[]> {
    const pens = await this.prisma.pen.findMany({
      where: { barn: { farmId } },
      select: {
        id: true,
        placements: {
          where: { endedAt: null, animalId: { not: null } },
          select: {
            animal: {
              select: {
                sex: true,
                productionCategory: true,
                tagCode: true
              }
            }
          }
        }
      }
    });
    const mixed: string[] = [];
    for (const pen of pens) {
      const roles = new Set<AnimalAllocationRole>();
      for (const pl of pen.placements) {
        if (!pl.animal) {
          continue;
        }
        const role = PenAllocationService.roleFromAnimal(pl.animal);
        if (role) {
          roles.add(role);
        }
      }
      if (roles.size > 1) {
        mixed.push(pen.id);
      }
    }
    return mixed;
  }

  static buildPensByBarnFromDb(
    pens: Array<{
      id: string;
      capacity: number;
      sortOrder: number;
      category: PenCategory | null;
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
      const reservedFor =
        pen.category != null && pen.category !== PenCategory.empty
          ? PenAllocationService.reservedForFromPenCategory(pen.category)
          : "spare";
      byBarn[barnIndex].push({
        id: pen.id,
        capacity: pen.capacity,
        occupancy,
        reservedFor
      });
    }
    return byBarn;
  }

  private static reservedForFromPenCategory(
    category: PenCategory
  ): AnimalAllocationRole | "spare" {
    switch (category) {
      case PenCategory.maternity:
        return "breeding_female";
      case PenCategory.fattening:
        return "fattening";
      case PenCategory.starter:
        return "starter";
      case PenCategory.mixed:
        return "breeding_male";
      default:
        return "spare";
    }
  }

  /**
   * Corrige les loges mixtes : désassigne, réassigne par catégorie, met à jour batch_type des loges.
   */
  async fixFarmPenAllocation(
    farmId: string,
    userId: string
  ): Promise<{
    mixedPensCleared: number;
    animalsReassigned: number;
    animalsUnplaced: string[];
    pensCategoryUpdated: number;
  }> {
    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      select: {
        housingBuildingsCount: true,
        housingPensPerBuilding: true,
        speciesFocus: true
      }
    });
    if (!farm?.housingBuildingsCount) {
      throw new BadRequestException("Ferme ou loges introuvables");
    }
    const buildingsCount = farm.housingBuildingsCount;
    const defaultCap = 12;

    return this.prisma.$transaction(
      async (tx) => {
        const mixedPenIds = await this.findMixedCategoryPenIdsInTx(tx, farmId);
        const animalsToReassign: string[] = [];

        if (mixedPenIds.length > 0) {
          const placements = await tx.penPlacement.findMany({
            where: {
              penId: { in: mixedPenIds },
              endedAt: null,
              animalId: { not: null }
            },
            select: { animalId: true }
          });
          for (const pl of placements) {
            if (pl.animalId) {
              animalsToReassign.push(pl.animalId);
            }
          }
          await tx.penPlacement.updateMany({
            where: {
              penId: { in: mixedPenIds },
              endedAt: null,
              animalId: { not: null }
            },
            data: { endedAt: new Date() }
          });
        }

        const unplacedProduction = await tx.animal.findMany({
          where: {
            farmId,
            status: "active",
            productionCategory: { in: ["fattening", "starter"] },
            penPlacements: { none: { endedAt: null } }
          },
          select: { id: true }
        });
        const unplacedBreeders = await tx.animal.findMany({
          where: {
            farmId,
            status: "active",
            productionCategory: {
              in: ["breeding_female", "breeding_male"]
            },
            penPlacements: { none: { endedAt: null } }
          },
          select: { id: true, productionCategory: true, sex: true }
        });

        const allReassignIds = [
          ...new Set([
            ...animalsToReassign,
            ...unplacedProduction.map((a) => a.id),
            ...unplacedBreeders.map((a) => a.id)
          ])
        ];

        if (allReassignIds.length === 0 && mixedPenIds.length === 0) {
          return {
            mixedPensCleared: 0,
            animalsReassigned: 0,
            animalsUnplaced: [],
            pensCategoryUpdated: 0
          };
        }

        const animals = await tx.animal.findMany({
          where: { id: { in: allReassignIds } },
          select: {
            id: true,
            sex: true,
            productionCategory: true,
            tagCode: true
          },
          orderBy: { createdAt: "asc" }
        });

        const femaleIds: string[] = [];
        const maleIds: string[] = [];
        const fatteningIds: string[] = [];
        const starterIds: string[] = [];
        for (const a of animals) {
          const role = PenAllocationService.roleFromAnimal(a);
          if (role === "breeding_female") {
            femaleIds.push(a.id);
          } else if (role === "breeding_male") {
            maleIds.push(a.id);
          } else if (role === "fattening") {
            fatteningIds.push(a.id);
          } else if (role === "starter") {
            starterIds.push(a.id);
          }
        }

        const pens = await tx.pen.findMany({
          where: { barn: { farmId } },
          select: {
            id: true,
            capacity: true,
            sortOrder: true,
            category: true,
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

        const reservations = PenAllocationService.assignPenReservationsAtOnboarding(
          pens.map((p) => ({
            id: p.id,
            barnIndex: p.barn.sortOrder,
            sortOrder: p.sortOrder
          })),
          {
            female: femaleIds.length,
            male: maleIds.length,
            fattening: fatteningIds.length,
            starter: starterIds.length
          },
          pens[0]?.capacity ?? defaultCap
        );

        for (const [penId, reserved] of reservations) {
          const cat =
            reserved === "spare"
              ? PenCategory.mixed
              : PenAllocationService.penCategoryForRole(reserved);
          await tx.pen.update({
            where: { id: penId },
            data: { category: cat, categoryForced: false }
          });
        }

        const slots = PenAllocationService.buildPenSlotsForOnboarding(
          pens.map((p) => ({
            id: p.id,
            capacity: p.capacity ?? defaultCap
          })),
          reservations
        );
        for (const pen of pens) {
          const slot = slots.find((s) => s.id === pen.id);
          if (!slot) {
            continue;
          }
          let occ = 0;
          for (const pl of pen.placements) {
            if (pl.animalId) {
              occ += 1;
            } else if (pl.batch) {
              occ += pl.batch.headcount;
            }
          }
          slot.occupancy = occ;
        }

        const plan = PenAllocationService.allocateAnimalsAtOnboarding(slots, {
          femaleIds,
          maleIds,
          fatteningIds,
          starterIds
        });

        const placedIds = new Set<string>();
        let animalsReassigned = 0;

        const placeGroup = async (
          ids: string[],
          map: Map<string, string>,
          note: string
        ) => {
          for (const animalId of ids) {
            const penId = map.get(animalId);
            if (!penId) {
              continue;
            }
            await tx.penPlacement.create({
              data: {
                penId,
                animalId,
                createdByUserId: userId,
                note
              }
            });
            placedIds.add(animalId);
            animalsReassigned += 1;
            await this.recalculatePenCategory(tx, penId);
          }
        };

        await placeGroup(
          femaleIds,
          plan.femalePenByAnimalId,
          "Correction allocation — truie"
        );
        await placeGroup(
          maleIds,
          plan.malePenByAnimalId,
          "Correction allocation — verrat"
        );
        await placeGroup(
          fatteningIds,
          plan.fatteningPenByAnimalId,
          "Correction allocation — engraissement"
        );
        await placeGroup(
          starterIds,
          plan.starterPenByAnimalId,
          "Correction allocation — démarrage"
        );

        const animalsUnplaced = allReassignIds.filter(
          (id) => !placedIds.has(id)
        );
        if (animalsUnplaced.length > 0) {
          this.logger.warn(
            `Ferme ${farmId}: ${animalsUnplaced.length} animal(aux) sans loge (capacité insuffisante)`
          );
        }

        const penIds = pens.map((p) => p.id);
        for (const penId of penIds) {
          await this.recalculatePenCategory(tx, penId);
        }

        return {
          mixedPensCleared: mixedPenIds.length,
          animalsReassigned,
          animalsUnplaced,
          pensCategoryUpdated: penIds.length
        };
      },
      { maxWait: 10_000, timeout: 120_000 }
    );
  }

  private async findMixedCategoryPenIdsInTx(
    tx: PrismaTypes.TransactionClient,
    farmId: string
  ): Promise<string[]> {
    const pens = await tx.pen.findMany({
      where: { barn: { farmId } },
      select: {
        id: true,
        placements: {
          where: { endedAt: null, animalId: { not: null } },
          select: {
            animal: {
              select: {
                sex: true,
                productionCategory: true,
                tagCode: true
              }
            }
          }
        }
      }
    });
    const mixed: string[] = [];
    for (const pen of pens) {
      const roles = new Set<AnimalAllocationRole>();
      for (const pl of pen.placements) {
        if (!pl.animal) {
          continue;
        }
        const role = PenAllocationService.roleFromAnimal(pl.animal);
        if (role) {
          roles.add(role);
        }
      }
      if (roles.size > 1) {
        mixed.push(pen.id);
      }
    }
    return mixed;
  }
}
