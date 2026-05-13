import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class LivestockStatusLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(params: {
    farmId: string;
    recordedByUserId: string;
    entityType: "animal" | "batch";
    entityId: string;
    oldStatus: string | null;
    newStatus: string;
    note?: string | null;
  }) {
    return this.prisma.livestockStatusLog.create({
      data: {
        farmId: params.farmId,
        recordedByUserId: params.recordedByUserId,
        entityType: params.entityType,
        entityId: params.entityId,
        oldStatus: params.oldStatus,
        newStatus: params.newStatus,
        note: params.note ?? null
      }
    });
  }
}
