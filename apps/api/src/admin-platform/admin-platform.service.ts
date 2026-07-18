import {
  Injectable,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException
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
import { MerchantSubscriptionBillingService } from "../merchant-shop/merchant-subscription-billing.service";
import { ProducerSubscriptionBillingService } from "../producer-subscription/producer-subscription-billing.service";
import type {
  CreateInstitutionConsoleUserDto,
  CreateSanitaryAlertDto,
  CreateSuperAdminDto,
  UpdateInstitutionConsoleUserDto,
  UpdatePlatformSettingsDto
} from "./dto/admin-platform.dto";
import {
  type AdminConsoleMenuPermissions,
  parseMenuPermissions
} from "./admin-console-menu.constants";
import {
  parseStatSectionPermissions,
  sanitizeStatSectionPermissions
} from "./institution-stats-sections.constants";
import {
  parseScheduledReportsConfig,
  sanitizeScheduledReportsConfig
} from "./institution-scheduled-reports.util";
import {
  buildZoneKey,
  farmMatchesScope,
  resolveFarmLocation,
  scopeBoundsFor,
  type AdminDepartmentRef,
  type HealthMapGranularity
} from "./health-map-geo.helper";
import {
  assertNoNominativeFields,
  maskLowHealthMapZones,
  type PrivacyHealthMapZone
} from "./institution-privacy.util";
import { normalizeDiagnosis } from "./region-stats-p28.util";

export type HealthMapOutputMode = "detailed" | "aggregated";

export type HealthMapDetailedZone = {
  id: string;
  label: string;
  level: HealthMapGranularity;
  parentLabel: string | null;
  centerLat: number | null;
  centerLng: number | null;
  activeCases: number;
  totalCasesInPeriod: number;
  farmCount: number;
  topDiseases: Array<{ name: string; count: number }>;
};

export type HealthMapDetailedPoint = {
  recordId: string;
  farmId: string;
  farmName: string;
  lat: number;
  lng: number;
  diagnosis: string;
  severity: string | null;
  zoneId: string;
  city: string | null;
  sectorLabel: string | null;
};

export type HealthMapDetailedResponse = {
  periodDays: number;
  granularity: HealthMapGranularity;
  truncated: boolean;
  zones: HealthMapDetailedZone[];
  regions: Array<{
    country: string;
    activeCases: number;
    totalCases: number;
    farmCount: number;
    topDiseases: Array<{ name: string; count: number }>;
  }>;
  points: HealthMapDetailedPoint[];
};

export type HealthMapAggregatedResponse = {
  mode: "aggregated";
  periodDays: number;
  granularity: HealthMapGranularity;
  truncated: boolean;
  zones: PrivacyHealthMapZone[];
};

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
    private readonly supabaseAdmin: SupabaseAdminService,
    private readonly merchantBilling: MerchantSubscriptionBillingService,
    private readonly producerBilling: ProducerSubscriptionBillingService
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

  async getHealthMap(
    periodDays?: number,
    granularity?: HealthMapGranularity,
    mode?: "detailed",
    diagnosisFilter?: string
  ): Promise<HealthMapDetailedResponse>;
  async getHealthMap(
    periodDays: number,
    granularity: HealthMapGranularity,
    mode: "aggregated",
    diagnosisFilter?: string
  ): Promise<HealthMapAggregatedResponse>;
  async getHealthMap(
    periodDays = 30,
    granularity: HealthMapGranularity = "sector",
    mode: HealthMapOutputMode = "detailed",
    diagnosisFilter?: string
  ): Promise<HealthMapDetailedResponse | HealthMapAggregatedResponse> {
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const settings = await this.platformSettings.getOrCreateSettingsRow();
    const alertSince = new Date(
      Date.now() - settings.alertPeriodDays * 24 * 60 * 60 * 1000
    );
    const scope = scopeBoundsFor(
      settings.mapGeographicScope,
      (settings.mapCountryCodes as string[] | null) ?? null
    );
    const diagnosisNorm = diagnosisFilter?.trim()
      ? normalizeDiagnosis(diagnosisFilter)
      : null;

    const fetchedRows = await this.prisma.farmHealthRecord.findMany({
      where: {
        kind: FarmHealthRecordKind.disease,
        OR: [
          { disease: { caseStatus: FarmDiseaseCaseStatus.active } },
          { occurredAt: { gte: since } }
        ],
        farm: {
          OR: [{ latitude: { not: null } }, { address: { not: null } }]
        }
      },
      include: {
        disease: {
          select: {
            diagnosis: true,
            caseStatus: true,
            severity: true
          }
        },
        farm: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
            address: true,
            locationSector: true,
            locationCity: true,
            locationCountry: true,
            departmentCode: true
          }
        }
      },
      take: 10000,
      orderBy: { occurredAt: "desc" }
    });

    const truncated = fetchedRows.length >= 10000;
    const rows = diagnosisNorm
      ? fetchedRows.filter(
          (r) => normalizeDiagnosis(r.disease?.diagnosis) === diagnosisNorm
        )
      : fetchedRows;

    const departmentCodes = [
      ...new Set(
        rows
          .map((r) => r.farm.departmentCode)
          .filter((code): code is string => Boolean(code?.trim()))
      )
    ];
    const departmentRefRows =
      departmentCodes.length > 0
        ? await this.prisma.adminRegionRef.findMany({
            where: { code: { in: departmentCodes } },
            include: { parent: { select: { name: true } } }
          })
        : [];
    const departmentRefByCode = new Map<string, AdminDepartmentRef>(
      departmentRefRows.map((row) => [
        row.code,
        {
          code: row.code,
          name: row.name,
          regionName: row.parent?.name ?? null
        }
      ])
    );

    type ZoneBucket = {
      id: string;
      label: string;
      level: HealthMapGranularity;
      parentLabel: string | null;
      centerLat: number | null;
      centerLng: number | null;
      activeCases: number;
      totalCasesInPeriod: number;
      casesInAlertWindow: number;
      diseases: Map<string, number>;
      farms: Set<string>;
      latSum: number;
      lngSum: number;
      coordCount: number;
    };

    const zoneMap = new Map<string, ZoneBucket>();

    const ensureZone = (key: ReturnType<typeof buildZoneKey>): ZoneBucket => {
      const existing = zoneMap.get(key.id);
      if (existing) {
        return existing;
      }
      const bucket: ZoneBucket = {
        id: key.id,
        label: key.label,
        level: key.level,
        parentLabel: key.parentLabel,
        centerLat: key.centerLat,
        centerLng: key.centerLng,
        activeCases: 0,
        totalCasesInPeriod: 0,
        casesInAlertWindow: 0,
        diseases: new Map<string, number>(),
        farms: new Set<string>(),
        latSum: 0,
        lngSum: 0,
        coordCount: 0
      };
      zoneMap.set(key.id, bucket);
      return bucket;
    };

    const points: Array<{
      recordId: string;
      farmId: string;
      farmName: string;
      lat: number;
      lng: number;
      diagnosis: string;
      severity: string | null;
      zoneId: string;
      city: string | null;
      sectorLabel: string | null;
    }> = [];

    for (const r of rows) {
      const loc = resolveFarmLocation({
        address: r.farm.address,
        latitude: r.farm.latitude != null ? Number(r.farm.latitude) : null,
        longitude: r.farm.longitude != null ? Number(r.farm.longitude) : null,
        locationSector: r.farm.locationSector,
        locationCity: r.farm.locationCity,
        locationCountry: r.farm.locationCountry,
        departmentCode: r.farm.departmentCode
      });

      if (!farmMatchesScope(loc, scope)) {
        continue;
      }

      const departmentRef = r.farm.departmentCode
        ? departmentRefByCode.get(r.farm.departmentCode) ?? null
        : null;
      const zoneKey = buildZoneKey(granularity, loc, departmentRef);
      const bucket = ensureZone(zoneKey);
      const inPeriod = r.occurredAt >= since;
      const isActive =
        r.disease?.caseStatus === FarmDiseaseCaseStatus.active;

      if (inPeriod) {
        bucket.totalCasesInPeriod += 1;
        const label = r.disease?.diagnosis?.trim() || "Autre";
        bucket.diseases.set(label, (bucket.diseases.get(label) ?? 0) + 1);
      }
      if (r.occurredAt >= alertSince) {
        bucket.casesInAlertWindow += 1;
      }
      if (isActive) {
        bucket.activeCases += 1;
      }
      bucket.farms.add(r.farmId);
      if (loc.lat != null && loc.lng != null) {
        bucket.latSum += loc.lat;
        bucket.lngSum += loc.lng;
        bucket.coordCount += 1;
      }

      if (
        mode === "detailed" &&
        isActive &&
        loc.lat != null &&
        loc.lng != null &&
        Number.isFinite(loc.lat) &&
        Number.isFinite(loc.lng)
      ) {
        points.push({
          recordId: r.id,
          farmId: r.farmId,
          farmName: r.farm.name,
          lat: loc.lat,
          lng: loc.lng,
          diagnosis: r.disease?.diagnosis ?? "Maladie",
          severity: r.disease?.severity ?? null,
          zoneId: zoneKey.id,
          city: loc.geo.city,
          sectorLabel: loc.geo.sector
        });
      }
    }

    const zones = [...zoneMap.values()]
      .map((b) => {
        const topDiseases = [...b.diseases.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name, count]) => ({ name, count }));
        const centerLat =
          b.coordCount > 0
            ? b.latSum / b.coordCount
            : b.centerLat;
        const centerLng =
          b.coordCount > 0
            ? b.lngSum / b.coordCount
            : b.centerLng;
        return {
          id: b.id,
          label: b.label,
          level: b.level,
          parentLabel: b.parentLabel,
          centerLat,
          centerLng,
          activeCases: b.activeCases,
          totalCasesInPeriod: b.totalCasesInPeriod,
          farmCount: b.farms.size,
          topDiseases
        };
      })
      .filter((z) => z.activeCases > 0 || z.totalCasesInPeriod > 0);

    await this.maybeCreateAutoSanitaryAlerts(
      zones.map((z) => {
        const bucket = zoneMap.get(z.id);
        return {
          id: z.id,
          label: z.label,
          level: z.level,
          casesInAlertWindow: bucket?.casesInAlertWindow ?? 0,
          topDiseases: z.topDiseases
        };
      }),
      settings
    );

    if (mode === "aggregated") {
      const payload = {
        mode: "aggregated" as const,
        periodDays,
        granularity,
        truncated,
        zones: maskLowHealthMapZones(
          zones.map((z) => ({
            zoneId: z.id,
            label: z.label,
            level: z.level,
            farmsAffectedCount: z.farmCount,
            casesCount: z.totalCasesInPeriod,
            activeCasesCount: z.activeCases,
            dominantDiagnoses: z.topDiseases,
            centerLat: z.centerLat,
            centerLng: z.centerLng
          }))
        )
      };
      assertNoNominativeFields(payload);
      return payload;
    }

    // Rétrocompatibilité : `regions` = agrégation pays
    const countryZones = granularity === "country"
      ? zones
      : await this.buildCountryZonesFromRecords(rows, scope, since);

    return {
      periodDays,
      granularity,
      truncated,
      zones,
      regions: countryZones.map((z) => ({
        country: z.label,
        activeCases: z.activeCases,
        totalCases: z.totalCasesInPeriod,
        farmCount: z.farmCount,
        topDiseases: z.topDiseases
      })),
      points
    };
  }

  private async buildCountryZonesFromRecords(
    rows: Array<{
      farmId: string;
      occurredAt: Date;
      farm: {
        address: string | null;
        latitude: Prisma.Decimal | null;
        longitude: Prisma.Decimal | null;
        locationSector: string | null;
        locationCity: string | null;
        locationCountry: string | null;
      };
      disease: {
        caseStatus: FarmDiseaseCaseStatus;
        diagnosis: string | null;
      } | null;
    }>,
    scope: ReturnType<typeof scopeBoundsFor>,
    since: Date
  ) {
    const byCountry = new Map<
      string,
      {
        label: string;
        activeCases: number;
        totalCasesInPeriod: number;
        diseases: Map<string, number>;
        farms: Set<string>;
      }
    >();

    for (const r of rows) {
      const loc = resolveFarmLocation({
        address: r.farm.address,
        latitude: r.farm.latitude != null ? Number(r.farm.latitude) : null,
        longitude: r.farm.longitude != null ? Number(r.farm.longitude) : null,
        locationSector: r.farm.locationSector,
        locationCity: r.farm.locationCity,
        locationCountry: r.farm.locationCountry
      });
      if (!farmMatchesScope(loc, scope)) {
        continue;
      }
      const country = loc.geo.country;
      const bucket = byCountry.get(country) ?? {
        label: country,
        activeCases: 0,
        totalCasesInPeriod: 0,
        diseases: new Map<string, number>(),
        farms: new Set<string>()
      };
      if (r.occurredAt >= since) {
        bucket.totalCasesInPeriod += 1;
        const label = r.disease?.diagnosis?.trim() || "Autre";
        bucket.diseases.set(label, (bucket.diseases.get(label) ?? 0) + 1);
      }
      if (r.disease?.caseStatus === FarmDiseaseCaseStatus.active) {
        bucket.activeCases += 1;
      }
      bucket.farms.add(r.farmId);
      byCountry.set(country, bucket);
    }

    return [...byCountry.values()].map((b) => ({
      label: b.label,
      activeCases: b.activeCases,
      totalCasesInPeriod: b.totalCasesInPeriod,
      farmCount: b.farms.size,
      topDiseases: [...b.diseases.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count }))
    }));
  }

  private async maybeCreateAutoSanitaryAlerts(
    zones: Array<{
      id: string;
      label: string;
      level: HealthMapGranularity;
      casesInAlertWindow: number;
      topDiseases: Array<{ name: string; count: number }>;
    }>,
    settings: {
      alertCaseThreshold: number;
      alertPeriodDays: number;
      alertDefaultLevel: string;
    }
  ) {
    if (settings.alertCaseThreshold <= 0) {
      return;
    }

    const candidates = zones.filter(
      (z) =>
        z.level === "sector" &&
        z.casesInAlertWindow >= settings.alertCaseThreshold
    );
    if (candidates.length === 0) {
      return;
    }

    const existing = await this.prisma.sanitaryAlert.findMany({
      where: {
        isActive: true,
        alertType: "auto",
        regionCode: { in: candidates.map((z) => z.id) }
      },
      select: { regionCode: true }
    });
    const existingIds = new Set(
      existing.map((e) => e.regionCode).filter(Boolean) as string[]
    );

    for (const zone of candidates) {
      if (existingIds.has(zone.id)) {
        continue;
      }
      const top = zone.topDiseases[0]?.name ?? "maladies diverses";
      const level =
        settings.alertDefaultLevel === "critical" ||
        settings.alertDefaultLevel === "info" ||
        settings.alertDefaultLevel === "warning"
          ? settings.alertDefaultLevel
          : "warning";

      const alert = await this.prisma.sanitaryAlert.create({
        data: {
          zoneName: zone.label,
          regionCode: zone.id,
          alertType: "auto",
          level,
          diseaseName: top,
          caseCount: zone.casesInAlertWindow,
          message: `Seuil sanitaire dépassé : ${zone.casesInAlertWindow} cas signalés sur ${settings.alertPeriodDays} j dans ${zone.label} (seuil ${settings.alertCaseThreshold}). Maladie dominante : ${top}.`,
          createdBy: null
        }
      });

      const title =
        level === "critical"
          ? "Alerte sanitaire automatique — critique"
          : "Alerte sanitaire automatique";
      void this.push
        .broadcast(title, alert.message.slice(0, 160), {
          route: "FarmHealth",
          alertId: alert.id,
          level
        })
        .catch(() => undefined);
    }
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

    if (
      dto.marketplaceCommissionRate !== undefined ||
      dto.sellerMarketplaceCommissionRate !== undefined
    ) {
      const current = await this.platformSettings.getAdminSettingsView();
      const buyerRate =
        dto.marketplaceCommissionRate ??
        Number(current.marketplaceCommissionRate);
      const sellerRate =
        dto.sellerMarketplaceCommissionRate ??
        Number(current.sellerMarketplaceCommissionRate);
      if (buyerRate + sellerRate >= 1) {
        throw new BadRequestException(
          "La somme des taux de commission acheteur et vendeur doit rester inférieure à 100 %"
        );
      }
    }

    const previous = await this.platformSettings.getOrCreateSettingsRow();
    const merchantPeriodicityChanging =
      (dto.merchantPremiumBillingUnit !== undefined &&
        dto.merchantPremiumBillingUnit !== previous.merchantPremiumBillingUnit) ||
      (dto.merchantPremiumBillingInterval !== undefined &&
        dto.merchantPremiumBillingInterval !==
          previous.merchantPremiumBillingInterval);
    const producerPeriodicityChanging =
      (dto.producerPremiumBillingUnit !== undefined &&
        dto.producerPremiumBillingUnit !== previous.producerPremiumBillingUnit) ||
      (dto.producerPremiumBillingInterval !== undefined &&
        dto.producerPremiumBillingInterval !==
          previous.producerPremiumBillingInterval);

    await this.prisma.platformSettings.upsert({
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
        sellerMarketplaceCommissionRate:
          dto.sellerMarketplaceCommissionRate ?? 0.05,
        vetCommissionRate: dto.vetCommissionRate ?? 0.05,
        supportPhone: supportPhone ?? null,
        supportTelegramUrl: supportTelegramUrl ?? null,
        withdrawalAutoApproveThreshold:
          dto.withdrawalAutoApproveThreshold ?? 50_000,
        marketplaceWeightArbitrationMinDiffKg:
          dto.marketplaceWeightArbitrationMinDiffKg ?? 1,
        marketplaceWeightArbitrationCumulativeMinDiffKg:
          dto.marketplaceWeightArbitrationCumulativeMinDiffKg ?? 5,
        marketplaceWeightTolerancePercent:
          dto.marketplaceWeightTolerancePercent ?? 3,
        merchantPremiumPriceXof: dto.merchantPremiumPriceXof ?? 5000,
        merchantPremiumMaxShops: dto.merchantPremiumMaxShops ?? 3,
        merchantPremiumBillingUnit: dto.merchantPremiumBillingUnit ?? "month",
        merchantPremiumBillingInterval: dto.merchantPremiumBillingInterval ?? 1,
        merchantPremiumGraceDays: dto.merchantPremiumGraceDays ?? 7,
        merchantPremiumTrialEnabled: dto.merchantPremiumTrialEnabled ?? false,
        merchantPremiumTrialUnits: dto.merchantPremiumTrialUnits ?? 7,
        merchantPremiumPromoEnabled: dto.merchantPremiumPromoEnabled ?? false,
        merchantPremiumPromoPercentOff: dto.merchantPremiumPromoPercentOff ?? 20,
        merchantPremiumPromoEndsAt: dto.merchantPremiumPromoEndsAt
          ? new Date(dto.merchantPremiumPromoEndsAt)
          : null,
        producerPremiumPriceXof: dto.producerPremiumPriceXof ?? 5000,
        producerPremiumBillingUnit: dto.producerPremiumBillingUnit ?? "month",
        producerPremiumBillingInterval: dto.producerPremiumBillingInterval ?? 1,
        producerPremiumGraceDays: dto.producerPremiumGraceDays ?? 7,
        producerPremiumTrialEnabled: dto.producerPremiumTrialEnabled ?? false,
        producerPremiumTrialUnits: dto.producerPremiumTrialUnits ?? 7,
        producerPremiumPromoEnabled: dto.producerPremiumPromoEnabled ?? false,
        producerPremiumPromoPercentOff: dto.producerPremiumPromoPercentOff ?? 20,
        producerPremiumPromoEndsAt: dto.producerPremiumPromoEndsAt
          ? new Date(dto.producerPremiumPromoEndsAt)
          : null
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
        ...(dto.sellerMarketplaceCommissionRate !== undefined
          ? { sellerMarketplaceCommissionRate: dto.sellerMarketplaceCommissionRate }
          : {}),
        ...(dto.vetCommissionRate !== undefined
          ? { vetCommissionRate: dto.vetCommissionRate }
          : {}),
        ...(supportPhone !== undefined ? { supportPhone } : {}),
        ...(supportTelegramUrl !== undefined ? { supportTelegramUrl } : {}),
        ...(dto.withdrawalAutoApproveThreshold !== undefined
          ? {
              withdrawalAutoApproveThreshold:
                dto.withdrawalAutoApproveThreshold
            }
          : {}),
        ...(dto.marketplaceWeightArbitrationMinDiffKg !== undefined
          ? {
              marketplaceWeightArbitrationMinDiffKg:
                dto.marketplaceWeightArbitrationMinDiffKg
            }
          : {}),
        ...(dto.marketplaceWeightArbitrationCumulativeMinDiffKg !== undefined
          ? {
              marketplaceWeightArbitrationCumulativeMinDiffKg:
                dto.marketplaceWeightArbitrationCumulativeMinDiffKg
            }
          : {}),
        ...(dto.marketplaceWeightTolerancePercent !== undefined
          ? {
              marketplaceWeightTolerancePercent:
                dto.marketplaceWeightTolerancePercent
            }
          : {}),
        ...(dto.merchantPremiumPriceXof !== undefined
          ? { merchantPremiumPriceXof: dto.merchantPremiumPriceXof }
          : {}),
        ...(dto.merchantPremiumMaxShops !== undefined
          ? { merchantPremiumMaxShops: dto.merchantPremiumMaxShops }
          : {}),
        ...(dto.merchantPremiumBillingUnit !== undefined
          ? { merchantPremiumBillingUnit: dto.merchantPremiumBillingUnit }
          : {}),
        ...(dto.merchantPremiumBillingInterval !== undefined
          ? { merchantPremiumBillingInterval: dto.merchantPremiumBillingInterval }
          : {}),
        ...(dto.merchantPremiumGraceDays !== undefined
          ? { merchantPremiumGraceDays: dto.merchantPremiumGraceDays }
          : {}),
        ...(dto.merchantPremiumTrialEnabled !== undefined
          ? { merchantPremiumTrialEnabled: dto.merchantPremiumTrialEnabled }
          : {}),
        ...(dto.merchantPremiumTrialUnits !== undefined
          ? { merchantPremiumTrialUnits: dto.merchantPremiumTrialUnits }
          : {}),
        ...(dto.merchantPremiumPromoEnabled !== undefined
          ? { merchantPremiumPromoEnabled: dto.merchantPremiumPromoEnabled }
          : {}),
        ...(dto.merchantPremiumPromoPercentOff !== undefined
          ? { merchantPremiumPromoPercentOff: dto.merchantPremiumPromoPercentOff }
          : {}),
        ...(dto.merchantPremiumPromoEndsAt !== undefined
          ? {
              merchantPremiumPromoEndsAt: dto.merchantPremiumPromoEndsAt
                ? new Date(dto.merchantPremiumPromoEndsAt)
                : null
            }
          : {}),
        ...(dto.producerPremiumPriceXof !== undefined
          ? { producerPremiumPriceXof: dto.producerPremiumPriceXof }
          : {}),
        ...(dto.producerPremiumBillingUnit !== undefined
          ? { producerPremiumBillingUnit: dto.producerPremiumBillingUnit }
          : {}),
        ...(dto.producerPremiumBillingInterval !== undefined
          ? { producerPremiumBillingInterval: dto.producerPremiumBillingInterval }
          : {}),
        ...(dto.producerPremiumGraceDays !== undefined
          ? { producerPremiumGraceDays: dto.producerPremiumGraceDays }
          : {}),
        ...(dto.producerPremiumTrialEnabled !== undefined
          ? { producerPremiumTrialEnabled: dto.producerPremiumTrialEnabled }
          : {}),
        ...(dto.producerPremiumTrialUnits !== undefined
          ? { producerPremiumTrialUnits: dto.producerPremiumTrialUnits }
          : {}),
        ...(dto.producerPremiumPromoEnabled !== undefined
          ? { producerPremiumPromoEnabled: dto.producerPremiumPromoEnabled }
          : {}),
        ...(dto.producerPremiumPromoPercentOff !== undefined
          ? { producerPremiumPromoPercentOff: dto.producerPremiumPromoPercentOff }
          : {}),
        ...(dto.producerPremiumPromoEndsAt !== undefined
          ? {
              producerPremiumPromoEndsAt: dto.producerPremiumPromoEndsAt
                ? new Date(dto.producerPremiumPromoEndsAt)
                : null
            }
          : {})
      }
    });
    this.platformSettings.invalidateCache();

    if (merchantPeriodicityChanging) {
      const unit =
        dto.merchantPremiumBillingUnit ?? previous.merchantPremiumBillingUnit;
      const interval =
        dto.merchantPremiumBillingInterval ??
        previous.merchantPremiumBillingInterval;
      await this.merchantBilling.realignActiveNextBillingAt(unit, interval);
    }
    if (producerPeriodicityChanging) {
      const unit =
        dto.producerPremiumBillingUnit ?? previous.producerPremiumBillingUnit;
      const interval =
        dto.producerPremiumBillingInterval ??
        previous.producerPremiumBillingInterval;
      await this.producerBilling.realignActiveNextBillingAt(unit, interval);
    }

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
    const rows = await this.prisma.superAdmin.findMany({
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
    return rows.map((row) => this.mapSuperAdminRow(row));
  }

  private mapSuperAdminRow(row: {
    id: string;
    userId: string;
    createdBy: string | null;
    createdAt: Date;
    user: {
      id: string;
      fullName: string | null;
      email: string | null;
      createdAt: Date;
    };
  }) {
    return {
      id: row.id,
      userId: row.userId,
      email: row.user.email,
      fullName: row.user.fullName,
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy
    };
  }

  async createSuperAdmin(creator: User, dto: CreateSuperAdminDto) {
    if (!this.supabaseAdmin.isConfigured()) {
      throw new ServiceUnavailableException(
        "Supabase admin non configuré (SUPABASE_SERVICE_ROLE_KEY)"
      );
    }

    const email = dto.email.trim().toLowerCase();
    const existingAdmin = await this.prisma.superAdmin.findFirst({
      where: {
        user: { email: { equals: email, mode: "insensitive" } }
      }
    });
    if (existingAdmin) {
      throw new ConflictException("Cet email est déjà administrateur");
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      include: { superAdmin: true }
    });

    if (existingUser?.superAdmin) {
      throw new ConflictException("Cet utilisateur est déjà administrateur");
    }

    let userId = existingUser?.id;

    try {
      if (existingUser?.supabaseUserId) {
        await this.supabaseAdmin.updateAuthUserPassword(
          existingUser.supabaseUserId,
          dto.password
        );
      } else {
        const authUser = await this.supabaseAdmin.createAuthUser(
          email,
          dto.password
        );
        const fullName = dto.fullName?.trim() || null;
        if (existingUser) {
          const updated = await this.prisma.user.update({
            where: { id: existingUser.id },
            data: {
              supabaseUserId: authUser.id,
              email,
              ...(fullName ? { fullName } : {})
            }
          });
          userId = updated.id;
        } else {
          const created = await this.prisma.user.create({
            data: {
              supabaseUserId: authUser.id,
              email,
              fullName
            }
          });
          userId = created.id;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("already been registered") || msg.includes("422")) {
        throw new ConflictException(
          "Un compte existe déjà avec cet email. Contactez le support pour le lier."
        );
      }
      throw new BadRequestException(
        `Impossible de créer le compte administrateur : ${msg.slice(0, 200)}`
      );
    }

    if (!userId) {
      throw new BadRequestException("Utilisateur administrateur introuvable après création");
    }

    const row = await this.prisma.superAdmin.create({
      data: {
        userId,
        createdBy: creator.id
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            createdAt: true
          }
        }
      }
    });

    return this.mapSuperAdminRow(row);
  }

  async removeSuperAdmin(actor: User, targetUserId: string) {
    if (actor.id === targetUserId) {
      throw new ForbiddenException(
        "Vous ne pouvez pas retirer vos propres droits administrateur"
      );
    }

    const row = await this.prisma.superAdmin.findUnique({
      where: { userId: targetUserId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            createdAt: true
          }
        }
      }
    });
    if (!row) {
      throw new NotFoundException("Administrateur introuvable");
    }

    const total = await this.prisma.superAdmin.count();
    if (total <= 1) {
      throw new ForbiddenException(
        "Impossible de supprimer le dernier administrateur"
      );
    }

    await this.prisma.superAdmin.delete({ where: { id: row.id } });
    return { ok: true as const, removed: this.mapSuperAdminRow(row) };
  }

  private mapInstitutionConsoleRow(row: {
    id: string;
    userId: string;
    institutionLabel: string | null;
    menuPermissions: unknown;
    statSectionPermissions: unknown;
    scheduledReports: unknown;
    isActive: boolean;
    invitedBy: string | null;
    invitedAt: Date;
    acceptedAt: Date | null;
    createdAt: Date;
    user: {
      id: string;
      fullName: string | null;
      email: string | null;
      createdAt: Date;
    };
  }) {
    return {
      id: row.id,
      userId: row.userId,
      email: row.user.email,
      fullName: row.user.fullName,
      institutionLabel: row.institutionLabel,
      menuPermissions: parseMenuPermissions(row.menuPermissions),
      statSectionPermissions: parseStatSectionPermissions(
        row.statSectionPermissions
      ),
      scheduledReports:
        parseScheduledReportsConfig(row.scheduledReports) ?? {
          isActive: false,
          cadence: "monthly",
          format: "pdf",
          sections: []
        },
      isActive: row.isActive,
      invitedBy: row.invitedBy,
      invitedAt: row.invitedAt.toISOString(),
      acceptedAt: row.acceptedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString()
    };
  }

  private sanitizeMenuPermissions(
    input?: Record<string, "read" | "write">
  ): AdminConsoleMenuPermissions {
    return parseMenuPermissions(input ?? {});
  }

  private sanitizeStatSectionPermissions(
    input?: Record<string, boolean>
  ) {
    return sanitizeStatSectionPermissions(input);
  }

  private sanitizeScheduledReports(
    input?: Record<string, unknown>
  ) {
    return sanitizeScheduledReportsConfig(
      input as Parameters<typeof sanitizeScheduledReportsConfig>[0]
    );
  }

  async listInstitutionConsoleUsers() {
    const rows = await this.prisma.institutionConsoleUser.findMany({
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
    return rows.map((row) => this.mapInstitutionConsoleRow(row));
  }

  async createInstitutionConsoleUser(
    creator: User,
    dto: CreateInstitutionConsoleUserDto
  ) {
    if (!this.supabaseAdmin.isConfigured()) {
      throw new ServiceUnavailableException(
        "Supabase admin non configuré (SUPABASE_SERVICE_ROLE_KEY)"
      );
    }

    const email = dto.email.trim().toLowerCase();
    const menuPermissions = this.sanitizeMenuPermissions(dto.menuPermissions);
    if (Object.keys(menuPermissions).length === 0) {
      throw new BadRequestException(
        "Au moins un menu doit être autorisé (lecture ou écriture)"
      );
    }
    const statSectionPermissions = this.sanitizeStatSectionPermissions(
      dto.statSectionPermissions
    );
    const scheduledReports = this.sanitizeScheduledReports(
      dto.scheduledReports
    );

    const existingSuper = await this.prisma.superAdmin.findFirst({
      where: { user: { email: { equals: email, mode: "insensitive" } } }
    });
    if (existingSuper) {
      throw new ConflictException("Cet email est déjà SuperAdmin");
    }

    const existingInstitution = await this.prisma.institutionConsoleUser.findFirst({
      where: { user: { email: { equals: email, mode: "insensitive" } } }
    });
    if (existingInstitution) {
      throw new ConflictException(
        "Cet email a déjà un accès institution sur la console"
      );
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } }
    });

    const redirectTo =
      dto.inviteRedirectTo?.trim() ||
      process.env.ADMIN_CONSOLE_INVITE_REDIRECT_TO?.trim() ||
      process.env.NEXT_PUBLIC_ADMIN_URL?.replace(/\/$/, "") + "/auth/callback" ||
      "http://localhost:3001/auth/callback";

    let userId = existingUser?.id;
    const fullName = dto.fullName?.trim() || null;
    const institutionLabel = dto.institutionLabel?.trim() || null;

    try {
      if (existingUser?.supabaseUserId) {
        await this.supabaseAdmin.sendPasswordRecoveryEmail(email, redirectTo);
      } else {
        const authUser = await this.supabaseAdmin.inviteAuthUserByEmail(
          email,
          redirectTo
        );
        if (existingUser) {
          const updated = await this.prisma.user.update({
            where: { id: existingUser.id },
            data: {
              supabaseUserId: authUser.id,
              email,
              ...(fullName ? { fullName } : {})
            }
          });
          userId = updated.id;
        } else {
          const created = await this.prisma.user.create({
            data: {
              supabaseUserId: authUser.id,
              email,
              fullName
            }
          });
          userId = created.id;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(
        `Impossible d'inviter l'utilisateur institution : ${msg.slice(0, 240)}`
      );
    }

    if (!userId) {
      throw new BadRequestException("Utilisateur institution introuvable après invitation");
    }

    const row = await this.prisma.institutionConsoleUser.create({
      data: {
        userId,
        institutionLabel,
        menuPermissions,
        statSectionPermissions,
        scheduledReports,
        invitedBy: creator.id
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            createdAt: true
          }
        }
      }
    });

    return this.mapInstitutionConsoleRow(row);
  }

  async getInstitutionConsoleUser(id: string) {
    const row = await this.getInstitutionConsoleUserOrThrow(id);
    return this.mapInstitutionConsoleRow(row);
  }

  async updateInstitutionConsoleUser(
    id: string,
    dto: UpdateInstitutionConsoleUserDto
  ) {
    await this.getInstitutionConsoleUserOrThrow(id);
    const menuPermissions =
      dto.menuPermissions !== undefined
        ? this.sanitizeMenuPermissions(dto.menuPermissions)
        : undefined;
    if (menuPermissions && Object.keys(menuPermissions).length === 0) {
      throw new BadRequestException(
        "Au moins un menu doit rester autorisé (lecture ou écriture)"
      );
    }
    const statSectionPermissions =
      dto.statSectionPermissions !== undefined
        ? this.sanitizeStatSectionPermissions(dto.statSectionPermissions)
        : undefined;
    const scheduledReports =
      dto.scheduledReports !== undefined
        ? this.sanitizeScheduledReports(dto.scheduledReports)
        : undefined;

    const row = await this.prisma.institutionConsoleUser.update({
      where: { id },
      data: {
        ...(dto.institutionLabel !== undefined
          ? { institutionLabel: dto.institutionLabel.trim() || null }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(menuPermissions !== undefined ? { menuPermissions } : {}),
        ...(statSectionPermissions !== undefined
          ? { statSectionPermissions }
          : {}),
        ...(scheduledReports !== undefined ? { scheduledReports } : {})
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            createdAt: true
          }
        }
      }
    });
    return this.mapInstitutionConsoleRow(row);
  }

  async removeInstitutionConsoleUser(id: string) {
    const row = await this.getInstitutionConsoleUserOrThrow(id);
    await this.prisma.institutionConsoleUser.delete({ where: { id } });
    return { ok: true as const, removed: this.mapInstitutionConsoleRow(row) };
  }

  async resendInstitutionConsoleInvite(id: string, redirectTo?: string) {
    if (!this.supabaseAdmin.isConfigured()) {
      throw new ServiceUnavailableException(
        "Supabase admin non configuré (SUPABASE_SERVICE_ROLE_KEY)"
      );
    }
    const row = await this.getInstitutionConsoleUserOrThrow(id);
    const email = row.user.email;
    if (!email) {
      throw new BadRequestException("Email utilisateur manquant");
    }
    const target =
      redirectTo?.trim() ||
      process.env.ADMIN_CONSOLE_INVITE_REDIRECT_TO?.trim() ||
      process.env.NEXT_PUBLIC_ADMIN_URL?.replace(/\/$/, "") + "/auth/callback" ||
      "http://localhost:3001/auth/callback";

    try {
      if (row.user.supabaseUserId) {
        await this.supabaseAdmin.sendPasswordRecoveryEmail(email, target);
      } else {
        const authUser = await this.supabaseAdmin.inviteAuthUserByEmail(
          email,
          target
        );
        await this.prisma.user.update({
          where: { id: row.userId },
          data: { supabaseUserId: authUser.id }
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(
        `Impossible de renvoyer l'invitation : ${msg.slice(0, 240)}`
      );
    }

    return { ok: true as const };
  }

  private async getInstitutionConsoleUserOrThrow(id: string) {
    const row = await this.prisma.institutionConsoleUser.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            createdAt: true,
            supabaseUserId: true
          }
        }
      }
    });
    if (!row) {
      throw new NotFoundException("Accès institution introuvable");
    }
    return row;
  }

  /** Fermes dont le rattachement départemental n'a pas pu être résolu automatiquement. */
  async listUnresolvedFarmGeo(limit = 100) {
    const take = Math.min(Math.max(limit, 1), 500);
    const farms = await this.prisma.farm.findMany({
      where: {
        status: "active",
        geoResolutionSource: "unresolved"
      },
      orderBy: { updatedAt: "desc" },
      take,
      select: {
        id: true,
        name: true,
        locationCity: true,
        locationSector: true,
        address: true,
        latitude: true,
        longitude: true,
        departmentCode: true,
        geoResolutionSource: true,
        ownerId: true,
        updatedAt: true
      }
    });
    return {
      count: farms.length,
      farms: farms.map((f) => ({
        ...f,
        latitude: f.latitude != null ? Number(f.latitude) : null,
        longitude: f.longitude != null ? Number(f.longitude) : null
      }))
    };
  }

  /** Assignation manuelle d'un département (source=manual). */
  async patchFarmGeo(farmId: string, departmentCode: string) {
    const dept = await this.prisma.adminRegionRef.findUnique({
      where: { code: departmentCode }
    });
    if (!dept || dept.level !== "department") {
      throw new BadRequestException(
        "departmentCode invalide : département introuvable dans AdminRegionRef."
      );
    }
    const farm = await this.prisma.farm.findUnique({ where: { id: farmId } });
    if (!farm) {
      throw new NotFoundException("Ferme introuvable");
    }
    const updated = await this.prisma.farm.update({
      where: { id: farmId },
      data: {
        departmentCode,
        geoResolutionSource: "manual"
      },
      select: {
        id: true,
        name: true,
        departmentCode: true,
        geoResolutionSource: true,
        locationCity: true,
        latitude: true,
        longitude: true
      }
    });
    return {
      ...updated,
      latitude: updated.latitude != null ? Number(updated.latitude) : null,
      longitude: updated.longitude != null ? Number(updated.longitude) : null,
      departmentName: dept.name
    };
  }
}
