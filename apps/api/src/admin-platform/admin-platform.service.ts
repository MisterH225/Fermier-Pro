import {
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  FarmDiseaseCaseStatus,
  FarmHealthRecordKind,
  ProfileType,
  AccountStatus,
  VetVerificationStatus,
  Prisma
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PlatformSettingsService } from "../platform-settings/platform-settings.service";
import { PushNotificationsService } from "../push-notifications/push-notifications.service";
import { SupabaseAdminService } from "../auth/supabase-admin.service";
import { VetsService } from "../vets/vets.service";
import type {
  CreateSanitaryAlertDto,
  UpdatePlatformSettingsDto
} from "./dto/admin-platform.dto";

function lastDaysKeys(days: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

@Injectable()
export class AdminPlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vets: VetsService,
    private readonly push: PushNotificationsService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly supabaseAdmin: SupabaseAdminService
  ) {}

  async assertSuperAdmin(userId: string) {
    const row = await this.prisma.superAdmin.findUnique({
      where: { userId }
    });
    if (!row) {
      throw new NotFoundException("SuperAdmin introuvable");
    }
    return row;
  }

  async getOverview() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      activeFarms,
      totalUsers,
      verifiedVets,
      pendingVets,
      activeAnimals,
      activeDiseases,
      monthExpenses,
      monthRevenues,
      countries,
      recentUsers,
      recentVets,
      recentAlerts
    ] = await Promise.all([
      this.prisma.farm.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.vetProfile.count({
        where: { verificationStatus: VetVerificationStatus.verified }
      }),
      this.prisma.vetProfile.count({
        where: { verificationStatus: VetVerificationStatus.pending }
      }),
      this.prisma.animal.count({ where: { status: "active" } }),
      this.prisma.farmHealthRecord.count({
        where: {
          kind: FarmHealthRecordKind.disease,
          disease: { caseStatus: FarmDiseaseCaseStatus.active }
        }
      }),
      this.prisma.farmExpense.count({
        where: { occurredAt: { gte: monthStart } }
      }),
      this.prisma.farmRevenue.count({
        where: { occurredAt: { gte: monthStart } }
      }),
      this.prisma.vetProfile.findMany({
        select: { locationCountry: true },
        distinct: ["locationCountry"]
      }),
      this.prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          fullName: true,
          email: true,
          createdAt: true,
          profiles: { select: { type: true } }
        }
      }),
      this.prisma.vetProfile.findMany({
        where: { verificationStatus: VetVerificationStatus.pending },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          fullName: true,
          locationCountry: true,
          createdAt: true
        }
      }),
      this.prisma.sanitaryAlert.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: 8
      })
    ]);

    const signupsByDay = await this.prisma.user.groupBy({
      by: ["createdAt"],
      where: { createdAt: { gte: since30 } },
      _count: { _all: true }
    });

    const dayMap = new Map<string, number>();
    for (const row of signupsByDay) {
      const k = row.createdAt.toISOString().slice(0, 10);
      dayMap.set(k, (dayMap.get(k) ?? 0) + row._count._all);
    }

    const signupSeries = lastDaysKeys(30).map((day) => ({
      day,
      count: dayMap.get(day) ?? 0
    }));

    const profileCounts = await this.prisma.profile.groupBy({
      by: ["type"],
      _count: { _all: true }
    });

    const farmsByCountry = await this.prisma.vetProfile.groupBy({
      by: ["locationCountry"],
      _count: { _all: true }
    });

    return {
      kpis: {
        activeFarms,
        totalUsers,
        verifiedVets,
        pendingVets,
        activeAnimals,
        activeDiseases,
        monthTransactions: monthExpenses + monthRevenues,
        countriesCovered: countries.filter((c) => c.locationCountry?.trim())
          .length
      },
      charts: {
        signups30d: signupSeries,
        farmsByCountry: farmsByCountry.map((r) => ({
          country: r.locationCountry,
          count: r._count._all
        })),
        profileDistribution: profileCounts.map((r) => ({
          profile: r.type,
          count: r._count._all
        }))
      },
      recentActivity: {
        signups: recentUsers.map((u) => ({
          id: u.id,
          name: u.fullName ?? u.email ?? u.id,
          profileTypes: u.profiles.map((p) => p.type),
          createdAt: u.createdAt.toISOString()
        })),
        vetRequests: recentVets.map((v) => ({
          id: v.id,
          name: v.fullName,
          country: v.locationCountry,
          createdAt: v.createdAt.toISOString()
        })),
        sanitaryAlerts: recentAlerts.map((a) => ({
          id: a.id,
          zoneName: a.zoneName,
          level: a.level,
          message: a.message,
          createdAt: a.createdAt.toISOString()
        }))
      }
    };
  }

  async listVetProfiles(status?: string) {
    const st = status?.trim().toLowerCase();
    const where: Prisma.VetProfileWhereInput = {};
    if (
      st &&
      (Object.values(VetVerificationStatus) as string[]).includes(st)
    ) {
      where.verificationStatus = st as VetVerificationStatus;
    }
    return this.prisma.vetProfile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            avatarUrl: true,
            createdAt: true
          }
        }
      },
      take: 200
    });
  }

  async getVetProfile(id: string) {
    const row = await this.prisma.vetProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            avatarUrl: true,
            createdAt: true
          }
        }
      }
    });
    if (!row) {
      throw new NotFoundException("Profil vétérinaire introuvable");
    }
    let diplomaPhotoUrl = row.diplomaPhotoUrl;
    if (diplomaPhotoUrl?.trim()) {
      const signed = await this.supabaseAdmin.createSignedStorageUrl(
        diplomaPhotoUrl.trim(),
        3600
      );
      if (signed) {
        diplomaPhotoUrl = signed;
      }
    }
    return { ...row, diplomaPhotoUrl };
  }

  async verifyVetProfile(vetId: string) {
    const row = await this.vets.verifyProfile(vetId);
    const profile = await this.prisma.vetProfile.findUnique({
      where: { id: vetId },
      select: { userId: true, fullName: true }
    });
    if (profile) {
      void this.push
        .sendToUser(
          profile.userId,
          "Profil vétérinaire approuvé",
          "Votre dossier a été validé. Vous êtes visible dans la recherche vétérinaire.",
          { route: "VeterinarianDashboard" }
        )
        .catch(() => undefined);
    }
    return row;
  }

  async rejectVetProfile(vetId: string, reason: string) {
    const row = await this.vets.rejectProfile(vetId, reason);
    const profile = await this.prisma.vetProfile.findUnique({
      where: { id: vetId },
      select: { userId: true }
    });
    if (profile) {
      void this.push
        .sendToUser(
          profile.userId,
          "Profil vétérinaire refusé",
          reason.slice(0, 180),
          { route: "VetOnboarding" }
        )
        .catch(() => undefined);
    }
    return row;
  }

  async listUsers(query: {
    search?: string;
    profileType?: string;
    isActive?: boolean;
    accountStatus?: AccountStatus;
    skip?: number;
    take?: number;
  }) {
    const take = Math.min(query.take ?? 50, 100);
    const skip = query.skip ?? 0;
    const search = query.search?.trim();
    const pt = query.profileType?.trim() as ProfileType | undefined;

    const where: Prisma.UserWhereInput = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } }
      ];
    }
    if (pt && (Object.values(ProfileType) as string[]).includes(pt)) {
      where.profiles = { some: { type: pt } };
    }
    if (query.accountStatus) {
      where.accountStatus = query.accountStatus;
    } else if (query.isActive === true) {
      where.isActive = true;
      where.accountStatus = AccountStatus.active;
    } else if (query.isActive === false) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { isActive: false },
            { accountStatus: { not: AccountStatus.active } }
          ]
        }
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          profiles: {
            select: {
              id: true,
              type: true,
              displayName: true,
              profileStatus: true,
              createdAt: true
            }
          },
          ownedFarms: { select: { id: true, name: true }, take: 1 },
          vetProfile: { select: { id: true, verificationStatus: true } }
        }
      }),
      this.prisma.user.count({ where })
    ]);

    return {
      total,
      items: items.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        avatarUrl: u.avatarUrl,
        isActive: u.isActive,
        accountStatus: u.accountStatus,
        suspendedUntil: u.suspendedUntil?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
        profiles: u.profiles.map((p) => ({
          ...p,
          createdAt: p.createdAt.toISOString()
        })),
        vetProfile: u.vetProfile,
        primaryFarm: u.ownedFarms[0] ?? null
      }))
    };
  }

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profiles: true,
        ownedFarms: {
          include: {
            _count: {
              select: {
                animals: { where: { status: "active" } },
                farmHealthRecords: true
              }
            }
          }
        },
        vetProfile: true,
        memberships: {
          include: { farm: { select: { id: true, name: true } } },
          take: 20
        }
      }
    });
    if (!user) {
      throw new NotFoundException("Utilisateur introuvable");
    }

    const farmIds = user.ownedFarms.map((f) => f.id);
    let healthSummary = {
      activeDiseases: 0,
      mortalityRate30d: 0,
      overdueVaccines: 0
    };
    let livestockSummary = {
      totalActive: 0,
      byCategory: [] as Array<{ category: string; count: number }>
    };
    let financeSummary = {
      expenses3m: 0,
      revenues3m: 0,
      netMargin3m: 0
    };
    let gestationSummary = { active: 0, upcomingFarrowings: 0 };
    if (farmIds.length > 0) {
      const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const now = new Date();
      const [
        activeDiseases,
        deaths,
        overdue,
        categoryGroups,
        totalActive,
        expenseSum,
        revenueSum,
        activeGestations,
        upcomingFarrowings
      ] = await Promise.all([
        this.prisma.farmHealthRecord.count({
          where: {
            farmId: { in: farmIds },
            kind: FarmHealthRecordKind.disease,
            disease: { caseStatus: FarmDiseaseCaseStatus.active }
          }
        }),
        this.prisma.livestockExit.aggregate({
          where: {
            farmId: { in: farmIds },
            kind: "mortality",
            occurredAt: { gte: since30 }
          },
          _sum: { headcountAffected: true }
        }),
        this.prisma.healthVaccinationDetail.count({
          where: {
            nextReminderAt: { lt: now },
            healthRecord: { farmId: { in: farmIds } }
          }
        }),
        this.prisma.animal.groupBy({
          by: ["productionCategory"],
          where: { farmId: { in: farmIds }, status: "active" },
          _count: { _all: true }
        }),
        this.prisma.animal.count({
          where: { farmId: { in: farmIds }, status: "active" }
        }),
        this.prisma.farmExpense.aggregate({
          where: { farmId: { in: farmIds }, occurredAt: { gte: since90 } },
          _sum: { amount: true }
        }),
        this.prisma.farmRevenue.aggregate({
          where: { farmId: { in: farmIds }, occurredAt: { gte: since90 } },
          _sum: { amount: true }
        }),
        this.prisma.gestation.count({
          where: { farmId: { in: farmIds }, status: "active" }
        }),
        this.prisma.animal.count({
          where: {
            farmId: { in: farmIds },
            status: "active",
            expectedFarrowingAt: { gte: now }
          }
        })
      ]);
      const activeHead = totalActive;
      const dead = deaths._sum.headcountAffected ?? 0;
      const expenses = Number(expenseSum._sum.amount ?? 0);
      const revenues = Number(revenueSum._sum.amount ?? 0);
      healthSummary = {
        activeDiseases,
        mortalityRate30d:
          activeHead + dead > 0 ? dead / Math.max(1, activeHead + dead) : 0,
        overdueVaccines: overdue
      };
      livestockSummary = {
        totalActive,
        byCategory: categoryGroups.map((g) => ({
          category: g.productionCategory,
          count: g._count._all
        }))
      };
      financeSummary = {
        expenses3m: expenses,
        revenues3m: revenues,
        netMargin3m: revenues - expenses
      };
      gestationSummary = {
        active: activeGestations,
        upcomingFarrowings
      };
    }

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        isActive: user.isActive,
        accountStatus: user.accountStatus,
        suspendedAt: user.suspendedAt?.toISOString() ?? null,
        suspendedReason: user.suspendedReason,
        suspendedUntil: user.suspendedUntil?.toISOString() ?? null,
        bannedAt: user.bannedAt?.toISOString() ?? null,
        bannedReason: user.bannedReason,
        createdAt: user.createdAt.toISOString(),
        homeLocationLabel: user.homeLocationLabel
      },
      profiles: user.profiles.map((p) => ({
        id: p.id,
        type: p.type,
        displayName: p.displayName,
        isDefault: p.isDefault,
        profileStatus: p.profileStatus,
        profileSuspendedReason: p.profileSuspendedReason,
        profileSuspendedAt: p.profileSuspendedAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString()
      })),
      vetProfile: user.vetProfile,
      farms: user.ownedFarms.map((f) => ({
        id: f.id,
        name: f.name,
        latitude: f.latitude,
        longitude: f.longitude,
        address: f.address,
        activeAnimals: f._count.animals,
        healthRecords: f._count.farmHealthRecords
      })),
      memberships: user.memberships,
      healthSummary,
      livestockSummary,
      financeSummary,
      gestationSummary
    };
  }

  async getHealthMap(periodDays = 30) {
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.farmHealthRecord.findMany({
      where: {
        kind: FarmHealthRecordKind.disease,
        occurredAt: { gte: since },
        farm: {
          OR: [{ latitude: { not: null } }, { address: { not: null } }]
        }
      },
      include: {
        disease: { select: { diagnosis: true, caseStatus: true, severity: true } },
        farm: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
            address: true
          }
        }
      },
      take: 5000
    });

    const byCountry = new Map<
      string,
      {
        country: string;
        activeCases: number;
        totalCases: number;
        diseases: Map<string, number>;
        farms: Set<string>;
      }
    >();

    for (const r of rows) {
      const country =
        r.farm.address?.split(",").pop()?.trim() ||
        "Inconnu";
      const bucket = byCountry.get(country) ?? {
        country,
        activeCases: 0,
        totalCases: 0,
        diseases: new Map<string, number>(),
        farms: new Set<string>()
      };
      bucket.totalCases += 1;
      if (r.disease?.caseStatus === FarmDiseaseCaseStatus.active) {
        bucket.activeCases += 1;
      }
      const label = r.disease?.diagnosis?.trim() || "Autre";
      bucket.diseases.set(label, (bucket.diseases.get(label) ?? 0) + 1);
      bucket.farms.add(r.farmId);
      byCountry.set(country, bucket);
    }

    const regions = [...byCountry.values()].map((b) => {
      const topDiseases = [...b.diseases.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count }));
      return {
        country: b.country,
        activeCases: b.activeCases,
        totalCases: b.totalCases,
        farmCount: b.farms.size,
        topDiseases
      };
    });

    const points = rows
      .filter(
        (r) =>
          r.farm.latitude != null &&
          r.farm.longitude != null &&
          r.disease?.caseStatus === FarmDiseaseCaseStatus.active
      )
      .map((r) => ({
        farmId: r.farmId,
        lat: Number(r.farm.latitude),
        lng: Number(r.farm.longitude),
        diagnosis: r.disease?.diagnosis ?? "Maladie",
        severity: r.disease?.severity ?? null
      }));

    return { periodDays, regions, points };
  }

  async getStats(period: "month" | "quarter" | "year" = "month") {
    const now = new Date();
    const since =
      period === "year"
        ? new Date(now.getFullYear(), 0, 1)
        : period === "quarter"
          ? new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          : new Date(now.getFullYear(), now.getMonth(), 1);

    const [diseaseGroups, mortality, users, animals] = await Promise.all([
      this.prisma.healthDiseaseDetail.groupBy({
        by: ["diagnosis"],
        where: {
          healthRecord: {
            kind: FarmHealthRecordKind.disease,
            occurredAt: { gte: since }
          }
        },
        _count: { _all: true }
      }),
      this.prisma.livestockExit.aggregate({
        where: { kind: "mortality", occurredAt: { gte: since } },
        _sum: { headcountAffected: true }
      }),
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.animal.count({ where: { status: "active" } })
    ]);

    return {
      period,
      since: since.toISOString(),
      topDiseases: diseaseGroups
        .sort((a, b) => b._count._all - a._count._all)
        .slice(0, 10)
        .map((g) => ({
          label: g.diagnosis?.trim() || "Autre",
          count: g._count._all
        })),
      mortalityHeadcount: mortality._sum.headcountAffected ?? 0,
      newUsers: users,
      activeAnimals: animals
    };
  }

  async getSettings() {
    return this.platformSettings.getAdminSettingsView();
  }

  async updateSettings(dto: UpdatePlatformSettingsDto) {
    const supportPhone =
      dto.supportPhone !== undefined
        ? this.platformSettings.sanitizeSupportPhoneForStorage(dto.supportPhone)
        : undefined;
    const supportTelegramUrl =
      dto.supportTelegramUrl !== undefined
        ? this.platformSettings.sanitizeSupportTelegramForStorage(
            dto.supportTelegramUrl
          )
        : undefined;

    const row = await this.prisma.platformSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        mapGeographicScope: dto.mapGeographicScope ?? "west_africa",
        mapCountryCodes: dto.mapCountryCodes ?? undefined,
        alertCaseThreshold: dto.alertCaseThreshold ?? 5,
        alertPeriodDays: dto.alertPeriodDays ?? 30,
        alertDefaultLevel: dto.alertDefaultLevel ?? "warning",
        adminNotifyEmail: dto.adminNotifyEmail ?? null,
        reportFrequencyDays: dto.reportFrequencyDays ?? 7,
        marketplaceCommissionRate:
          dto.marketplaceCommissionRate ?? 0.05,
        supportPhone: supportPhone ?? null,
        supportTelegramUrl: supportTelegramUrl ?? null
      },
      update: {
        ...(dto.mapGeographicScope !== undefined
          ? { mapGeographicScope: dto.mapGeographicScope }
          : {}),
        ...(dto.mapCountryCodes !== undefined
          ? { mapCountryCodes: dto.mapCountryCodes }
          : {}),
        ...(dto.alertCaseThreshold !== undefined
          ? { alertCaseThreshold: dto.alertCaseThreshold }
          : {}),
        ...(dto.alertPeriodDays !== undefined
          ? { alertPeriodDays: dto.alertPeriodDays }
          : {}),
        ...(dto.alertDefaultLevel !== undefined
          ? { alertDefaultLevel: dto.alertDefaultLevel }
          : {}),
        ...(dto.adminNotifyEmail !== undefined
          ? { adminNotifyEmail: dto.adminNotifyEmail || null }
          : {}),
        ...(dto.reportFrequencyDays !== undefined
          ? { reportFrequencyDays: dto.reportFrequencyDays }
          : {}),
        ...(dto.marketplaceCommissionRate !== undefined
          ? { marketplaceCommissionRate: dto.marketplaceCommissionRate }
          : {}),
        ...(supportPhone !== undefined ? { supportPhone } : {}),
        ...(supportTelegramUrl !== undefined ? { supportTelegramUrl } : {})
      }
    });
    this.platformSettings.invalidateCache();
    return this.platformSettings.getAdminSettingsView();
  }

  async listSanitaryAlerts(activeOnly = true) {
    return this.prisma.sanitaryAlert.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  async createSanitaryAlert(user: User, dto: CreateSanitaryAlertDto) {
    const alert = await this.prisma.sanitaryAlert.create({
      data: {
        zoneName: dto.zoneName.trim(),
        countryCode: dto.countryCode?.trim() || null,
        regionCode: dto.regionCode?.trim() || null,
        alertType: dto.alertType,
        level: dto.level,
        diseaseName: dto.diseaseName?.trim() || null,
        caseCount: dto.caseCount ?? null,
        message: dto.message.trim(),
        createdBy: user.id
      }
    });

    const title =
      dto.level === "critical"
        ? "Alerte sanitaire critique"
        : dto.level === "warning"
          ? "Alerte sanitaire"
          : "Information sanitaire";
    const body = `${alert.zoneName}: ${dto.message.trim().slice(0, 160)}`;
    void this.push
      .broadcast(title, body, {
        route: "FarmHealth",
        alertId: alert.id,
        level: dto.level
      })
      .catch(() => undefined);

    return alert;
  }

  async listSuperAdmins() {
    return this.prisma.superAdmin.findMany({
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
  }
}
