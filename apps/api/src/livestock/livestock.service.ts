import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { Animal, User } from "@prisma/client";
import {
  AnimalOrigin,
  AnimalProductionCategory,
  AnimalSex,
  Prisma
} from "@prisma/client";
import { AUDIT_ACTION } from "../common/audit.constants";
import { AuditService } from "../common/audit.service";
import { FarmAccessService } from "../common/farm-access.service";
import { PrismaService } from "../prisma/prisma.service";
import { calculateAnimalAgeWeeks } from "../cheptel/age-calculation.util";
import { PenAllocationService } from "../housing/pen-allocation.service";
import { BulkCreateAnimalsDto } from "./dto/bulk-create-animals.dto";
import { CreateAnimalDto } from "./dto/create-animal.dto";
import { CreateWeightDto } from "./dto/create-weight.dto";
import { PatchAnimalStatusDto } from "./dto/patch-animal-status.dto";
import { UpdateAnimalDto } from "./dto/update-animal.dto";
import { TaxonomyService } from "./taxonomy.service";
import { nextAnimalTagCode, parseTagSequence } from "./animal-tag.helper";
import {
  AnimalProductionTagsService,
  type AnimalTagPrefix
} from "./animal-production-tags.service";

const PORCIN_CODE = "porcin";

function prefixForCategory(
  category: AnimalProductionCategory
): AnimalTagPrefix | null {
  switch (category) {
    case "breeding_female":
      return "Trui";
    case "breeding_male":
      return "Ver";
    case "fattening":
      return "Eng";
    case "starter":
      return "Dem";
    default:
      return null;
  }
}

function defaultSexForCategory(category: AnimalProductionCategory): AnimalSex {
  switch (category) {
    case "breeding_female":
      return "female";
    case "breeding_male":
      return "male";
    default:
      return "unknown";
  }
}

