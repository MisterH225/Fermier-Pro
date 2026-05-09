import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { Farm } from "@prisma/client";
import { MembershipRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { FARM_SCOPE } from "./farm-scopes.constants";

function defaultScopesForRole(role: MembershipRole): string[] {
  switch (role) {
    case MembershipRole.owner:
      return [FARM_SCOPE.ALL];
    case MembershipRole.manager:
      return [FARM_SCOPE.ALL];
    case MembershipRole.worker:
      return [
        FARM_SCOPE.livestockRead,
        FARM_SCOPE.livestockWrite,
        FARM_SCOPE.tasksRead,
        FARM_SCOPE.tasksWrite,
        FARM_SCOPE.healthRead,
        FARM_SCOPE.healthWrite,
        FARM_SCOPE.housingRead,
        FARM_SCOPE.housingWrite,
        FARM_SCOPE.exitsRead,
        FARM_SCOPE.exitsWrite,
        FARM_SCOPE.vetRead,
        FARM_SCOPE.vetWrite,
        FARM_SCOPE.chat,
        FARM_SCOPE.marketplaceRead,
        FARM_SCOPE.marketplaceWrite
      ];
    case MembershipRole.veterinarian:
      return [
        FARM_SCOPE.livestockRead,
        FARM_SCOPE.healthRead,
        FARM_SCOPE.healthWrite,
        FARM_SCOPE.vetRead,
        FARM_SCOPE.vetWrite,
        FARM_SCOPE.tasksRead,
        FARM_SCOPE.chat,
        FARM_SCOPE.marketplaceRead
      ];
    case MembershipRole.viewer:
      return [
        FARM_SCOPE.livestockRead,
        FARM_SCOPE.tasksRead,
        FARM_SCOPE.healthRead,
        FARM_SCOPE.financeRead,
        FARM_SCOPE.housingRead,
        FARM_SCOPE.exitsRead,
        FARM_SCOPE.vetRead,
        FARM_SCOPE.chat,
        FARM_SCOPE.marketplaceRead
      ];
    default:
      return [];
  }
}

function scopeSatisfies(effective: Set<string>, required: string): boolean {
  if (effective.has(FARM_SCOPE.ALL)) {
    return true;
  }
  if (effective.has(required)) {
    return true;
  }
  const dot = required.lastIndexOf(".");
  if (dot > 0) {
    const prefixWildcard = `${required.slice(0, dot)}.*`;
    if (effective.has(prefixWildcard)) {
      return true;
    }
  }
  return false;
}

@Injectable()
export class FarmAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireFarmAccess(userId: string, farmId: string): Promise<Farm> {
    const farm = await this.prisma.farm.findFirst({
      where: {
        id: farmId,
        OR: [{ ownerId: userId }, { memberships: { some: { userId } } }]
      }
    });
    if (!farm) {
      throw new NotFoundException("Ferme introuvable");
    }
    return farm;
  }

  async getEffectiveFarmScopes(
    userId: string,
    farmId: string
  ): Promise<{ farm: Farm; scopes: Set<string> }> {
    const farm = await this.requireFarmAccess(userId, farmId);
    if (farm.ownerId === userId) {
      return { farm, scopes: new Set([FARM_SCOPE.ALL]) };
    }
    const memberships = await this.prisma.farmMembership.findMany({
      where: { farmId, userId }
    });
    const scopes = new Set<string>();
    for (const m of memberships) {
      const list =
        m.scopes.length > 0 ? m.scopes : defaultScopesForRole(m.role);
      for (const s of list) {
        scopes.add(s);
      }
    }
    return { farm, scopes };
  }

  async requireFarmScopes(
    userId: string,
    farmId: string,
    required: string[]
  ): Promise<void> {
    const { scopes } = await this.getEffectiveFarmScopes(userId, farmId);
    for (const r of required) {
      if (!scopeSatisfies(scopes, r)) {
        throw new ForbiddenException(`Permission manquante: ${r}`);
      }
    }
  }
}
