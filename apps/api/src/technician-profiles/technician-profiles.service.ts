import {
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  Prisma,
  ProfileType,
  TaskStatus,
  TechnicianFormationType
} from "@prisma/client";
import { FarmAccessService } from "../common/farm-access.service";
import { PrismaService } from "../prisma/prisma.service";
import type { SearchTechniciansQueryDto } from "./dto/search-technicians.dto";
import type { UpsertTechnicianProfileDto } from "./dto/upsert-technician-profile.dto";
import {
  parseSpecializations,
  privacyDisplayName
} from "./technician-privacy.helper";

const ACTIVITY_KIND_LABELS: Record<string, string> = {
  expense: "Dépense",
  revenue: "Recette",
  in: "Entrée stock",
  out: "Sortie stock",
  stock_check: "Contrôle de stock",
  vaccination: "Vaccination",
  disease: "Maladie",
  treatment: "Traitement",
  mortality: "Mortalité",
  vet_visit: "Visite vétérinaire",
  weighing: "Pesée"
};

/** Convertit le JSON Prisma `MemberActivityLog.detail` en libellé UI (jamais de JSON brut). */
function serializeActivityDetail(detail: Prisma.JsonValue | null): string | null {
  if (detail == null) {
    return null;
  }
  if (typeof detail === "string") {
    const trimmed = detail.trim();
    if (!trimmed) {
      return null;
    }
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return serializeActivityDetail(parsed as Prisma.JsonObject);
        }
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (typeof detail === "number" || typeof detail === "boolean") {
    return String(detail);
  }
  if (typeof detail === "object" && !Array.isArray(detail)) {
    const record = detail as Record<string, unknown>;
    for (const key of ["summary", "label", "title", "name", "message", "description"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    const kind = record.kind;
    if (typeof kind === "string" && kind.trim()) {
      return ACTIVITY_KIND_LABELS[kind] ?? kind.replace(/[_-]+/g, " ");
    }
  }
  return null;
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function decimalToNumber(v: unknown): number | null {
  if (v == null) {
    return null;
  }
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
}

const FORMATION_LABELS: Record<TechnicianFormationType, string> = {
  diplome: "Diplôme",
  formation_courte: "Formation courte",
  sur_le_tas: "Sur le tas",
  autodidacte: "Autodidacte"
};

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

  private mapProfileRow(
    row: {
      id: string;
      userId: string;
      experienceYears: string | null;
      experienceYearsCount: number | null;
      specializations: unknown;
      formation: string | null;
      formationType: TechnicianFormationType | null;
      formationDetails: string | null;
      graduationYear: number | null;
      pretensionSalarialeMensuelle: Prisma.Decimal | null;
      pretensionCurrency: string;
      locationCity: string | null;
      locationCountry: string | null;
      locationLat: Prisma.Decimal | null;
      locationLng: Prisma.Decimal | null;
      isAvailable: boolean;
      availabilityNote: string | null;
      bio: string | null;
      profilePhotoUrl: string | null;
      isPublic: boolean;
      onboardingComplete: boolean;
      isActive: boolean;
      user?: { fullName: string | null; firstName: string | null; lastName: string | null };
    },
    options?: { publicView?: boolean }
  ) {
    const specs = parseSpecializations(row.specializations);
    const exp =
      row.experienceYearsCount ??
      (row.experienceYears
        ? Number.parseInt(row.experienceYears.replace(/\D/g, ""), 10)
        : null);
    const displayName = row.user
      ? privacyDisplayName(
          row.user.fullName ??
            [row.user.firstName, row.user.lastName].filter(Boolean).join(" ")
        )
      : "—";
    const pretension = decimalToNumber(row.pretensionSalarialeMensuelle);
    return {
      id: row.id,
      userId: row.userId,
      displayName: options?.publicView ? displayName : undefined,
      experienceYearsCount: Number.isFinite(exp!) ? exp : null,
      specializations: specs,
      formation: row.formation,
      formationType: row.formationType,
      formationTypeLabel: row.formationType
        ? FORMATION_LABELS[row.formationType]
        : null,
      formationDetails: row.formationDetails,
      graduationYear: row.graduationYear,
      pretensionSalarialeMensuelle: pretension,
      pretensionCurrency: row.pretensionCurrency,
      locationCity: row.locationCity,
      locationCountry: row.locationCountry,
      locationLabel:
        row.locationCity && row.locationCountry
          ? `${row.locationCity}, ${row.locationCountry}`
          : row.locationCity ?? row.locationCountry ?? null,
      locationLat: decimalToNumber(row.locationLat),
      locationLng: decimalToNumber(row.locationLng),
      isAvailable: row.isAvailable,
      availabilityNote: row.availabilityNote,
      bio: row.bio,
      profilePhotoUrl: row.profilePhotoUrl,
      isPublic: row.isPublic,
      onboardingComplete: row.onboardingComplete,
      isActive: row.isActive
    };
  }

  async getMe(user: User) {
    await this.ensureProfileType(user.id, ProfileType.technician);
    const row = await this.ensureRow(user.id);
    const withUser = await this.prisma.technicianProfile.findUnique({
      where: { id: row.id },
      include: {
        user: {
          select: { fullName: true, firstName: true, lastName: true }
        }
      }
    });
    if (!withUser) {
      throw new NotFoundException("Profil introuvable");
    }
    return this.mapProfileRow(withUser);
  }

  async upsertMe(user: User, dto: UpsertTechnicianProfileDto) {
    await this.ensureProfileType(user.id, ProfileType.technician);
    const experienceYearsCount =
      dto.experienceYearsCount ??
      (dto.experienceYears
        ? Number.parseInt(dto.experienceYears.replace(/\D/g, ""), 10)
        : undefined);

    const data: Prisma.TechnicianProfileUncheckedUpdateInput = {
      ...(dto.experienceYears !== undefined
        ? { experienceYears: dto.experienceYears }
        : {}),
      ...(experienceYearsCount !== undefined &&
      Number.isFinite(experienceYearsCount)
        ? { experienceYearsCount }
        : {}),
      ...(dto.specializations !== undefined
        ? { specializations: dto.specializations }
        : {}),
      ...(dto.formation !== undefined ? { formation: dto.formation } : {}),
      ...(dto.formationType !== undefined
        ? { formationType: dto.formationType }
        : {}),
      ...(dto.formationDetails !== undefined
        ? { formationDetails: dto.formationDetails }
        : {}),
      ...(dto.graduationYear !== undefined
        ? { graduationYear: dto.graduationYear }
        : {}),
      ...(dto.pretensionSalarialeMensuelle !== undefined
        ? {
            pretensionSalarialeMensuelle:
              dto.pretensionSalarialeMensuelle == null
                ? null
                : new Prisma.Decimal(dto.pretensionSalarialeMensuelle)
          }
        : {}),
      ...(dto.pretensionCurrency !== undefined
        ? { pretensionCurrency: dto.pretensionCurrency }
        : {}),
      ...(dto.locationCity !== undefined
        ? { locationCity: dto.locationCity }
        : {}),
      ...(dto.locationCountry !== undefined
        ? { locationCountry: dto.locationCountry }
        : {}),
      ...(dto.locationLat !== undefined
        ? { locationLat: dto.locationLat }
        : {}),
      ...(dto.locationLng !== undefined
        ? { locationLng: dto.locationLng }
        : {}),
      ...(dto.isAvailable !== undefined ? { isAvailable: dto.isAvailable } : {}),
      ...(dto.availabilityNote !== undefined
        ? { availabilityNote: dto.availabilityNote }
        : {}),
      ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
      ...(dto.profilePhotoUrl !== undefined
        ? { profilePhotoUrl: dto.profilePhotoUrl }
        : {}),
      ...(dto.isPublic !== undefined ? { isPublic: dto.isPublic } : {}),
      ...(dto.onboardingComplete !== undefined
        ? { onboardingComplete: dto.onboardingComplete }
        : {})
    };

    const row = await this.prisma.technicianProfile.upsert({
      where: { userId: user.id },
      create: {
        ...(data as Prisma.TechnicianProfileUncheckedCreateInput),
        userId: user.id
      },
      update: data,
      include: {
        user: {
          select: { fullName: true, firstName: true, lastName: true }
        }
      }
    });
    return this.mapProfileRow(row);
  }

  async searchPublic(actor: User, q: SearchTechniciansQueryDto) {
    const term = q.q?.trim().toLowerCase();
    const specFilter = q.specialization?.trim().toLowerCase();
    const experienceMin = q.experienceMin ?? 0;
    const radiusKm = q.radiusKm ?? 100;
    const availableOnly = q.availableOnly !== false;

    let nearLat = q.nearLat;
    let nearLng = q.nearLng;
    const cityFilter = q.city?.trim().toLowerCase();

    if ((nearLat == null || nearLng == null) && actor.id) {
      const owned = await this.prisma.farm.findFirst({
        where: { ownerId: actor.id },
        orderBy: { createdAt: "asc" },
        select: { latitude: true, longitude: true, address: true }
      });
      if (owned) {
        nearLat = decimalToNumber(owned.latitude) ?? nearLat;
        nearLng = decimalToNumber(owned.longitude) ?? nearLng;
      }
    }

    const rows = await this.prisma.technicianProfile.findMany({
      where: {
        isActive: true,
        isPublic: true,
        ...(availableOnly ? { isAvailable: true } : {}),
        user: {
          accountStatus: "active",
          profiles: { some: { type: ProfileType.technician, profileStatus: "active" } }
        }
      },
      include: {
        user: {
          select: {
            fullName: true,
            firstName: true,
            lastName: true
          }
        }
      },
      take: 120
    });

    const items = rows
      .map((row) => {
        const mapped = this.mapProfileRow(row, { publicView: true });
        const specs = mapped.specializations.map((s) => s.toLowerCase());
        if (specFilter && !specs.some((s) => s.includes(specFilter))) {
          return null;
        }
        if (
          mapped.experienceYearsCount != null &&
          mapped.experienceYearsCount < experienceMin
        ) {
          return null;
        }
        if (
          q.salaryMax != null &&
          mapped.pretensionSalarialeMensuelle != null &&
          mapped.pretensionSalarialeMensuelle > q.salaryMax
        ) {
          return null;
        }
        if (cityFilter) {
          const loc = `${mapped.locationCity ?? ""} ${mapped.locationCountry ?? ""}`.toLowerCase();
          if (!loc.includes(cityFilter) && !term?.includes(cityFilter)) {
            return null;
          }
        }
        if (term) {
          const hay = [
            mapped.displayName,
            mapped.locationCity,
            mapped.locationCountry,
            ...mapped.specializations,
            mapped.formationTypeLabel
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!hay.includes(term)) {
            return null;
          }
        }

        let distanceKm: number | null = null;
        if (
          nearLat != null &&
          nearLng != null &&
          mapped.locationLat != null &&
          mapped.locationLng != null
        ) {
          distanceKm = haversineKm(
            nearLat,
            nearLng,
            mapped.locationLat,
            mapped.locationLng
          );
          if (radiusKm > 0 && distanceKm > radiusKm) {
            return null;
          }
        }

        return { ...mapped, distanceKm };
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
      .sort((a, b) => {
        if (a.distanceKm != null && b.distanceKm != null) {
          return a.distanceKm - b.distanceKm;
        }
        if (a.distanceKm != null) {
          return -1;
        }
        if (b.distanceKm != null) {
          return 1;
        }
        return (b.experienceYearsCount ?? 0) - (a.experienceYearsCount ?? 0);
      });

    return { items };
  }

  async getPublicProfile(actor: User, targetUserId: string) {
    const row = await this.prisma.technicianProfile.findFirst({
      where: {
        userId: targetUserId,
        isActive: true,
        isPublic: true
      },
      include: {
        user: {
          select: { fullName: true, firstName: true, lastName: true }
        }
      }
    });
    if (!row) {
      throw new NotFoundException("Profil technicien introuvable");
    }

    const isSelf = actor.id === targetUserId;
    const employerMembership = await this.prisma.farmMembership.findFirst({
      where: {
        userId: targetUserId,
        farm: {
          OR: [
            { ownerId: actor.id },
            { memberships: { some: { userId: actor.id } } }
          ]
        }
      }
    });

    if (!row.isPublic && !isSelf && !employerMembership) {
      throw new NotFoundException("Profil non disponible");
    }

    return {
      ...this.mapProfileRow(row, { publicView: true }),
      isSelf
    };
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
      // Prisma Json → string pour les clients mobiles (évite crash React Native Text).
      detail: serializeActivityDetail(r.detail),
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
