import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { Farm, User } from "@prisma/client";
import { MembershipRole, Prisma } from "@prisma/client";
import { AUDIT_ACTION } from "../common/audit.constants";
import { AuditService } from "../common/audit.service";
import { FarmAccessService } from "../common/farm-access.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateFarmDto } from "./dto/create-farm.dto";
import { TransferFarmOwnershipDto } from "./dto/transfer-farm-ownership.dto";

@Injectable()
export class FarmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly farmAccess: FarmAccessService
  ) {}

  async create(user: User, dto: CreateFarmDto): Promise<Farm> {
    return this.prisma.$transaction(async (tx) => {
      const farm = await tx.farm.create({
        data: {
          ownerId: user.id,
          name: dto.name,
          speciesFocus: dto.speciesFocus ?? "porcin",
          livestockMode: dto.livestockMode ?? undefined,
          livestockCategoryPolicies:
            dto.livestockCategoryPolicies != null
              ? dto.livestockCategoryPolicies
              : undefined,
          latitude:
            dto.latitude != null
              ? new Prisma.Decimal(dto.latitude)
              : undefined,
          longitude:
            dto.longitude != null
              ? new Prisma.Decimal(dto.longitude)
              : undefined,
          address: dto.address,
          capacity: dto.capacity
        }
      });

      await tx.farmMembership.create({
        data: {
          farmId: farm.id,
          userId: user.id,
          role: MembershipRole.owner,
          scopes: []
        }
      });

      return farm;
    }).then(async (farm) => {
      await this.audit.record({
        actorUserId: user.id,
        farmId: farm.id,
        action: AUDIT_ACTION.farmCreated,
        resourceType: "Farm",
        resourceId: farm.id,
        metadata: {
          name: farm.name,
          speciesFocus: farm.speciesFocus,
          livestockMode: farm.livestockMode
        }
      });
      return farm;
    });
  }

  async listForUser(user: User): Promise<Farm[]> {
    return this.prisma.farm.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          { memberships: { some: { userId: user.id } } }
        ]
      },
      orderBy: { updatedAt: "desc" }
    });
  }

  async findOneForUser(user: User, farmId: string): Promise<Farm> {
    const farm = await this.prisma.farm.findFirst({
      where: {
        id: farmId,
        OR: [
          { ownerId: user.id },
          { memberships: { some: { userId: user.id } } }
        ]
      }
    });
    if (!farm) {
      throw new NotFoundException("Ferme introuvable");
    }
    return farm;
  }

  /**
   * Transfere la propriete (`Farm.ownerId`). Reserve au proprietaire actuel.
   * Le nouveau proprietaire doit deja avoir au moins un `FarmMembership` sur cette ferme.
   */
  async transferOwnership(
    actor: User,
    farmId: string,
    dto: TransferFarmOwnershipDto
  ) {
    const farm = await this.prisma.farm.findFirst({
      where: { id: farmId }
    });
    if (!farm) {
      throw new NotFoundException("Ferme introuvable");
    }
    if (farm.ownerId !== actor.id) {
      throw new ForbiddenException("Seul le proprietaire peut transferer la ferme");
    }
    if (dto.newOwnerUserId === actor.id) {
      throw new BadRequestException("Le nouveau proprietaire doit etre un autre utilisateur");
    }

    const newOwnerExists = await this.prisma.user.findUnique({
      where: { id: dto.newOwnerUserId }
    });
    if (!newOwnerExists) {
      throw new BadRequestException("Utilisateur inconnu");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const newOwnerRows = await tx.farmMembership.findMany({
        where: { farmId, userId: dto.newOwnerUserId }
      });
      if (newOwnerRows.length === 0) {
        throw new BadRequestException(
          "Le nouveau proprietaire doit deja etre membre de la ferme"
        );
      }

      const roleRank = (r: MembershipRole) =>
        r === MembershipRole.manager
          ? 0
          : r === MembershipRole.worker
            ? 1
            : r === MembershipRole.veterinarian
              ? 2
              : r === MembershipRole.viewer
                ? 3
                : 4;

      const sorted = [...newOwnerRows].sort(
        (a, b) =>
          roleRank(a.role) - roleRank(b.role) ||
          a.createdAt.getTime() - b.createdAt.getTime()
      );
      const keep = sorted[0]!;
      const removeIds = sorted.slice(1).map((m) => m.id);
      if (removeIds.length > 0) {
        await tx.farmMembership.deleteMany({
          where: { id: { in: removeIds } }
        });
      }

      await tx.farmMembership.update({
        where: { id: keep.id },
        data: { role: MembershipRole.owner, scopes: [] }
      });

      const formerOwnerRow = await tx.farmMembership.findFirst({
        where: {
          farmId,
          userId: actor.id,
          role: MembershipRole.owner
        }
      });
      if (formerOwnerRow) {
        await tx.farmMembership.update({
          where: { id: formerOwnerRow.id },
          data: { role: MembershipRole.manager, scopes: [] }
        });
      } else {
        await tx.farmMembership.create({
          data: {
            farmId,
            userId: actor.id,
            role: MembershipRole.manager,
            scopes: []
          }
        });
      }

      const updated = await tx.farm.update({
        where: { id: farmId },
        data: { ownerId: dto.newOwnerUserId }
      });

      return updated;
    });

    await this.audit.record({
      actorUserId: actor.id,
      farmId,
      action: AUDIT_ACTION.farmOwnershipTransferred,
      resourceType: "Farm",
      resourceId: farmId,
      metadata: {
        previousOwnerId: actor.id,
        newOwnerId: dto.newOwnerUserId
      }
    });

    return result;
  }

  /**
   * Journal d'audit de la ferme (pagination par curseur = `id` de la derniere ligne recue).
   * Les scopes sont verifies par le controleur (`audit.read`).
   */
  async listAuditLogs(
    user: User,
    farmId: string,
    limitRaw?: number,
    cursor?: string
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const take = Math.min(Math.max(Number(limitRaw) || 50, 1), 200);

    const where: Prisma.AuditLogWhereInput = { farmId };
    if (cursor?.trim()) {
      const anchor = await this.prisma.auditLog.findFirst({
        where: { id: cursor.trim(), farmId }
      });
      if (!anchor) {
        throw new BadRequestException("Curseur d'audit invalide");
      }
      where.OR = [
        { createdAt: { lt: anchor.createdAt } },
        {
          AND: [
            { createdAt: anchor.createdAt },
            { id: { lt: anchor.id } }
          ]
        }
      ];
    }

    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      include: {
        actor: { select: { id: true, fullName: true, email: true } }
      }
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null
    };
  }
}
