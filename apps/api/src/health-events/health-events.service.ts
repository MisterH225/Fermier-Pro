import { Injectable, NotFoundException } from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  FarmDiseaseCaseStatus,
  FarmHealthEntityType,
  FarmHealthRecordKind
} from "@prisma/client";
import { AUDIT_ACTION } from "../common/audit.constants";
import { AuditService } from "../common/audit.service";
import { FarmAccessService } from "../common/farm-access.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  diseaseSeverityFromLegacy,
  legacyCaseStatusFromSeverity,
  mapFarmDiseaseRecordToLegacyEvent,
  syncAnimalHealthStatus
} from "../farm-health/disease-health.helper";
import { CreateHealthEventDto } from "./dto/create-health-event.dto";

@Injectable()
export class HealthEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly audit: AuditService
  ) {}

  private async requireAnimalOnFarm(
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

  /** @deprecated Compat API — source unique FarmHealthRecord (kind=disease). */
  async list(user: User, farmId: string, animalId: string) {
    await this.requireAnimalOnFarm(user, farmId, animalId);
    const rows = await this.prisma.farmHealthRecord.findMany({
      where: {
        farmId,
        kind: FarmHealthRecordKind.disease,
        entityType: FarmHealthEntityType.animal,
        entityId: animalId
      },
      orderBy: { occurredAt: "desc" },
      include: {
        disease: { select: { diagnosis: true, severity: true } },
        recorder: { select: { id: true, fullName: true, email: true } }
      }
    });
    return rows.map(mapFarmDiseaseRecordToLegacyEvent);
  }

  /** @deprecated Compat API — crée un FarmHealthRecord disease (source unique). */
  async create(
    user: User,
    farmId: string,
    animalId: string,
    dto: CreateHealthEventDto
  ) {
    await this.requireAnimalOnFarm(user, farmId, animalId);
    const occurredAt = dto.recordedAt ? new Date(dto.recordedAt) : new Date();
    const caseStatus = legacyCaseStatusFromSeverity(dto.severity);
    const severity = diseaseSeverityFromLegacy(dto.severity);

    const row = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.farmHealthRecord.create({
        data: {
          farmId,
          kind: FarmHealthRecordKind.disease,
          entityType: FarmHealthEntityType.animal,
          entityId: animalId,
          occurredAt,
          status: "completed",
          notes: dto.body?.trim() ?? null,
          recordedByUserId: user.id
        }
      });

      await tx.healthDiseaseDetail.create({
        data: {
          healthRecordId: rec.id,
          diagnosis: dto.title.trim(),
          caseStatus,
          severity,
          symptoms: { legacySeverity: dto.severity },
          resolvedAt:
            caseStatus === FarmDiseaseCaseStatus.recovered ? occurredAt : null
        }
      });

      await syncAnimalHealthStatus(tx, animalId);

      return tx.farmHealthRecord.findUniqueOrThrow({
        where: { id: rec.id },
        include: {
          disease: { select: { diagnosis: true, severity: true } },
          recorder: { select: { id: true, fullName: true, email: true } }
        }
      });
    });

    const legacy = mapFarmDiseaseRecordToLegacyEvent(row);
    await this.audit.record({
      actorUserId: user.id,
      farmId,
      action: AUDIT_ACTION.farmHealthRecordCreated,
      resourceType: "FarmHealthRecord",
      resourceId: row.id,
      metadata: {
        animalId,
        legacyApi: "animal-health-events",
        severity: legacy.severity,
        title: legacy.title
      }
    });
    return legacy;
  }
}
