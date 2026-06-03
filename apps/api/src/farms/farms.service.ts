import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { Farm, User } from "@prisma/client";
import { FarmStatus, MembershipRole, Prisma } from "@prisma/client";
import { AUDIT_ACTION } from "../common/audit.constants";
import { AuditService } from "../common/audit.service";
import { FarmAccessService } from "../common/farm-access.service";
import { InvitationsService } from "../invitations/invitations.service";
import { ensureFarmFinanceBootstrap } from "../finance/finance-bootstrap";
import { PrismaService } from "../prisma/prisma.service";
import { CreateFarmDto } from "./dto/create-farm.dto";
import { UpdateFarmCheptelConfigDto } from "./dto/update-farm-cheptel-config.dto";
import { TransferFarmOwnershipDto } from "./dto/transfer-farm-ownership.dto";
import { ArchiveFarmDto } from "./dto/archive-farm.dto";
import { FarmDeletionService } from "./farm-deletion.service";

const MAX_ACTIVE_FARMS_PER_USER = 3;

@Injectable()
export class FarmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly farmAccess: FarmAccessService,
    private readonly invitations: InvitationsService,
    private readonly farmDeletion: FarmDeletionService
  ) {}

  async create(user: User, dto: CreateFarmDto): Promise<Farm> {
    const activeFarmCount = await this.prisma.farm.count({
      where: { ownerId: user.id, status: FarmStatus.active }
    });
    if (activeFarmCount >= MAX_ACTIVE_FARMS_PER_USER) {
      throw new ForbiddenException(
        `Limite de ${MAX_ACTIVE_FARMS_PER_USER} projets actifs atteinte. Archivez un projet pour en créer un nouveau.`
      );
    }

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

      // Lien collaboratif par défaut (QR / partage producteur) — token unique
      // crypto-secure, expirant à 1 an. L'owner peut le partager via la
      // section « Accès collaboratif » du profil ; les scans déclenchent une
      // demande `scan_request` que l'owner valide ensuite.
      await this.invitations.createDefaultInvitation(tx, farm.id, user.id);

      // Si c'est le premier projet ou si l'utilisateur n'a pas de projet actif, on le définit comme actif
      if (!user.activeFarmId) {
        await tx.user.update({
          where: { id: user.id },
          data: { activeFarmId: farm.id }
        });
      }

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
      await this.audit.record({
        actorUserId: user.id,
        farmId: farm.id,
        action: AUDIT_ACTION.farmInvitationDefaultGenerated,
        resourceType: "FarmInvitation",
        metadata: { autoCreatedAtFarmCreation: true }
      });
      await ensureFarmFinanceBootstrap(this.prisma, farm.id);
      return farm;
    });
  }

  async listForUser(
    user: User,
    options?: { includeArchived?: boolean }
  ): Promise<Farm[]> {
    const statusFilter = options?.includeArchived
      ? undefined
      : { status: FarmStatus.active };

    return this.prisma.farm.findMany({
      where: {
        ...statusFilter,
        OR: [
          { ownerId: user.id },
          { memberships: { some: { userId: user.id } } }
        ]
      },
      orderBy: [{ displayOrder: "asc" }, { updatedAt: "desc" }]
    });
  }

  async listAllForUser(user: User): Promise<Farm[]> {
    return this.prisma.farm.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          { memberships: { some: { userId: user.id } } }
        ]
      },
      orderBy: [{ status: "asc" }, { displayOrder: "asc" }, { updatedAt: "desc" }]
    });
  }

  /** Détail ferme + scopes effectifs (RBAC) pour le menu mobile et clients API. */
  async findOneForUser(
    user: User,
    farmId: string
  ): Promise<Farm & { effectiveScopes: string[] }> {
    const { farm, scopes } = await this.farmAccess.getEffectiveFarmScopes(
      user.id,
      farmId
    );
    return {
      ...farm,
      effectiveScopes: Array.from(scopes).sort((a, b) => a.localeCompare(b))
    };
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

  async updateCheptelConfig(
    user: User,
    farmId: string,
    dto: UpdateFarmCheptelConfigDto
  ): Promise<Farm> {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const farm = await this.prisma.farm.findFirst({ where: { id: farmId } });
    if (!farm) {
      throw new NotFoundException("Ferme introuvable");
    }
    return this.prisma.farm.update({
      where: { id: farmId },
      data: {
        ...(dto.livestockMode !== undefined
          ? { livestockMode: dto.livestockMode }
          : {}),
        ...(dto.housingBuildingsCount !== undefined
          ? { housingBuildingsCount: dto.housingBuildingsCount }
          : {}),
        ...(dto.housingPensPerBuilding !== undefined
          ? { housingPensPerBuilding: dto.housingPensPerBuilding }
          : {}),
        ...(dto.housingMaxPigsPerPen !== undefined
          ? { housingMaxPigsPerPen: dto.housingMaxPigsPerPen }
          : {})
      }
    });
  }

  async getCheptelOverview(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      select: {
        id: true,
        name: true,
        livestockMode: true,
        housingBuildingsCount: true,
        housingPensPerBuilding: true,
        housingMaxPigsPerPen: true
      }
    });
    if (!farm) {
      throw new NotFoundException("Ferme introuvable");
    }

    const animals = await this.prisma.animal.findMany({
      where: { farmId },
      select: {
        id: true,
        sex: true,
        status: true,
        healthStatus: true,
        productionCategory: true,
        expectedFarrowingAt: true,
        createdAt: true
      }
    });

    const batches = await this.prisma.livestockBatch.findMany({
      where: { farmId },
      select: {
        headcount: true,
        status: true,
        closedAt: true,
        categoryKey: true,
        createdAt: true
      }
    });

    let maleAnimals = 0;
    let femaleAnimals = 0;
    let unknownSexAnimals = 0;
    for (const a of animals) {
      if (a.sex === "male") {
        maleAnimals += 1;
      } else if (a.sex === "female") {
        femaleAnimals += 1;
      } else {
        unknownSexAnimals += 1;
      }
    }

    const gestatingFemales = animals.filter(
      (a) => a.sex === "female" && a.expectedFarrowingAt != null
    ).length;

    const activeBatches = batches.filter((b) => b.status === "active");
    const totalBatchHeadcount = activeBatches.reduce(
      (s, b) => s + b.headcount,
      0
    );

    const penCap = await this.prisma.pen.aggregate({
      where: { barn: { farmId } },
      _sum: { capacity: true }
    });
    let penCapacityTotal = penCap._sum.capacity ?? 0;
    if (
      penCapacityTotal === 0 &&
      farm.housingBuildingsCount != null &&
      farm.housingPensPerBuilding != null &&
      farm.housingMaxPigsPerPen != null
    ) {
      penCapacityTotal =
        farm.housingBuildingsCount *
        farm.housingPensPerBuilding *
        farm.housingMaxPigsPerPen;
    }

    const activePlacements = await this.prisma.penPlacement.findMany({
      where: {
        endedAt: null,
        pen: { barn: { farmId } }
      },
      select: {
        animalId: true,
        batchId: true,
        batch: { select: { headcount: true } }
      }
    });

    const pens = await this.prisma.pen.findMany({
      where: { barn: { farmId } },
      select: {
        id: true,
        capacity: true,
        placements: {
          where: { endedAt: null },
          select: {
            animalId: true,
            batch: { select: { headcount: true } }
          }
        }
      }
    });
    let penOccupancyHeadcount = 0;
    for (const pl of activePlacements) {
      if (pl.animalId) {
        penOccupancyHeadcount += 1;
      } else if (pl.batchId && pl.batch) {
        penOccupancyHeadcount += pl.batch.headcount;
      }
    }

    const occupancyRate =
      penCapacityTotal > 0
        ? Math.min(
            100,
            Math.round((penOccupancyHeadcount / penCapacityTotal) * 1000) / 10
          )
        : null;

    const barnCount = await this.prisma.barn.count({ where: { farmId } });

    const activeAnimals = animals.filter((a) => a.status === "active");
    const placedAnimalIds = new Set(
      activePlacements
        .map((p) => p.animalId)
        .filter((id): id is string => Boolean(id))
    );
    const unassignedAnimalsCount = activeAnimals.filter(
      (a) => !placedAnimalIds.has(a.id)
    ).length;

    let availablePensCount = 0;
    for (const pen of pens) {
      const cap = pen.capacity ?? 0;
      if (cap <= 0) {
        continue;
      }
      let occ = 0;
      for (const pl of pen.placements) {
        if (pl.animalId) {
          occ += 1;
        } else if (pl.batch?.headcount) {
          occ += pl.batch.headcount;
        }
      }
      if (occ < cap) {
        availablePensCount += 1;
      }
    }

    const categoryTotals: Record<string, number> = {
      piglets: 0,
      growth: 0,
      finishing: 0,
      breeders: 0,
      other: 0
    };

    const mapBatchCategory = (key: string | null): keyof typeof categoryTotals => {
      const k = (key ?? "").toLowerCase();
      if (
        k.includes("nursery") ||
        k.includes("porcelet") ||
        k.includes("demarrage") ||
        k === "starter" ||
        k === "start"
      ) {
        return "piglets";
      }
      if (k.includes("grow") || k.includes("croissance") || k === "grower") {
        return "growth";
      }
      if (k.includes("finish") || k.includes("engrais") || k === "finisher") {
        return "finishing";
      }
      if (k.includes("breed") || k.includes("reprod")) {
        return "breeders";
      }
      return "other";
    };

    const mapAnimalProductionCategory = (
      cat: string
    ): keyof typeof categoryTotals => {
      switch (cat) {
        case "breeding_female":
        case "breeding_male":
          return "breeders";
        case "fattening":
          return "finishing";
        case "starter":
          return "piglets";
        default:
          return "other";
      }
    };

    for (const b of activeBatches) {
      const slot = mapBatchCategory(b.categoryKey);
      categoryTotals[slot] += b.headcount;
    }
    for (const a of activeAnimals) {
      categoryTotals[mapAnimalProductionCategory(a.productionCategory)] += 1;
    }

    const categoryBreakdown = (
      ["piglets", "growth", "finishing", "breeders", "other"] as const
    )
      .map((key) => ({ key, count: categoryTotals[key] }))
      .filter((row) => row.count > 0);

    const headcountTrend: { month: string; total: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)
      );
      const monthEnd = new Date(
        Date.UTC(
          monthStart.getUTCFullYear(),
          monthStart.getUTCMonth() + 1,
          0,
          23,
          59,
          59,
          999
        )
      );
      const monthKey = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`;
      const animalsToDate = animals.filter(
        (a) => new Date(a.createdAt) <= monthEnd
      ).length;
      const batchHeadToDate = batches
        .filter(
          (b) =>
            new Date(b.createdAt) <= monthEnd &&
            (b.status === "active" || (b.closedAt && new Date(b.closedAt) > monthEnd))
        )
        .reduce((s, b) => s + b.headcount, 0);
      headcountTrend.push({
        month: monthKey,
        total: animalsToDate + batchHeadToDate
      });
    }

    const totalHeadcount = activeAnimals.length + totalBatchHeadcount;

    const sickAnimalsCount = activeAnimals.filter(
      (a) => a.healthStatus === "sick"
    ).length;
    const fatteningCount = activeAnimals.filter(
      (a) => a.productionCategory === "fattening"
    ).length;
    const starterCount = activeAnimals.filter(
      (a) => a.productionCategory === "starter"
    ).length;
    const breedingFemalesCount = activeAnimals.filter(
      (a) => a.productionCategory === "breeding_female"
    ).length;
    const breedingFemalesGestating = activeAnimals.filter(
      (a) =>
        a.productionCategory === "breeding_female" &&
        a.expectedFarrowingAt != null
    ).length;

    const weekTrend = (
      category: "fattening" | "starter"
    ): number[] => {
      const out: number[] = [];
      for (let w = 3; w >= 0; w -= 1) {
        const end = new Date(now);
        end.setUTCDate(end.getUTCDate() - w * 7);
        out.push(
          activeAnimals.filter(
            (a) =>
              a.productionCategory === category &&
              new Date(a.createdAt) <= end
          ).length
        );
      }
      return out;
    };

    const penFreeHeadcount = Math.max(
      0,
      penCapacityTotal - penOccupancyHeadcount
    );

    return {
      farm,
      kpis: {
        totalAnimals: animals.length,
        totalHeadcount,
        maleAnimals,
        femaleAnimals,
        unknownSexAnimals,
        gestatingFemales,
        totalBatchHeadcount,
        activeBatchesCount: activeBatches.length,
        closedBatchesCount: batches.filter(
          (b) => b.closedAt != null || b.status !== "active"
        ).length,
        penCapacityTotal,
        penOccupancyHeadcount,
        occupancyRate,
        barnCount,
        availablePensCount,
        unassignedAnimalsCount,
        sickAnimalsCount,
        fatteningCount,
        starterCount,
        breedingFemalesCount,
        breedingFemalesGestating
      },
      categoryBreakdown,
      headcountTrend,
      miniWidgets: {
        categoryDonut: categoryBreakdown.map((row) => ({
          label: row.key,
          count: row.count
        })),
        breedingDonut: [
          { label: "gestating", count: breedingFemalesGestating },
          {
            label: "available",
            count: Math.max(0, breedingFemalesCount - breedingFemalesGestating)
          }
        ],
        fatteningTrend: weekTrend("fattening"),
        starterTrend: weekTrend("starter"),
        occupancyDonut: [
          { label: "occupied", count: penOccupancyHeadcount },
          { label: "free", count: penFreeHeadcount }
        ]
      }
    };
  }

  async listCheptelStatusLogs(
    user: User,
    farmId: string,
    query: {
      from?: string;
      to?: string;
      entityType?: string;
      newStatus?: string;
      limit?: number;
    }
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const take = Math.min(Math.max(query.limit ?? 200, 1), 500);
    const where: Prisma.LivestockStatusLogWhereInput = { farmId };
    if (query.entityType?.trim()) {
      where.entityType = query.entityType.trim();
    }
    if (query.newStatus?.trim()) {
      where.newStatus = query.newStatus.trim();
    }
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from?.trim()) {
      const d = new Date(query.from.trim());
      if (!Number.isNaN(d.getTime())) {
        createdAt.gte = d;
      }
    }
    if (query.to?.trim()) {
      const d = new Date(query.to.trim());
      if (!Number.isNaN(d.getTime())) {
        createdAt.lte = d;
      }
    }
    if (Object.keys(createdAt).length > 0) {
      where.createdAt = createdAt;
    }

    return this.prisma.livestockStatusLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      include: {
        recorder: { select: { id: true, fullName: true, email: true } }
      }
    });
  }

  async archiveFarm(
    user: User,
    farmId: string,
    dto: ArchiveFarmDto
  ): Promise<Farm> {
    const farm = await this.prisma.farm.findFirst({
      where: { id: farmId }
    });
    if (!farm) {
      throw new NotFoundException("Projet introuvable");
    }
    if (farm.ownerId !== user.id) {
      throw new ForbiddenException("Seul le propriétaire peut archiver le projet");
    }
    if (farm.status === FarmStatus.archived) {
      throw new BadRequestException("Ce projet est déjà archivé");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.farm.update({
        where: { id: farmId },
        data: {
          status: FarmStatus.archived,
          archivedAt: new Date()
        }
      });

      if (user.activeFarmId === farmId) {
        const nextActiveFarm = await tx.farm.findFirst({
          where: {
            ownerId: user.id,
            status: FarmStatus.active,
            id: { not: farmId }
          },
          orderBy: { createdAt: "asc" }
        });
        await tx.user.update({
          where: { id: user.id },
          data: { activeFarmId: nextActiveFarm?.id ?? null }
        });
      }

      return result;
    });

    await this.audit.record({
      actorUserId: user.id,
      farmId,
      action: AUDIT_ACTION.farmArchived,
      resourceType: "Farm",
      resourceId: farmId,
      metadata: { reason: dto.reason ?? null }
    });

    return updated;
  }

  async restoreFarm(user: User, farmId: string): Promise<Farm> {
    const farm = await this.prisma.farm.findFirst({
      where: { id: farmId }
    });
    if (!farm) {
      throw new NotFoundException("Projet introuvable");
    }
    if (farm.ownerId !== user.id) {
      throw new ForbiddenException("Seul le propriétaire peut restaurer le projet");
    }
    if (farm.status !== FarmStatus.archived) {
      throw new BadRequestException("Ce projet n'est pas archivé");
    }

    const activeFarmCount = await this.prisma.farm.count({
      where: { ownerId: user.id, status: FarmStatus.active }
    });
    if (activeFarmCount >= MAX_ACTIVE_FARMS_PER_USER) {
      throw new ForbiddenException(
        `Limite de ${MAX_ACTIVE_FARMS_PER_USER} projets actifs atteinte. Archivez un projet pour restaurer celui-ci.`
      );
    }

    const updated = await this.prisma.farm.update({
      where: { id: farmId },
      data: {
        status: FarmStatus.active,
        archivedAt: null
      }
    });

    await this.audit.record({
      actorUserId: user.id,
      farmId,
      action: AUDIT_ACTION.farmRestored,
      resourceType: "Farm",
      resourceId: farmId
    });

    return updated;
  }

  async deleteFarm(user: User, farmId: string): Promise<{ ok: boolean }> {
    const farm = await this.prisma.farm.findFirst({
      where: { id: farmId }
    });
    if (!farm) {
      throw new NotFoundException("Projet introuvable");
    }
    if (farm.ownerId !== user.id) {
      throw new ForbiddenException("Seul le propriétaire peut supprimer le projet");
    }

    await this.audit.record({
      actorUserId: user.id,
      farmId,
      action: AUDIT_ACTION.farmDeleted,
      resourceType: "Farm",
      resourceId: farmId,
      metadata: { name: farm.name }
    });

    await this.farmDeletion.deleteFarm(farmId, user.id);

    return { ok: true };
  }

  async setActiveFarm(user: User, farmId: string): Promise<{ activeFarmId: string }> {
    const farm = await this.prisma.farm.findFirst({
      where: { id: farmId }
    });
    if (!farm) {
      throw new NotFoundException("Projet introuvable");
    }

    const hasAccess =
      farm.ownerId === user.id ||
      (await this.prisma.farmMembership.findFirst({
        where: { farmId, userId: user.id }
      }));
    if (!hasAccess) {
      throw new ForbiddenException("Vous n'avez pas accès à ce projet");
    }

    if (farm.status === FarmStatus.archived) {
      throw new BadRequestException("Impossible d'activer un projet archivé");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { activeFarmId: farmId }
    });

    return { activeFarmId: farmId };
  }

  async getActiveFarm(user: User): Promise<Farm | null> {
    if (!user.activeFarmId) {
      return null;
    }
    return this.prisma.farm.findFirst({
      where: { id: user.activeFarmId, status: FarmStatus.active }
    });
  }

  async getActiveOrFirstFarm(user: User): Promise<Farm | null> {
    if (user.activeFarmId) {
      const active = await this.prisma.farm.findFirst({
        where: { id: user.activeFarmId, status: FarmStatus.active }
      });
      if (active) return active;
    }

    const firstActive = await this.prisma.farm.findFirst({
      where: {
        OR: [
          { ownerId: user.id },
          { memberships: { some: { userId: user.id } } }
        ],
        status: FarmStatus.active
      },
      orderBy: { createdAt: "asc" }
    });

    if (firstActive && !user.activeFarmId) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { activeFarmId: firstActive.id }
      });
    }

    return firstActive;
  }
}
