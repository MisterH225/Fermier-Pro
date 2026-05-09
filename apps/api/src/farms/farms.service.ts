import {
  BadRequestException,
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
