import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { AUDIT_ACTION } from "../common/audit.constants";
import { AuditService } from "../common/audit.service";
import { FarmAccessService } from "../common/farm-access.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBatchWeightDto } from "./dto/create-batch-weight.dto";
import { CreateHealthEventDto } from "../health-events/dto/create-health-event.dto";
import { CreateLivestockBatchDto } from "./dto/create-livestock-batch.dto";
import { UpdateLivestockBatchDto } from "./dto/update-livestock-batch.dto";
import { TaxonomyService } from "./taxonomy.service";
import { LivestockStatusLogService } from "./livestock-status-log.service";
import { prepareBatchForDeletion } from "./livestock-batch-membership.helper";
import { effectiveBatchHeadcount } from "./livestock-batch-membership.util";

const PORCIN_CODE = "porcin";

@Injectable()
export class BatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxonomy: TaxonomyService,
    private readonly farmAccess: FarmAccessService,
    private readonly audit: AuditService,
    private readonly statusLog: LivestockStatusLogService
  ) {}

  private async resolveSpeciesId(speciesId?: string): Promise<string> {
    await this.taxonomy.ensurePorcinSpecies();
    if (speciesId) {
      const s = await this.prisma.species.findFirst({
        where: { id: speciesId }
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
    breedId: string | undefined | null
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

  private async getBatchOnFarm(user: User, farmId: string, batchId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const batch = await this.prisma.livestockBatch.findFirst({
      where: { id: batchId, farmId }
    });
    if (!batch) {
      throw new NotFoundException("Bande introuvable");
    }
    return batch;
  }

  async listBatches(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const rows = await this.prisma.livestockBatch.findMany({
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

    const memberCounts = rows.length
      ? await this.prisma.animal.groupBy({
          by: ["livestockBatchId"],
          where: {
            farmId,
            status: "active",
            livestockBatchId: { in: rows.map((b) => b.id) }
          },
          _count: { id: true }
        })
      : [];
    const activeByBatch = new Map(
      memberCounts.map((row) => [
        row.livestockBatchId,
        row._count.id
      ])
    );

    return rows.map((batch) => {
      const activeMemberCount = activeByBatch.get(batch.id) ?? 0;
      return {
        ...batch,
        activeMemberCount,
        headcount: effectiveBatchHeadcount(batch.headcount, activeMemberCount)
      };
    });
  }

  async createBatch(user: User, farmId: string, dto: CreateLivestockBatchDto) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const speciesId = await this.resolveSpeciesId(dto.speciesId);
    await this.assertBreedForSpecies(speciesId, dto.breedId);

    return this.prisma.livestockBatch.create({
      data: {
        farmId,
        speciesId,
        breedId: dto.breedId,
        name: dto.name,
        categoryKey: dto.categoryKey,
        headcount: dto.headcount ?? 0,
        avgBirthDate: dto.avgBirthDate ? new Date(dto.avgBirthDate) : undefined,
        sourceTag: dto.sourceTag,
        notes: dto.notes
      }
    });
  }

  async getBatch(user: User, farmId: string, batchId: string) {
    await this.getBatchOnFarm(user, farmId, batchId);
    return this.prisma.livestockBatch.findFirst({
      where: { id: batchId, farmId },
      include: {
        species: { select: { id: true, code: true, name: true } },
        breed: { select: { id: true, name: true } },
        weights: { orderBy: { measuredAt: "desc" }, take: 30 },
        healthEvents: {
          orderBy: { recordedAt: "desc" },
          take: 30,
          include: {
            recorder: { select: { id: true, fullName: true, email: true } }
          }
        }
      }
    });
  }

  async updateBatch(
    user: User,
    farmId: string,
    batchId: string,
    dto: UpdateLivestockBatchDto
  ) {
    const batch = await this.getBatchOnFarm(user, farmId, batchId);
    if (dto.breedId !== undefined && dto.breedId !== null) {
      await this.assertBreedForSpecies(batch.speciesId, dto.breedId);
    }
    const nextStatus = dto.status !== undefined ? dto.status : batch.status;
    const statusChanged =
      dto.status !== undefined && dto.status !== batch.status;

    const updated = await this.prisma.livestockBatch.update({
      where: { id: batchId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.breedId !== undefined ? { breedId: dto.breedId } : {}),
        ...(dto.categoryKey !== undefined ? { categoryKey: dto.categoryKey } : {}),
        ...(dto.headcount !== undefined ? { headcount: dto.headcount } : {}),
        ...(dto.avgBirthDate !== undefined
          ? {
              avgBirthDate: dto.avgBirthDate
                ? new Date(dto.avgBirthDate)
                : null
            }
          : {}),
        ...(dto.sourceTag !== undefined ? { sourceTag: dto.sourceTag } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.expectedExitAt !== undefined
          ? {
              expectedExitAt: dto.expectedExitAt
                ? new Date(dto.expectedExitAt)
                : null
            }
          : {}),
        ...(dto.closedAt !== undefined
          ? {
              closedAt: dto.closedAt ? new Date(dto.closedAt) : null
            }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {})
      }
    });

    if (statusChanged) {
      await this.statusLog.record({
        farmId,
        recordedByUserId: user.id,
        entityType: "batch",
        entityId: batchId,
        oldStatus: batch.status,
        newStatus: nextStatus
      });
    }

    return updated;
  }

  async deleteBatch(user: User, farmId: string, batchId: string) {
    const batch = await this.getBatchOnFarm(user, farmId, batchId);

    const activeMembers = await this.prisma.$transaction((tx) =>
      prepareBatchForDeletion(tx, farmId, batchId)
    );

    if (activeMembers > 0) {
      throw new BadRequestException(
        `Impossible de supprimer cette bande : ${activeMembers} sujet(s) actif(s) encore rattaché(s). Transférez ou sortez les animaux avant suppression.`
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.animal.updateMany({
        where: { farmId, livestockBatchId: batchId },
        data: { livestockBatchId: null }
      });
      await tx.livestockExit.updateMany({
        where: { batchId },
        data: { batchId: null }
      });
      await tx.litter.updateMany({
        where: { starterBatchId: batchId },
        data: { starterBatchId: null }
      });
      await tx.livestockBatch.delete({ where: { id: batchId } });
    });

    await this.audit.record({
      actorUserId: user.id,
      farmId,
      action: AUDIT_ACTION.batchDeleted,
      resourceType: "LivestockBatch",
      resourceId: batchId,
      metadata: {
        name: batch.name,
        headcount: batch.headcount,
        sourceTag: batch.sourceTag ?? undefined
      }
    });
  }

  async addWeight(
    user: User,
    farmId: string,
    batchId: string,
    dto: CreateBatchWeightDto
  ) {
    await this.getBatchOnFarm(user, farmId, batchId);
    return this.prisma.livestockBatchWeight.create({
      data: {
        batchId,
        avgWeightKg: new Prisma.Decimal(dto.avgWeightKg),
        headcountSnapshot: dto.headcountSnapshot ?? null,
        measuredAt: dto.measuredAt ? new Date(dto.measuredAt) : new Date(),
        note: dto.note ?? null
      }
    });
  }

  async listHealthEvents(user: User, farmId: string, batchId: string) {
    await this.getBatchOnFarm(user, farmId, batchId);
    return this.prisma.livestockBatchHealthEvent.findMany({
      where: { batchId },
      orderBy: { recordedAt: "desc" },
      include: {
        recorder: { select: { id: true, fullName: true, email: true } }
      }
    });
  }

  async createHealthEvent(
    user: User,
    farmId: string,
    batchId: string,
    dto: CreateHealthEventDto
  ) {
    const batch = await this.getBatchOnFarm(user, farmId, batchId);
    const row = await this.prisma.livestockBatchHealthEvent.create({
      data: {
        batchId,
        severity: dto.severity,
        title: dto.title,
        body: dto.body,
        recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : new Date(),
        recordedByUserId: user.id
      },
      include: {
        recorder: { select: { id: true, fullName: true, email: true } }
      }
    });
    await this.audit.record({
      actorUserId: user.id,
      farmId,
      action: AUDIT_ACTION.healthBatchEventCreated,
      resourceType: "LivestockBatchHealthEvent",
      resourceId: row.id,
      metadata: {
        batchId,
        batchPublicId: batch.publicId,
        severity: row.severity,
        title: row.title
      }
    });
    return row;
  }
}
