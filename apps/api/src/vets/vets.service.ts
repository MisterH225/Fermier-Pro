import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { VetAvailabilityDto } from "./dto/vet-availability.dto";
import type { ProducerScheduleVetVisitDto } from "./dto/producer-schedule-vet-visit.dto";
import type { User } from "@prisma/client";
import {
  FarmHealthRecordKind,
  MembershipRole,
  Prisma,
  ProfileType,
  SmartAlertModule,
  VetConsultationStatus
} from "@prisma/client";
import type {
  VetDashboardActivityDto,
  VetDashboardDto,
  VetDashboardUpcomingVisitDto
} from "./dto/vet-dashboard.dto";
import {
  ScheduleVetVisitDto,
  VetVisitReason
} from "./dto/schedule-vet-visit.dto";
import { AUDIT_ACTION } from "../common/audit.constants";
import { AuditService } from "../common/audit.service";
import { PushNotificationsService } from "../push-notifications/push-notifications.service";
import {
  VET_VISIT_SLOT_TIMES,
  dayBoundsFromIsoDate,
  slotTimeFromDate
} from "./vet-visit-slots.constants";

type VetVerificationStatus = "pending" | "verified" | "rejected";

const VetStatus = {
  pending: "pending" as const,
  verified: "verified" as const,
  rejected: "rejected" as const
};
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { FarmAccessService } from "../common/farm-access.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateVetRatingDto } from "./dto/create-vet-rating.dto";
import { UpsertVetProfileDto } from "./dto/upsert-vet-profile.dto";

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
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
}

const VISIT_REASON_LABEL: Record<VetVisitReason, string> = {
  [VetVisitReason.routine]: "Visite routine",
  [VetVisitReason.urgency]: "Urgence",
  [VetVisitReason.followup]: "Suivi",
  [VetVisitReason.vaccination]: "Vaccination",
  [VetVisitReason.other]: "Autre"
};

