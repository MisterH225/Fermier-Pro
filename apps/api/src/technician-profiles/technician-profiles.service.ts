import {
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { Prisma, ProfileType, TaskStatus } from "@prisma/client";
import { FarmAccessService } from "../common/farm-access.service";
import { PrismaService } from "../prisma/prisma.service";
import type { UpsertTechnicianProfileDto } from "./dto/upsert-technician-profile.dto";

@Injectable()
export class TechnicianProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService
  ) {}

  async ensureRow(userId: string) {
    return this.prisma.technicianProfile.upsert({
      where: { userId },
      create: { userId },
      update: {}
    });
  }

  async upsertMe(user: User, dto: UpsertTechnicianProfileDto) {
    await this.ensureProfileType(user.id, ProfileType.technician);
    return this.prisma.technicianProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        experienceYears: dto.experienceYears,
        specializations: dto.specializations ?? [],
        formation: dto.formation,
        profilePhotoUrl: dto.profilePhotoUrl,
        onboardingComplete: dto.onboardingComplete ?? false
      },
      update: {
        ...(dto.experienceYears !== undefined
          ? { experienceYears: dto.experienceYears }
          : {}),
        ...(dto.specializations !== undefined
          ? { specializations: dto.specializations }
          : {}),
        ...(dto.formation !== undefined ? { formation: dto.formation } : {}),
        ...(dto.profilePhotoUrl !== undefined
          ? { profilePhotoUrl: dto.profilePhotoUrl }
          : {}),
        ...(dto.onboardingComplete !== undefined
          ? { onboardingComplete: dto.onboardingComplete }
          : {})
      }
    });
  }

  async listFarms(user: User) {
    const memberships = await this.prisma.farmMembership.findMany({
      where: { userId: user.id },
      include: { farm: { select: { id: true, name: true, speciesFocus: true } } },
      orderBy: { createdAt: "asc" }
    });
    return memberships.map((m) => ({
      farmId: m.farm.id,
      farmName: m.farm.name,
      speciesFocus: m.farm.speciesFocus,
      role: m.role,
      scopes: m.scopes
    }));
  }

  async dashboard(user: User, farmId?: string) {
    const farms = await this.listFarms(user);
    const activeFarmId = farmId ?? farms[0]?.farmId;
    if (!activeFarmId) {
      return {
        farms,
        activeFarmId: null,
        tasksTodayCount: 0,
        alertsCount: 0,
        kpis: {
          activeAlerts: 0,
          overdueVaccines: 0,
          gestationThisWeek: 0,
          criticalStock: 0
        }
      };
    }

    await this.farmAccess.requireFarmAccess(user.id, activeFarmId);

    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    const [tasksTodayCount, alertsCount, smartAlerts] = await Promise.all([
      this.prisma.farmTask.count({
        where: {
          farmId: activeFarmId,
          assignedUserId: user.id,
          status: { in: [TaskStatus.todo, TaskStatus.in_progress] },
          dueAt: { gte: start, lt: end }
        }
      }),
      this.prisma.smartAlert.count({
        where: { farmId: activeFarmId, isRead: false }
      }),
      this.prisma.smartAlert.groupBy({
        by: ["module"],
        where: { farmId: activeFarmId, isRead: false },
        _count: { id: true }
      })
    ]);

    const byModule = Object.fromEntries(
      smartAlerts.map((r) => [r.module, r._count.id])
    );

    return {
      farms,
      activeFarmId,
      tasksTodayCount,
      alertsCount,
      kpis: {
        activeAlerts: alertsCount,
        overdueVaccines: byModule.health ?? 0,
        gestationThisWeek: byModule.gestation ?? 0,
        criticalStock: byModule.stock ?? 0
      }
    };
  }

  async activity(user: User, farmId?: string, limit = 20) {
    const memberships = await this.prisma.farmMembership.findMany({
      where: { userId: user.id },
      select: { id: true }
    });
    const memberIds = memberships.map((m) => m.id);
    if (memberIds.length === 0) {
      return [];
    }
    const where: Prisma.MemberActivityLogWhereInput = {
      memberId: { in: memberIds }
    };
    if (farmId) {
      await this.farmAccess.requireFarmAccess(user.id, farmId);
      where.farmId = farmId;
    }
    const rows = await this.prisma.memberActivityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
      include: {
        farm: { select: { id: true, name: true } }
      }
    });
    return rows.map((r) => ({
      id: r.id,
      farmId: r.farmId,
      farmName: r.farm.name,
      module: r.module,
      action: r.action,
      detail: r.detail,
      createdAt: r.createdAt.toISOString()
    }));
  }

  private async ensureProfileType(userId: string, type: ProfileType) {
    const p = await this.prisma.profile.findFirst({
      where: { userId, type }
    });
    if (!p) {
      throw new NotFoundException("Profil technicien introuvable");
    }
  }
}
