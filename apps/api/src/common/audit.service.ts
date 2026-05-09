import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export type AuditRecordInput = {
  actorUserId: string;
  farmId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enregistre un evenement d'audit. Les echecs d'ecriture ne font pas echouer la transaction metier.
   */
  async record(input: AuditRecordInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          ...(input.farmId !== undefined ? { farmId: input.farmId } : {}),
          action: input.action,
          resourceType: input.resourceType,
          ...(input.resourceId !== undefined && input.resourceId !== null
            ? { resourceId: input.resourceId }
            : {}),
          ...(input.metadata !== undefined ? { metadata: input.metadata } : {})
        }
      });
    } catch (err) {
      this.logger.warn(
        `AuditLog write failed action=${input.action}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }
}
