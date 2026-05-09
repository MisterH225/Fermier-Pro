import { Injectable, NotFoundException } from "@nestjs/common";
import type { User } from "@prisma/client";
import { AUDIT_ACTION } from "../common/audit.constants";
import { AuditService } from "../common/audit.service";
import { FarmAccessService } from "../common/farm-access.service";
import { PrismaService } from "../prisma/prisma.service";
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

  async list(user: User, farmId: string, animalId: string) {
    await this.requireAnimalOnFarm(user, farmId, animalId);
    return this.prisma.animalHealthEvent.findMany({
      where: { animalId },
      orderBy: { recordedAt: "desc" },
      include: {
        recorder: { select: { id: true, fullName: true, email: true } }
      }
    });
  }

  async create(
    user: User,
    farmId: string,
    animalId: string,
    dto: CreateHealthEventDto
  ) {
    await this.requireAnimalOnFarm(user, farmId, animalId);
    const row = await this.prisma.animalHealthEvent.create({
      data: {
        animalId,
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
      action: AUDIT_ACTION.healthAnimalEventCreated,
      resourceType: "AnimalHealthEvent",
      resourceId: row.id,
      metadata: {
        animalId,
        severity: row.severity,
        title: row.title
      }
    });
    return row;
  }
}
