import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { Prisma, ProfileType } from "@prisma/client";

type VetVerificationStatus = "pending" | "verified" | "rejected";

const VetStatus = {
  pending: "pending" as const,
  verified: "verified" as const,
  rejected: "rejected" as const
};
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

@Injectable()
export class VetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService
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
}