@Injectable()
export class LivestockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxonomy: TaxonomyService,
    private readonly animalTags: AnimalProductionTagsService,
    private readonly farmAccess: FarmAccessService,
    private readonly audit: AuditService,
    private readonly penAllocation: PenAllocationService
  ) {}

  private async resolveSpeciesId(dto: CreateAnimalDto): Promise<string> {
    await this.taxonomy.ensurePorcinSpecies();
    if (dto.speciesId) {
      const s = await this.prisma.species.findFirst({
        where: { id: dto.speciesId }
      });
      if (!s) {
        throw new BadRequestException("Espece inconnue");
      }
      return s.id;
    }
    const porc = await this.prisma.species.findUnique({
      where: { code: PORCIN_CODE }
    });
    if (!porc) {
      throw new BadRequestException("Espece porcin indisponible");
    }
    return porc.id;
  }

  private async assertBreedForSpecies(
    speciesId: string,
    breedId: string | undefined
  ) {
    if (!breedId) {
      return;
    }
    const breed = await this.prisma.breed.findFirst({
      where: { id: breedId, speciesId }
    });
    if (!breed) {
      throw new BadRequestException("Race incompatible avec l'espece");
    }
  }

  /** Corrige tagCode manquants ou doublonnés (ex. plusieurs PORC-001). */
  private async repairAnimalTagCodes(farmId: string): Promise<void> {
    const animals = await this.prisma.animal.findMany({
      where: { farmId },
      orderBy: { createdAt: "asc" },
      select: { id: true, tagCode: true }
    });
    const seen = new Set<string>();
    let needsFix = false;
    for (const a of animals) {
      const key = a.tagCode?.trim().toLowerCase() ?? "";
      if (!key || seen.has(key)) {
        needsFix = true;
        break;
      }
      seen.add(key);
    }
    if (!needsFix) {
      return;
    }
    seen.clear();
    for (const a of animals) {
      const key = a.tagCode?.trim().toLowerCase() ?? "";
      if (!key || seen.has(key)) {
        const next = await nextAnimalTagCode(this.prisma, farmId);
        await this.prisma.animal.update({
          where: { id: a.id },
          data: { tagCode: next }
        });
        seen.add(next.toLowerCase());
      } else {
        seen.add(key);
      }
    }
  }

  async listAnimals(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    await this.repairAnimalTagCodes(farmId);
    const rows = await this.prisma.animal.findMany({
      where: { farmId },
      orderBy: { updatedAt: "desc" },
      include: {
        species: { select: { id: true, code: true, name: true } },
        breed: { select: { id: true, name: true } },
        weights: {
          orderBy: { measuredAt: "desc" },
          take: 1
        },
        penPlacements: {
          where: { endedAt: null },
          take: 1,
          orderBy: { startedAt: "desc" },
          include: {
            pen: {
              select: {
                id: true,
                name: true,
                barn: { select: { id: true, name: true } }
              }
            }
          }
        }
      }
    });

    return rows.map(({ penPlacements, ...animal }) => {
      const active = penPlacements[0] ?? null;
      return {
        ...animal,
        currentPen: active
          ? {
              placementId: active.id,
              penId: active.pen.id,
              penName: active.pen.name,
              barnId: active.pen.barn.id,
              barnName: active.pen.barn.name
            }
          : null
      };
    });
  }

  private async assertUniqueTagCode(
    farmId: string,
    tagCode: string,
    excludeAnimalId?: string
  ) {
    const existing = await this.prisma.animal.findFirst({
      where: {
        farmId,
        tagCode: { equals: tagCode, mode: "insensitive" },
        ...(excludeAnimalId ? { id: { not: excludeAnimalId } } : {})
      },
      select: { id: true }
    });
    if (existing) {
      throw new BadRequestException(
        `Identifiant « ${tagCode} » déjà utilisé sur cette ferme`
      );
    }
  }

  async createAnimal(
    user: User,
    farmId: string,
    dto: CreateAnimalDto
  ): Promise<Animal> {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const speciesId = await this.resolveSpeciesId(dto);
    await this.assertBreedForSpecies(speciesId, dto.breedId);

    const productionCategory =
      dto.productionCategory ?? AnimalProductionCategory.unknown;

    let tagCode = dto.tagCode?.trim() || null;
    if (!tagCode) {
      const prefix = prefixForCategory(productionCategory);
      tagCode = prefix
        ? await this.animalTags.nextTagCode(farmId, prefix)
        : await nextAnimalTagCode(this.prisma, farmId);
    } else if (!parseTagSequence(tagCode)) {
      throw new BadRequestException(
        "Format d'identifiant invalide — utilisez ex. Trui-001"
      );
    }
    await this.assertUniqueTagCode(farmId, tagCode);

    const sex = dto.sex ?? defaultSexForCategory(productionCategory);
    const entryDate = new Date();
    entryDate.setUTCHours(0, 0, 0, 0);

    return this.prisma.animal.create({
      data: {
        farmId,
        speciesId,
        breedId: dto.breedId,
        tagCode,
        sex,
        productionCategory,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        entryDate,
        ageWeeksAtEntry:
          dto.birthDate == null && dto.ageWeeksAtEntry != null
            ? dto.ageWeeksAtEntry
            : undefined,
        notes: dto.notes
      }
    });
  }

  async bulkCreateAnimals(
    user: User,
    farmId: string,
    dto: BulkCreateAnimalsDto
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const prefix = prefixForCategory(dto.productionCategory);
    if (!prefix) {
      throw new BadRequestException(
        "Catégorie non prise en charge pour la création en masse"
      );
    }

    const speciesId = await this.resolveSpeciesId({});
    await this.assertBreedForSpecies(speciesId, dto.breedId);

    const entryDate = new Date(dto.entryDate);
    if (Number.isNaN(entryDate.getTime())) {
      throw new BadRequestException("Date d'entrée invalide");
    }
    entryDate.setUTCHours(0, 0, 0, 0);

    const sex = dto.sex ?? defaultSexForCategory(dto.productionCategory);
    if (dto.productionCategory === "breeding_female" && sex !== "female") {
      throw new BadRequestException("Les truies doivent être de sexe femelle");
    }
    if (dto.productionCategory === "breeding_male" && sex !== "male") {
      throw new BadRequestException("Les verrats doivent être de sexe mâle");
    }

    const entryWeightDecimal =
      dto.entryWeightKg != null
        ? new Prisma.Decimal(dto.entryWeightKg)
        : undefined;

    return this.prisma.$transaction(async (tx) => {
      const tagCodes = await this.animalTags.allocateTagCodes(
        farmId,
        prefix,
        dto.count,
        tx
      );

      const createdAnimals: Animal[] = [];
      for (const tagCode of tagCodes) {
        const animal = await tx.animal.create({
          data: {
            farmId,
            speciesId,
            breedId: dto.breedId ?? null,
            tagCode,
            sex,
            status: "active",
            productionCategory: dto.productionCategory,
            entryDate,
            ageWeeksAtEntry: dto.ageWeeksAtEntry ?? null,
            entryWeightKg: entryWeightDecimal ?? null,
            origin: dto.origin,
            supplier:
              dto.origin === AnimalOrigin.purchased
                ? dto.supplier?.trim() || null
                : null,
            notes: dto.notes?.trim() || null
          }
        });
        if (entryWeightDecimal != null) {
          await tx.animalWeight.create({
            data: {
              animalId: animal.id,
              weightKg: entryWeightDecimal,
              measuredAt: entryDate
            }
          });
        }
        createdAnimals.push(animal);
      }

      let placedInPenCount = 0;
      if (dto.penId) {
        const pen = await tx.pen.findFirst({
          where: { id: dto.penId, barn: { farmId } },
          select: { id: true, capacity: true, status: true }
        });
        if (!pen) {
          throw new NotFoundException("Loge introuvable");
        }
        if (pen.status === "inactive") {
          throw new BadRequestException("Loge inactive");
        }

        let occupancy = await this.penAllocation.countActiveOccupancy(
          tx,
          pen.id
        );
        const capacity = pen.capacity ?? 0;

        for (const animal of createdAnimals) {
          if (capacity > 0 && occupancy >= capacity) {
            break;
          }
          await tx.penPlacement.updateMany({
            where: {
              animalId: animal.id,
              endedAt: null,
              pen: { barn: { farmId } }
            },
            data: { endedAt: new Date() }
          });
          await this.penAllocation.assertAnimalPenCompatible(
            tx,
            animal.id,
            pen.id
          );
          await tx.penPlacement.create({
            data: {
              penId: pen.id,
              animalId: animal.id,
              createdByUserId: user.id
            }
          });
          occupancy += 1;
          placedInPenCount += 1;
        }

        await this.penAllocation.recalculatePenCategory(tx, pen.id);
        if (entryWeightDecimal != null) {
          await this.penAllocation.recalculatePenAverageWeight(tx, pen.id);
        }
      }

      return {
        animalsCreated: createdAnimals,
        firstNumber: tagCodes[0] ?? "",
        lastNumber: tagCodes[tagCodes.length - 1] ?? "",
        count: createdAnimals.length,
        placedInPenCount,
        unplacedCount: createdAnimals.length - placedInPenCount
      };
    });
  }

  private async getAnimalOnFarm(
    user: User,
    farmId: string,
    animalId: string
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const animal = await this.prisma.animal.findFirst({
      where: { id: animalId, farmId }
    });
    if (!animal) {
      throw new NotFoundException("Animal introuvable");
    }
    return animal;
  }

  private readonly animalDetailInclude = {
    species: { select: { id: true, code: true, name: true } },
    breed: { select: { id: true, name: true } },
    dam: { select: { id: true, tagCode: true, publicId: true } },
    sire: { select: { id: true, tagCode: true, publicId: true } },
    weights: { orderBy: { measuredAt: "desc" as const }, take: 30 }
  };

  private async assertPedigreeParent(
    farmId: string,
    parentId: string,
    expectedSex: AnimalSex,
    animalId: string
  ) {
    if (parentId === animalId) {
      throw new BadRequestException(
        "Un animal ne peut pas être sa propre ascendance"
      );
    }
    const parent = await this.prisma.animal.findFirst({
      where: { id: parentId, farmId, status: "active" },
      select: { id: true, sex: true }
    });
    if (!parent) {
      throw new BadRequestException("Parent introuvable sur cette ferme");
    }
    if (parent.sex !== expectedSex) {
      throw new BadRequestException(
        expectedSex === "female"
          ? "La mère doit être une truie (sexe femelle)"
          : "Le père doit être un verrat (sexe mâle)"
      );
    }
  }

  private enrichAnimalDetail<
    T extends {
      birthDate: Date | null;
      ageWeeksAtEntry: number | null;
      entryDate: Date | null;
    }
  >(row: T) {
    const currentAgeWeeks = calculateAnimalAgeWeeks({
      birthDate: row.birthDate,
      ageWeeksAtEntry: row.ageWeeksAtEntry,
      entryDate: row.entryDate
    });
    return {
      ...row,
      entryDate: row.entryDate?.toISOString().slice(0, 10) ?? null,
      currentAgeWeeks
    };
  }

  async getAnimal(user: User, farmId: string, animalId: string) {
    await this.getAnimalOnFarm(user, farmId, animalId);
    const row = await this.prisma.animal.findFirst({
      where: { id: animalId, farmId },
      include: this.animalDetailInclude
    });
    if (!row) {
      throw new NotFoundException("Animal introuvable");
    }
    return this.enrichAnimalDetail(row);
  }

  async updateAnimal(
    user: User,
    farmId: string,
    animalId: string,
    dto: UpdateAnimalDto
  ) {
    const animal = await this.getAnimalOnFarm(user, farmId, animalId);

    if (dto.breedId !== undefined && dto.breedId !== null) {
      await this.assertBreedForSpecies(animal.speciesId, dto.breedId);
    }

    const prevStatus = animal.status;
    const nextStatus =
      dto.status !== undefined ? dto.status : prevStatus;
    const statusChanging =
      dto.status !== undefined && dto.status !== prevStatus;

    if (dto.tagCode !== undefined && dto.tagCode !== null) {
      const trimmed = dto.tagCode.trim();
      if (trimmed && !parseTagSequence(trimmed)) {
        throw new BadRequestException(
          "Format d'identifiant invalide — utilisez ex. Trui-001"
        );
      }
      if (trimmed) {
        await this.assertUniqueTagCode(farmId, trimmed, animalId);
      }
    }

    const effectiveOrigin =
      dto.origin !== undefined ? dto.origin : animal.origin;

    if (dto.damId) {
      await this.assertPedigreeParent(farmId, dto.damId, "female", animalId);
    }
    if (dto.sireId) {
      await this.assertPedigreeParent(farmId, dto.sireId, "male", animalId);
    }

    let damId: string | null | undefined;
    let sireId: string | null | undefined;
    if (effectiveOrigin === AnimalOrigin.purchased) {
      damId = null;
      sireId = null;
    } else {
      if (dto.damId !== undefined) {
        damId = dto.damId;
      }
      if (dto.sireId !== undefined) {
        sireId = dto.sireId;
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.animal.update({
        where: { id: animalId },
        data: {
          ...(dto.breedId !== undefined ? { breedId: dto.breedId } : {}),
          ...(dto.tagCode !== undefined ? { tagCode: dto.tagCode?.trim() || null } : {}),
          ...(dto.sex !== undefined ? { sex: dto.sex } : {}),
          ...(dto.productionCategory !== undefined
            ? { productionCategory: dto.productionCategory }
            : {}),
          ...(dto.birthDate !== undefined
            ? {
                birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
                ...(dto.birthDate
                  ? { ageWeeksAtEntry: null }
                  : {})
              }
            : {}),
          ...(dto.ageWeeksAtEntry !== undefined
            ? { ageWeeksAtEntry: dto.ageWeeksAtEntry }
            : {}),
          ...(dto.entryDate !== undefined
            ? {
                entryDate: dto.entryDate ? new Date(dto.entryDate) : null
              }
            : {}),
          ...(dto.origin !== undefined ? { origin: dto.origin } : {}),
          ...(dto.supplier !== undefined
            ? { supplier: dto.supplier?.trim() || null }
            : {}),
          ...(dto.photoUrl !== undefined
            ? { photoUrl: dto.photoUrl?.trim() || null }
            : {}),
          ...(damId !== undefined ? { damId } : {}),
          ...(sireId !== undefined ? { sireId } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {})
        }
      });
      if (statusChanging) {
        await tx.livestockStatusLog.create({
          data: {
            farmId,
            recordedByUserId: user.id,
            entityType: "animal",
            entityId: animalId,
            oldStatus: prevStatus,
            newStatus: nextStatus,
            note: null
          }
        });
      }
    });

    const updated = await this.prisma.animal.findFirst({
      where: { id: animalId, farmId },
      include: this.animalDetailInclude
    });
    if (!updated) {
      throw new NotFoundException("Animal introuvable");
    }
    return this.enrichAnimalDetail(updated);
  }

  async patchAnimalStatus(
    user: User,
    farmId: string,
    animalId: string,
    dto: PatchAnimalStatusDto
  ) {
    if (dto.status === "sold") {
      throw new BadRequestException(
        "Utilisez PATCH /cheptel/animals/:id/sell pour enregistrer une vente"
      );
    }
    const animal = await this.getAnimalOnFarm(user, farmId, animalId);
    if (animal.status === dto.status) {
      return this.getAnimal(user, farmId, animalId);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.animal.update({
        where: { id: animalId },
        data: { status: dto.status }
      });
      await tx.livestockStatusLog.create({
        data: {
          farmId,
          recordedByUserId: user.id,
          entityType: "animal",
          entityId: animalId,
          oldStatus: animal.status,
          newStatus: dto.status,
          note: dto.note ?? null
        }
      });
    });
    return this.getAnimal(user, farmId, animalId);
  }

  async deleteAnimal(user: User, farmId: string, animalId: string) {
    const animal = await this.getAnimalOnFarm(user, farmId, animalId);
    await this.prisma.animal.delete({ where: { id: animalId } });
    await this.audit.record({
      actorUserId: user.id,
      farmId,
      action: AUDIT_ACTION.animalDeleted,
      resourceType: "Animal",
      resourceId: animalId,
      metadata: {
        publicId: animal.publicId,
        tagCode: animal.tagCode ?? undefined
      }
    });
  }

  async addWeight(
    user: User,
    farmId: string,
    animalId: string,
    dto: CreateWeightDto
  ) {
    await this.getAnimalOnFarm(user, farmId, animalId);
    return this.prisma.animalWeight.create({
      data: {
        animalId,
        weightKg: new Prisma.Decimal(dto.weightKg),
        measuredAt: dto.measuredAt ? new Date(dto.measuredAt) : new Date(),
        note: dto.note
      }
    });
  }
}