@Injectable()
export class VetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly audit: AuditService,
    private readonly push: PushNotificationsService
  ) {}

  async assertVeterinarianProfile(userId: string) {
    const p = await this.prisma.profile.findFirst({
      where: { userId, type: ProfileType.veterinarian }
    });
    if (!p) {
      throw new ForbiddenException(
        "Un profil vétérinaire est requis sur ce compte"
      );
    }
    return p;
  }

  async getMeSummary(userId: string) {
    const row = await this.prisma.vetProfile.findUnique({
      where: { userId }
    });
    if (!row) {
      return {
        hasProfile: false,
        onboardingComplete: false,
        verificationStatus: null as VetVerificationStatus | null
      };
    }
    return {
      hasProfile: true,
      onboardingComplete: Boolean(row.diplomaPhotoUrl?.trim()),
      verificationStatus: row.verificationStatus,
      rejectionReason: row.rejectionReason,
      profileId: row.id
    };
  }

  async getMyProfile(user: User) {
    await this.assertVeterinarianProfile(user.id);
    const row = await this.prisma.vetProfile.findUnique({
      where: { userId: user.id }
    });
    if (!row) {
      throw new NotFoundException("Profil vétérinaire non créé");
    }
    return this.enrichPublicProfile(row, user.id);
  }

  async upsertProfile(user: User, dto: UpsertVetProfileDto) {
    await this.assertVeterinarianProfile(user.id);

    const data = {
      fullName: dto.fullName.trim(),
      orderNumber: dto.orderNumber.trim(),
      primarySpecialty: dto.primarySpecialty.trim(),
      otherSpecialties:
        dto.otherSpecialties?.length ?
          (dto.otherSpecialties as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      locationCity: dto.locationCity.trim(),
      locationCountry: dto.locationCountry.trim(),
      professionalPhone: dto.professionalPhone.trim(),
      schoolName: dto.schoolName.trim(),
      schoolCountry: dto.schoolCountry.trim(),
      graduationYear: dto.graduationYear,
      diplomaPhotoUrl: dto.diplomaPhotoUrl.trim(),
      profilePhotoUrl: dto.profilePhotoUrl?.trim() ?? null,
      bio: dto.bio?.trim() ?? null,
      availability: dto.availability ?? true,
      interventionRadiusKm: dto.interventionRadiusKm ?? null,
      verificationStatus: VetStatus.pending,
      rejectionReason: null,
      verifiedAt: null
    };

    const existing = await this.prisma.vetProfile.findUnique({
      where: { userId: user.id }
    });

    if (existing) {
      return this.prisma.vetProfile.update({
        where: { userId: user.id },
        data
      });
    }

    try {
      return await this.prisma.vetProfile.create({
        data: { userId: user.id, ...data }
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException("Profil vétérinaire déjà existant");
      }
      throw e;
    }
  }

  private async enrichPublicProfile(
    row: {
      id: string;
      userId: string;
      fullName: string;
      orderNumber: string;
      primarySpecialty: string;
      otherSpecialties: unknown;
      locationCity: string;
      locationCountry: string;
      professionalPhone: string;
      schoolName: string;
      schoolCountry: string;
      graduationYear: number;
      profilePhotoUrl: string | null;
      bio: string | null;
      availability: boolean;
      interventionRadiusKm: number | null;
      verificationStatus: VetVerificationStatus;
      ratingAvg: Prisma.Decimal | null;
      ratingCount: number;
      verifiedAt: Date | null;
    },
    viewerUserId?: string
  ) {
    const [farmsCount, visitsCount, ratings] = await Promise.all([
      this.prisma.farmMembership.count({
        where: { userId: row.userId, role: "veterinarian" }
      }),
      this.prisma.vetConsultation.count({
        where: { primaryVetUserId: row.userId }
      }),
      this.prisma.vetRating.findMany({
        where: { vetId: row.id },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          ratedBy: { select: { fullName: true } }
        }
      })
    ]);

    return {
      id: row.id,
      userId: row.userId,
      fullName: row.fullName,
      primarySpecialty: row.primarySpecialty,
      otherSpecialties: Array.isArray(row.otherSpecialties)
        ? row.otherSpecialties
        : [],
      locationLabel: `${row.locationCity}, ${row.locationCountry}`,
      locationCity: row.locationCity,
      locationCountry: row.locationCountry,
      professionalPhone: row.professionalPhone,
      schoolName: row.schoolName,
      schoolCountry: row.schoolCountry,
      graduationYear: row.graduationYear,
      profilePhotoUrl: row.profilePhotoUrl,
      bio: row.bio,
      availability: row.availability,
      interventionRadiusKm: row.interventionRadiusKm,
      verificationStatus: row.verificationStatus,
      isVerified: row.verificationStatus === VetStatus.verified,
      ratingAvg: row.ratingAvg ? Number(row.ratingAvg) : null,
      ratingCount: row.ratingCount,
      stats: {
        farmsFollowed: farmsCount,
        visitsCompleted: visitsCount
      },
      recentReviews: ratings.map((r: (typeof ratings)[number]) => ({
        score: r.score,
        comment: r.comment,
        authorName: r.ratedBy.fullName,
        createdAt: r.createdAt.toISOString()
      })),
      canContact: row.verificationStatus === VetStatus.verified,
      isSelf: viewerUserId === row.userId
    };
  }

  async getPublicProfile(vetId: string, viewer?: User) {
    const row = await this.prisma.vetProfile.findUnique({
      where: { id: vetId }
    });
    if (!row) {
      throw new NotFoundException("Vétérinaire introuvable");
    }
    if (row.verificationStatus !== VetStatus.verified) {
      if (!viewer || viewer.id !== row.userId) {
        throw new NotFoundException("Profil non disponible");
      }
    }
    return this.enrichPublicProfile(row, viewer?.id);
  }

  async search(
    user: User,
    q: {
      q?: string;
      specialty?: string;
      minRating?: number;
      availableOnly?: boolean;
      nearLat?: number;
      nearLng?: number;
      maxDistanceKm?: number;
    }
  ) {
    const term = q.q?.trim().toLowerCase();
    const specialty = q.specialty?.trim().toLowerCase();
    const minRating = q.minRating ?? 0;

    const rows = await this.prisma.vetProfile.findMany({
      where: {
        verificationStatus: VetStatus.verified,
        ...(q.availableOnly ? { availability: true } : {}),
        ...(specialty && specialty !== "all"
          ? {
              primarySpecialty: { equals: specialty, mode: "insensitive" }
            }
          : {})
      },
      include: {
        user: {
          select: {
            homeLatitude: true,
            homeLongitude: true
          }
        }
      },
      orderBy: [{ ratingAvg: "desc" }, { fullName: "asc" }],
      take: 80
    });

    let viewerLat = q.nearLat;
    let viewerLng = q.nearLng;
    if (viewerLat == null || viewerLng == null) {
      const u = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { homeLatitude: true, homeLongitude: true }
      });
      viewerLat = decimalToNumber(u?.homeLatitude) ?? undefined;
      viewerLng = decimalToNumber(u?.homeLongitude) ?? undefined;
    }

    const maxKm = q.maxDistanceKm ?? 120;

    const mapped = rows
      .map((row: (typeof rows)[number]) => {
        const avg = row.ratingAvg ? Number(row.ratingAvg) : 0;
        if (avg < minRating) {
          return null;
        }
        const hay = `${row.fullName} ${row.locationCity} ${row.locationCountry} ${row.primarySpecialty}`.toLowerCase();
        if (term && !hay.includes(term)) {
          return null;
        }

        let distanceKm: number | null = null;
        const vLat = decimalToNumber(row.user.homeLatitude);
        const vLng = decimalToNumber(row.user.homeLongitude);
        if (
          viewerLat != null &&
          viewerLng != null &&
          vLat != null &&
          vLng != null
        ) {
          distanceKm = Math.round(
            haversineKm(viewerLat, viewerLng, vLat, vLng) * 10
          ) / 10;
          if (distanceKm > maxKm) {
            return null;
          }
        }

        return {
          id: row.id,
          fullName: row.fullName,
          primarySpecialty: row.primarySpecialty,
          locationLabel: `${row.locationCity}, ${row.locationCountry}`,
          profilePhotoUrl: row.profilePhotoUrl,
          availability: row.availability,
          isVerified: true,
          ratingAvg: avg > 0 ? avg : null,
          ratingCount: row.ratingCount,
          distanceKm
        };
      })
      .filter((item): item is NonNullable<typeof item> => item != null);

    mapped.sort((a, b) => {
      if (a.distanceKm != null && b.distanceKm != null) {
        return a.distanceKm - b.distanceKm;
      }
      return (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0);
    });

    return { items: mapped };
  }

  async createRating(user: User, vetId: string, dto: CreateVetRatingDto) {
    const vet = await this.prisma.vetProfile.findUnique({
      where: { id: vetId }
    });
    if (!vet || vet.verificationStatus !== VetStatus.verified) {
      throw new NotFoundException("Vétérinaire introuvable");
    }
    if (vet.userId === user.id) {
      throw new BadRequestException("Vous ne pouvez pas vous noter vous-même");
    }

    if (dto.ratedByFarmId) {
      await this.farmAccess.requireFarmAccess(user.id, dto.ratedByFarmId);
    }

    try {
      await this.prisma.vetRating.create({
        data: {
          vetId,
          ratedByUserId: user.id,
          ratedByFarmId: dto.ratedByFarmId ?? null,
          score: dto.score,
          comment: dto.comment?.trim() ?? null
        }
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException("Vous avez déjà noté ce vétérinaire");
      }
      throw e;
    }

    const agg = await this.prisma.vetRating.aggregate({
      where: { vetId },
      _avg: { score: true },
      _count: true
    });

    await this.prisma.vetProfile.update({
      where: { id: vetId },
      data: {
        ratingAvg: agg._avg.score ?? null,
        ratingCount: agg._count
      }
    });

    return { ok: true };
  }

  async verifyProfile(vetId: string) {
    const row = await this.prisma.vetProfile.findUnique({
      where: { id: vetId }
    });
    if (!row) {
      throw new NotFoundException("Profil introuvable");
    }
    return this.prisma.vetProfile.update({
      where: { id: vetId },
      data: {
        verificationStatus: VetStatus.verified,
        verifiedAt: new Date(),
        rejectionReason: null
      }
    });
  }

  async rejectProfile(vetId: string, reason: string) {
    const row = await this.prisma.vetProfile.findUnique({
      where: { id: vetId }
    });
    if (!row) {
      throw new NotFoundException("Profil introuvable");
    }
    return this.prisma.vetProfile.update({
      where: { id: vetId },
      data: {
        verificationStatus: VetStatus.rejected,
        rejectionReason: reason.trim(),
        verifiedAt: null
      }
    });
  }

  async getVetAvailability(
    vetProfileId: string,
    dateIso: string
  ): Promise<VetAvailabilityDto> {
    const vet = await this.prisma.vetProfile.findUnique({
      where: { id: vetProfileId }
    });
    if (!vet || vet.verificationStatus !== VetStatus.verified) {
      throw new NotFoundException("Vétérinaire introuvable ou non vérifié");
    }

    const { dayStart, dayEnd } = dayBoundsFromIsoDate(dateIso);
    const consultations = await this.prisma.vetConsultation.findMany({
      where: {
        primaryVetUserId: vet.userId,
        status: VetConsultationStatus.open,
        openedAt: { gte: dayStart, lt: dayEnd }
      },
      select: { openedAt: true }
    });

    const occupied = new Set(
      consultations.map((c) => slotTimeFromDate(c.openedAt))
    );

    const slots = VET_VISIT_SLOT_TIMES.map((time) => ({
      time,
      status: !vet.availability
        ? ("unavailable" as const)
        : occupied.has(time)
          ? ("occupied" as const)
          : ("available" as const)
    }));

    return {
      vetProfileId: vet.id,
      date: dateIso,
      vetAvailable: vet.availability,
      slots
    };
  }

  private async assertSlotAvailable(
    vetUserId: string,
    scheduled: Date
  ): Promise<void> {
    const dateIso = scheduled.toISOString().slice(0, 10);
    const time = slotTimeFromDate(scheduled);
    const { dayStart, dayEnd } = dayBoundsFromIsoDate(dateIso);
    const sameDay = await this.prisma.vetConsultation.findMany({
      where: {
        primaryVetUserId: vetUserId,
        status: VetConsultationStatus.open,
        openedAt: { gte: dayStart, lt: dayEnd }
      },
      select: { openedAt: true }
    });
    const occupied = new Set(sameDay.map((c) => slotTimeFromDate(c.openedAt)));
    if (occupied.has(time)) {
      throw new ConflictException("Ce créneau est déjà réservé");
    }
  }

  private formatVisitDate(scheduled: Date): string {
    return scheduled.toLocaleString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  private async notifyVisitScheduled(params: {
    farmId: string;
    farmName: string;
    scheduledAt: Date;
    vetUserId: string;
    vetDisplayName: string;
    openedByUserId: string;
    openedByName: string | null;
    initiatedBy: "vet" | "producer";
  }) {
    const farm = await this.prisma.farm.findUnique({
      where: { id: params.farmId },
      select: { ownerId: true, name: true }
    });
    if (!farm) {
      return;
    }
    const when = this.formatVisitDate(params.scheduledAt);
    const farmLabel = params.farmName || farm.name;

    if (params.initiatedBy === "vet") {
      await this.push.sendToUser(
        farm.ownerId,
        "Visite vétérinaire planifiée",
        `${params.vetDisplayName} le ${when} — ${farmLabel}`,
        {
          type: "vet_visit_scheduled",
          farmId: params.farmId,
          consultationKind: "vet_scheduled"
        }
      );
    } else {
      const producerLabel = params.openedByName?.trim() || "Un producteur";
      await this.push.sendToUser(
        params.vetUserId,
        "Demande de visite",
        `${producerLabel} — ${farmLabel} le ${when}`,
        {
          type: "vet_visit_requested",
          farmId: params.farmId,
          consultationKind: "producer_request"
        }
      );
      if (farm.ownerId !== params.openedByUserId) {
        await this.push.sendToUser(
          params.openedByUserId,
          "RDV vétérinaire enregistré",
          `${params.vetDisplayName} le ${when}`,
          { type: "vet_visit_scheduled", farmId: params.farmId }
        );
      }
    }
  }

  private async createScheduledConsultation(params: {
    actorUserId: string;
    farmId: string;
    vetUserId: string;
    openedByUserId: string;
    scheduledAt: Date;
    reason: ScheduleVetVisitDto["reason"];
    notes?: string | null;
    consultationPrice?: number | null;
    initiatedBy: "vet" | "producer";
  }) {
    await this.assertSlotAvailable(params.vetUserId, params.scheduledAt);

    const reasonLabel = VISIT_REASON_LABEL[params.reason];
    const subject = params.notes?.trim()
      ? `${reasonLabel} — ${params.notes.trim().slice(0, 120)}`
      : reasonLabel;

    const visitQuoteStatus =
      params.initiatedBy === "producer" && params.consultationPrice == null
        ? "pending_vet"
        : params.initiatedBy === "vet" &&
            params.consultationPrice != null &&
            params.consultationPrice > 0
          ? "pending_producer"
          : "confirmed";

    const summaryPayload = {
      kind: "scheduled_visit",
      reason: params.reason,
      notes: params.notes?.trim() ?? null,
      consultationPrice: params.consultationPrice ?? null,
      scheduledAt: params.scheduledAt.toISOString(),
      initiatedBy: params.initiatedBy,
      visitQuoteStatus
    };

    const row = await this.prisma.vetConsultation.create({
      data: {
        farmId: params.farmId,
        subject,
        summary: JSON.stringify(summaryPayload),
        openedAt: params.scheduledAt,
        openedByUserId: params.openedByUserId,
        primaryVetUserId: params.vetUserId,
        status: VetConsultationStatus.open
      },
      include: {
        farm: { select: { id: true, name: true, address: true } },
        openedBy: { select: { id: true, fullName: true, email: true } },
        primaryVet: { select: { id: true, fullName: true, email: true } }
      }
    });

    await this.audit.record({
      actorUserId: params.actorUserId,
      farmId: params.farmId,
      action: AUDIT_ACTION.vetConsultationCreated,
      resourceType: "VetConsultation",
      resourceId: row.id,
      metadata: {
        scheduled: true,
        scheduledAt: params.scheduledAt.toISOString(),
        reason: params.reason,
        initiatedBy: params.initiatedBy
      }
    });

    const vetName =
      row.primaryVet?.fullName?.trim() || "Vétérinaire";
    await this.notifyVisitScheduled({
      farmId: params.farmId,
      farmName: row.farm.name,
      scheduledAt: params.scheduledAt,
      vetUserId: params.vetUserId,
      vetDisplayName: vetName,
      openedByUserId: params.openedByUserId,
      openedByName: row.openedBy.fullName,
      initiatedBy: params.initiatedBy
    });

    return {
      id: row.id,
      farmId: row.farmId,
      farmName: row.farm.name,
      scheduledAt: row.openedAt.toISOString(),
      subject: row.subject,
      status: row.status,
      visitQuoteStatus
    };
  }

  async submitVisitQuote(
    user: User,
    consultationId: string,
    price: number,
    note?: string
  ) {
    await this.assertVeterinarianProfile(user.id);
    const row = await this.prisma.vetConsultation.findUnique({
      where: { id: consultationId },
      include: { farm: { select: { name: true } } }
    });
    if (!row || row.primaryVetUserId !== user.id) {
      throw new NotFoundException("Consultation introuvable");
    }
    let summary: Record<string, unknown> = {};
    try {
      summary = JSON.parse(row.summary ?? "{}") as Record<string, unknown>;
    } catch {
      summary = {};
    }
    summary.consultationPrice = price;
    summary.vetQuoteNote = note?.trim() ?? null;
    summary.visitQuoteStatus = "pending_producer";

    const updated = await this.prisma.vetConsultation.update({
      where: { id: consultationId },
      data: { summary: JSON.stringify(summary) }
    });

    const farm = await this.prisma.farm.findUnique({
      where: { id: row.farmId },
      select: { ownerId: true }
    });
    if (farm) {
      await this.push.sendToUser(
        farm.ownerId,
        "Devis visite vétérinaire",
        `Devis reçu : ${price} pour visite du ${this.formatVisitDate(row.openedAt)}`,
        { type: "vet_visit_quote", consultationId }
      );
    }

    return { id: updated.id, visitQuoteStatus: "pending_producer", price };
  }

  async respondVisitQuote(
    user: User,
    farmId: string,
    consultationId: string,
    action: "accept" | "refuse" | "counter",
    counterPrice?: number
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const row = await this.prisma.vetConsultation.findFirst({
      where: { id: consultationId, farmId }
    });
    if (!row) {
      throw new NotFoundException("Consultation introuvable");
    }
    let summary: Record<string, unknown> = {};
    try {
      summary = JSON.parse(row.summary ?? "{}") as Record<string, unknown>;
    } catch {
      summary = {};
    }

    if (action === "accept") {
      summary.visitQuoteStatus = "confirmed";
    } else if (action === "refuse") {
      summary.visitQuoteStatus = "refused";
    } else if (action === "counter" && counterPrice != null) {
      summary.counterPrice = counterPrice;
      summary.visitQuoteStatus = "pending_vet";
    } else {
      throw new BadRequestException("Action invalide");
    }

    const updated = await this.prisma.vetConsultation.update({
      where: { id: consultationId },
      data: {
        summary: JSON.stringify(summary),
        status:
          action === "accept"
            ? VetConsultationStatus.open
            : action === "refuse"
              ? VetConsultationStatus.cancelled
              : row.status
      }
    });

    if (row.primaryVetUserId && action !== "refuse") {
      await this.push.sendToUser(
        row.primaryVetUserId,
        "Réponse devis visite",
        action === "accept"
          ? "Le producteur a accepté votre devis."
          : "Contre-proposition reçue du producteur.",
        { type: "vet_visit_quote_response", consultationId }
      );
    }

    return {
      id: updated.id,
      visitQuoteStatus: summary.visitQuoteStatus,
      consultationPrice: summary.consultationPrice ?? null
    };
  }

  async listPendingVisitQuotes(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const rows = await this.prisma.vetConsultation.findMany({
      where: { farmId, status: { not: VetConsultationStatus.cancelled } },
      orderBy: { openedAt: "asc" },
      take: 30,
      include: {
        primaryVet: { select: { fullName: true } }
      }
    });
    return rows
      .map((r) => {
        let summary: Record<string, unknown> = {};
        try {
          summary = JSON.parse(r.summary ?? "{}") as Record<string, unknown>;
        } catch {
          return null;
        }
        if (
          summary.kind !== "scheduled_visit" ||
          !summary.visitQuoteStatus ||
          summary.visitQuoteStatus === "confirmed"
        ) {
          return null;
        }
        return {
          id: r.id,
          scheduledAt: r.openedAt.toISOString(),
          vetName: r.primaryVet?.fullName ?? "Vétérinaire",
          reason: summary.reason,
          visitQuoteStatus: summary.visitQuoteStatus,
          consultationPrice: summary.consultationPrice ?? null,
          counterPrice: summary.counterPrice ?? null,
          notes: summary.notes ?? null
        };
      })
      .filter(Boolean);
  }

  async scheduleVisit(user: User, dto: ScheduleVetVisitDto) {
    await this.assertVeterinarianProfile(user.id);
    const vetProfile = await this.prisma.vetProfile.findUnique({
      where: { userId: user.id }
    });
    if (!vetProfile) {
      throw new NotFoundException("Profil vétérinaire non créé");
    }
    if (vetProfile.verificationStatus !== VetStatus.verified) {
      throw new ForbiddenException(
        "Profil vétérinaire non vérifié — planification impossible"
      );
    }

    const membership = await this.prisma.farmMembership.findFirst({
      where: {
        farmId: dto.farmId,
        userId: user.id,
        role: MembershipRole.veterinarian
      }
    });
    if (!membership) {
      throw new ForbiddenException("Ferme non assignée à ce vétérinaire");
    }
    await this.farmAccess.requireFarmScopes(user.id, dto.farmId, [
      FARM_SCOPE.vetWrite
    ]);

    const scheduled = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduled.getTime())) {
      throw new BadRequestException("Date de visite invalide");
    }
    if (scheduled.getTime() < Date.now() - 60_000) {
      throw new BadRequestException("La visite doit être planifiée dans le futur");
    }

    return this.createScheduledConsultation({
      actorUserId: user.id,
      farmId: dto.farmId,
      vetUserId: user.id,
      openedByUserId: user.id,
      scheduledAt: scheduled,
      reason: dto.reason,
      notes: dto.notes,
      consultationPrice: dto.consultationPrice,
      initiatedBy: "vet"
    });
  }

  async scheduleVisitFromProducer(
    user: User,
    farmId: string,
    dto: ProducerScheduleVetVisitDto
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);

    const vetProfile = await this.prisma.vetProfile.findUnique({
      where: { id: dto.vetProfileId }
    });
    if (!vetProfile || vetProfile.verificationStatus !== VetStatus.verified) {
      throw new NotFoundException("Vétérinaire introuvable ou non vérifié");
    }
    if (!vetProfile.availability) {
      throw new BadRequestException(
        "Ce vétérinaire n'est pas disponible actuellement"
      );
    }

    const scheduled = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduled.getTime())) {
      throw new BadRequestException("Date de visite invalide");
    }
    if (scheduled.getTime() < Date.now() - 60_000) {
      throw new BadRequestException("La visite doit être planifiée dans le futur");
    }

    return this.createScheduledConsultation({
      actorUserId: user.id,
      farmId,
      vetUserId: vetProfile.userId,
      openedByUserId: user.id,
      scheduledAt: scheduled,
      reason: dto.reason,
      notes: dto.notes,
      consultationPrice: null,
      initiatedBy: "producer"
    });
  }

  private async filterFarmIdsByScope(
    userId: string,
    farmIds: string[],
    scope: string
  ): Promise<string[]> {
    const allowed: string[] = [];
    for (const farmId of farmIds) {
      if (await this.farmAccess.hasFarmScope(userId, farmId, scope)) {
        allowed.push(farmId);
      }
    }
    return allowed;
  }

  async getDashboard(user: User): Promise<VetDashboardDto> {
    await this.assertVeterinarianProfile(user.id);
    const vetRow = await this.prisma.vetProfile.findUnique({
      where: { userId: user.id }
    });
    if (!vetRow) {
      throw new NotFoundException("Profil vétérinaire non créé");
    }

    const memberships = await this.prisma.farmMembership.findMany({
      where: { userId: user.id, role: MembershipRole.veterinarian },
      include: {
        farm: {
          select: {
            id: true,
            name: true,
            address: true,
            owner: { select: { fullName: true, email: true, phone: true } }
          }
        }
      }
    });
    const allFarmIds = memberships.map((m) => m.farmId);
    const healthFarmIds = await this.filterFarmIdsByScope(
      user.id,
      allFarmIds,
      FARM_SCOPE.healthRead
    );
    const vetFarmIds = await this.filterFarmIdsByScope(
      user.id,
      allFarmIds,
      FARM_SCOPE.vetRead
    );
    const tasksFarmIds = await this.filterFarmIdsByScope(
      user.id,
      allFarmIds,
      FARM_SCOPE.tasksRead
    );
    const followedFarmIds = [
      ...new Set([...healthFarmIds, ...vetFarmIds, ...tasksFarmIds])
    ];
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [
      visitsThisMonth,
      healthAlerts,
      pendingTasks,
      openConsultations,
      recentConsultations,
      recentHealth
    ] = await Promise.all([
      healthFarmIds.length === 0
        ? 0
        : this.prisma.farmHealthRecord.count({
            where: {
              farmId: { in: healthFarmIds },
              kind: FarmHealthRecordKind.vet_visit,
              occurredAt: { gte: monthStart }
            }
          }),
      healthFarmIds.length === 0
        ? 0
        : this.prisma.smartAlert.count({
            where: {
              farmId: { in: healthFarmIds },
              module: SmartAlertModule.health,
              isRead: false
            }
          }),
      tasksFarmIds.length === 0
        ? 0
        : this.prisma.farmTask.count({
            where: {
              farmId: { in: tasksFarmIds },
              assignedUserId: user.id,
              completedAt: null
            }
          }),
      vetFarmIds.length === 0
        ? []
        : this.prisma.vetConsultation.findMany({
            where: {
              farmId: { in: vetFarmIds },
              status: VetConsultationStatus.open,
              OR: [
                { primaryVetUserId: user.id },
                { primaryVetUserId: null }
              ]
            },
            orderBy: { openedAt: "asc" },
            take: 12,
            include: {
              farm: { select: { id: true, name: true, address: true } },
              openedBy: { select: { fullName: true, email: true, phone: true } }
            }
          }),
      vetFarmIds.length === 0
        ? []
        : this.prisma.vetConsultation.findMany({
            where: { farmId: { in: vetFarmIds } },
            orderBy: { openedAt: "desc" },
            take: 8,
            include: {
              farm: { select: { id: true, name: true } },
              openedBy: { select: { fullName: true } }
            }
          }),
      healthFarmIds.length === 0
        ? []
        : this.prisma.farmHealthRecord.findMany({
            where: { farmId: { in: healthFarmIds } },
            orderBy: { occurredAt: "desc" },
            take: 8,
            include: {
              farm: { select: { id: true, name: true } },
              vetVisit: true,
              vaccination: true,
              disease: true,
              treatment: true
            }
          })
    ]);

    const visitsCompleted = await this.prisma.vetConsultation.count({
      where: {
        primaryVetUserId: user.id,
        status: VetConsultationStatus.resolved
      }
    });

    const upcomingVisits: VetDashboardUpcomingVisitDto[] = openConsultations.map(
      (c) => ({
        id: c.id,
        farmId: c.farmId,
        farmName: c.farm.name,
        producerName: c.openedBy.fullName ?? c.openedBy.email,
        producerPhone: c.openedBy.phone,
        scheduledAt: c.openedAt.toISOString(),
        subject: c.subject,
        location: c.farm.address,
        status: c.status
      })
    );

    const activityFromConsultations: VetDashboardActivityDto[] =
      recentConsultations.map((c) => ({
        id: `consult-${c.id}`,
        kind: "consultation" as const,
        title: c.subject,
        subtitle: c.openedBy.fullName ?? "—",
        occurredAt: c.openedAt.toISOString(),
        farmId: c.farmId,
        farmName: c.farm.name
      }));

    const activityFromHealth: VetDashboardActivityDto[] = recentHealth.map(
      (r) => {
        let kind: VetDashboardActivityDto["kind"] = "vet_visit";
        let title = "Événement santé";
        let subtitle = r.farm.name;
        if (r.kind === FarmHealthRecordKind.vaccination) {
          kind = "vaccination";
          title = "Vaccination";
          subtitle = r.vaccination?.vaccineName ?? r.farm.name;
        } else if (r.kind === FarmHealthRecordKind.disease) {
          kind = "disease";
          title = r.disease?.diagnosis ?? "Cas maladie";
          subtitle = r.farm.name;
        } else if (r.kind === FarmHealthRecordKind.treatment) {
          kind = "treatment";
          title = "Traitement";
          subtitle = r.treatment?.drugName ?? r.farm.name;
        } else if (r.kind === FarmHealthRecordKind.vet_visit) {
          kind = "vet_visit";
          title = r.vetVisit?.reason ?? "Visite vétérinaire";
          subtitle = r.vetVisit?.vetName ?? r.farm.name;
        }
        return {
          id: `health-${r.id}`,
          kind,
          title,
          subtitle,
          occurredAt: r.occurredAt.toISOString(),
          farmId: r.farmId,
          farmName: r.farm.name
        };
      }
    );

    const recentActivity = [...activityFromConsultations, ...activityFromHealth]
      .sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
      )
      .slice(0, 5);

    const assignedFarms = memberships.map((m) => ({
      id: m.farm.id,
      name: m.farm.name,
      address: m.farm.address,
      producerName: m.farm.owner.fullName ?? m.farm.owner.email,
      producerPhone: m.farm.owner.phone
    }));

    return {
      kpis: {
        farmsFollowed: followedFarmIds.length,
        visitsThisMonth,
        healthAlerts,
        pendingTasks
      },
      upcomingVisits,
      assignedFarms,
      recentActivity,
      stats: {
        farmsFollowed: followedFarmIds.length,
        visitsCompleted,
        averageRating: vetRow.ratingAvg ? Number(vetRow.ratingAvg) : null
      }
    };
  }
}
