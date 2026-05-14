import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { MembershipRole } from "@prisma/client";
import { AUDIT_ACTION } from "../common/audit.constants";
import { AuditService } from "../common/audit.service";
import { FarmAccessService } from "../common/farm-access.service";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { MemberActivityLogsService } from "../member-activity-logs/member-activity-logs.service";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateFarmMemberDto } from "./dto/update-farm-member.dto";

@Injectable()
export class FarmMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly audit: AuditService,
    private readonly activityLogs: MemberActivityLogsService
  ) {}

  async list(actor: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(actor.id, farmId);
    return this.prisma.farmMembership.findMany({
      where: { farmId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true
          }
        }
      }
    });
  }

  async update(
    actor: User,
    farmId: string,
    membershipId: string,
    dto: UpdateFarmMemberDto
  ) {
    await this.farmAccess.requireFarmScopes(actor.id, farmId, [
      FARM_SCOPE.invitationsManage
    ]);
    const farm = await this.farmAccess.requireFarmAccess(actor.id, farmId);

    const row = await this.prisma.farmMembership.findFirst({
      where: { id: membershipId, farmId }
    });
    if (!row) {
      throw new NotFoundException("Membre introuvable");
    }
    if (row.userId === farm.ownerId || row.role === MembershipRole.owner) {
      throw new ForbiddenException(
        "Le proprietaire de la ferme ne peut pas etre modifie ainsi"
      );
    }
    if (dto.role === MembershipRole.owner) {
      throw new BadRequestException(
        "Le role owner ne peut pas etre attribue par cette route"
      );
    }
    if (dto.role === undefined && dto.scopes === undefined) {
      throw new BadRequestException("Rien a mettre a jour");
    }

    const prev = { role: row.role, scopes: [...row.scopes] };

    const updated = await this.prisma.farmMembership.update({
      where: { id: membershipId },
      data: {
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.scopes !== undefined ? { scopes: dto.scopes } : {})
      },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true }
        }
      }
    });

    await this.audit.record({
      actorUserId: actor.id,
      farmId,
      action: AUDIT_ACTION.farmMemberUpdated,
      resourceType: "FarmMembership",
      resourceId: membershipId,
      metadata: {
        targetUserId: row.userId,
        before: prev,
        after: { role: updated.role, scopes: updated.scopes }
      }
    });

    await this.activityLogs.log({
      farmId,
      memberId: membershipId,
      module: "collaboration",
      action: "permissions_updated",
      detail: { before: prev, after: { role: updated.role, scopes: updated.scopes } }
    }).catch(() => undefined);

    return updated;
  }

  async remove(actor: User, farmId: string, membershipId: string) {
    const farm = await this.farmAccess.requireFarmAccess(actor.id, farmId);

    const row = await this.prisma.farmMembership.findFirst({
      where: { id: membershipId, farmId }
    });
    if (!row) {
      throw new NotFoundException("Membre introuvable");
    }

    const isSelf = row.userId === actor.id;

    if (isSelf) {
      if (farm.ownerId === actor.id) {
        throw new BadRequestException(
          "Le proprietaire ne peut pas quitter la ferme sans transferer la propriete"
        );
      }
    } else {
      await this.farmAccess.requireFarmScopes(actor.id, farmId, [
        FARM_SCOPE.invitationsManage
      ]);
      if (row.userId === farm.ownerId) {
        throw new ForbiddenException("Impossible de retirer le proprietaire");
      }
      if (row.role === MembershipRole.owner) {
        throw new ForbiddenException("Impossible de retirer un membre owner");
      }
    }

    await this.prisma.farmMembership.delete({ where: { id: membershipId } });

    await this.audit.record({
      actorUserId: actor.id,
      farmId,
      action: AUDIT_ACTION.farmMemberRemoved,
      resourceType: "FarmMembership",
      resourceId: membershipId,
      metadata: {
        targetUserId: row.userId,
        role: row.role,
        selfLeave: isSelf
      }
    });

    return { ok: true };
  }

  async logActivity(
    farmId: string,
    memberId: string,
    action: string,
    detail?: Record<string, unknown>
  ): Promise<void> {
    await this.activityLogs.log({ farmId, memberId, module: "collaboration", action, detail });
  }
}
