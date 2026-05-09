import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { Animal, User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { AUDIT_ACTION } from "../common/audit.constants";
import { AuditService } from "../common/audit.service";
import { FarmAccessService } from "../common/farm-access.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAnimalDto } from "./dto/create-animal.dto";
import { CreateWeightDto } from "./dto/create-weight.dto";
import { UpdateAnimalDto } from "./dto/update-animal.dto";
import { TaxonomyService } from "./taxonomy.service";

const PORCIN_CODE = "porcin";

@Injectable()
export class LivestockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxonomy: TaxonomyService,
    private readonly farmAccess: FarmAccessService,
    private readonly audit: AuditService
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

  async listAnimals(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    return this.prisma.animal.findMany({
      where: { farmId },
      orderBy: { updatedAt: "desc" },
      include: {
        species: { select: { id: true, code: true, name: true } },
        breed: { select: { id: true, name: true } },
        weights: {
          orderBy: { measuredAt: "desc" },
          take: 1
        }
      }
    });
  }

  async createAnimal(
    user: User,
    farmId: string,
    dto: CreateAnimalDto
  ): Promise<Animal> {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const speciesId = await this.resolveSpeciesId(dto);
    await this.assertBreedForSpecies(speciesId, dto.breedId);

    return this.prisma.animal.create({
      data: {
        farmId,
        speciesId,
        breedId: dto.breedId,
        tagCode: dto.tagCode,
        sex: dto.sex ?? "unknown",
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        notes: dto.notes
      }
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

  async getAnimal(user: User, farmId: string, animalId: string) {
    await this.getAnimalOnFarm(user, farmId, animalId);
    return this.prisma.animal.findFirst({
      where: { id: animalId, farmId },
      include: {
        species: { select: { id: true, code: true, name: true } },
        breed: { select: { id: true, name: true } },
        weights: { orderBy: { measuredAt: "desc" }, take: 30 }
      }
    });
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

    return this.prisma.animal.update({
      where: { id: animalId },
      data: {
        ...(dto.breedId !== undefined ? { breedId: dto.breedId } : {}),
        ...(dto.tagCode !== undefined ? { tagCode: dto.tagCode } : {}),
        ...(dto.sex !== undefined ? { sex: dto.sex } : {}),
        ...(dto.birthDate !== undefined
          ? { birthDate: dto.birthDate ? new Date(dto.birthDate) : null }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {})
      }
    });
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
