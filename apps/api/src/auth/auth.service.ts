import {
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AccountStatus, Prisma, ProfileModerationStatus } from "@prisma/client";
import type { Profile, User } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";
import { CguService } from "../cgu/cgu.service";
import { PrismaService } from "../prisma/prisma.service";
import type { UpdateMeProfileDto } from "./dto/update-me-profile.dto";
import { verifySupabaseAccessToken as verifySupabaseJwt } from "./supabase-jwt.verifier";
import type { SupabaseJwtPayload } from "./types/supabase-jwt.payload";

function decimalToNumber(value: Decimal | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return value.toNumber();
}

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly cgu: CguService
  ) {}

  async verifySupabaseAccessToken(token: string): Promise<SupabaseJwtPayload> {
    return verifySupabaseJwt(token, {
      supabaseUrl: this.config.get<string>("SUPABASE_URL"),
      hs256Secret: this.config.get<string>("SUPABASE_JWT_SECRET")
    });
  }

  extractBearerToken(authorization?: string): string {
    if (!authorization || !authorization.startsWith("Bearer ")) {
      throw new UnauthorizedException("Authorization Bearer requis");
    }
    return authorization.slice("Bearer ".length).trim();
  }

  private splitFullName(full: string): {
    firstName: string | null;
    lastName: string | null;
  } {
    const t = full.trim();
    if (!t) {
      return { firstName: null, lastName: null };
    }
    const i = t.indexOf(" ");
    if (i === -1) {
      return { firstName: t, lastName: null };
    }
    return {
      firstName: t.slice(0, i),
      lastName: t.slice(i + 1).trim() || null
    };
  }

  private displayNameFromMetadata(
    payload: SupabaseJwtPayload
  ): string | undefined {
    const meta = payload.user_metadata;
    if (!meta || typeof meta !== "object") {
      return undefined;
    }
    const fullName = meta.full_name ?? meta.name ?? meta.display_name;
    if (typeof fullName === "string" && fullName.length > 0) {
      return fullName;
    }
    return undefined;
  }

  /** Jeton brut JWT Supabase (sans prefix Bearer). */
  async userFromAccessToken(accessToken: string): Promise<User> {
    const payload = await this.verifySupabaseAccessToken(accessToken);
    return this.syncUserFromSupabasePayload(payload);
  }

  async syncUserFromSupabasePayload(
    payload: SupabaseJwtPayload
  ): Promise<User> {
    const email =
      payload.email && payload.email.length > 0 ? payload.email : null;
    const phone =
      payload.phone && payload.phone.length > 0 ? payload.phone : null;
    const fullName = this.displayNameFromMetadata(payload);
    const nameParts =
      fullName !== undefined && fullName !== null && fullName.length > 0
        ? this.splitFullName(fullName)
        : { firstName: null as string | null, lastName: null as string | null };

    const user = await this.prisma.user.upsert({
      where: { supabaseUserId: payload.sub },
      create: {
        supabaseUserId: payload.sub,
        email,
        phone,
        fullName,
        firstName: nameParts.firstName,
        lastName: nameParts.lastName
      },
      update: {
        ...(email !== null ? { email } : {}),
        ...(phone !== null ? { phone } : {}),
        ...(fullName !== undefined ? { fullName } : {})
      }
    });

    /**
     * Pas de profil crée automatiquement : la premiere connexion mobile impose un choix
     * (producteur, veterinaire, etc.) via POST /profiles — premier profil `isDefault: true`.
     */
    return this.liftExpiredAccountSuspension(user);
  }

  /** Réactive automatiquement un compte dont la suspension temporaire est expirée. */
  async liftExpiredAccountSuspension(user: User): Promise<User> {
    if (
      user.accountStatus !== AccountStatus.suspended ||
      !user.suspendedUntil ||
      user.suspendedUntil > new Date()
    ) {
      return user;
    }

    const lifted = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        accountStatus: AccountStatus.active,
        isActive: true,
        suspendedAt: null,
        suspendedReason: null,
        suspendedUntil: null
      }
    });
    await this.prisma.profile.updateMany({
      where: {
        userId: user.id,
        profileStatus: ProfileModerationStatus.suspended
      },
      data: {
        profileStatus: ProfileModerationStatus.active,
        profileSuspendedAt: null,
        profileSuspendedReason: null
      }
    });
    return lifted;
  }

  async updateMeProfile(
    userId: string,
    dto: UpdateMeProfileDto,
    activeProfileId?: string | null
  ): Promise<User> {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      throw new NotFoundException("Utilisateur introuvable");
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.firstName !== undefined) {
      data.firstName = dto.firstName;
    }
    if (dto.lastName !== undefined) {
      data.lastName = dto.lastName;
    }
    if (dto.avatarUrl !== undefined) {
      if (activeProfileId) {
        await this.prisma.profile.updateMany({
          where: { id: activeProfileId, userId },
          data: { avatarUrl: dto.avatarUrl }
        });
      } else {
        data.avatarUrl = dto.avatarUrl;
      }
    }
    if (dto.producerHomeFarmName !== undefined) {
      data.producerHomeFarmName = dto.producerHomeFarmName;
    }
    if (dto.homeLocationLabel !== undefined) {
      data.homeLocationLabel = dto.homeLocationLabel;
    }
    if (dto.homeLocationSource !== undefined) {
      data.homeLocationSource = dto.homeLocationSource;
    }
    if (dto.homeLatitude !== undefined) {
      data.homeLatitude =
        dto.homeLatitude === null
          ? null
          : new Prisma.Decimal(dto.homeLatitude);
    }
    if (dto.homeLongitude !== undefined) {
      data.homeLongitude =
        dto.homeLongitude === null
          ? null
          : new Prisma.Decimal(dto.homeLongitude);
    }
    if (dto.notificationsEnabled !== undefined) {
      data.notificationsEnabled = dto.notificationsEnabled;
    }

    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      const nextFirst =
        dto.firstName !== undefined ? dto.firstName : existing.firstName;
      const nextLast =
        dto.lastName !== undefined ? dto.lastName : existing.lastName;
      const parts = [nextFirst, nextLast]
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim());
      data.fullName = parts.length > 0 ? parts.join(" ") : null;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data
    });

    const nextEnabled = updated.notificationsEnabled;
    if (!nextEnabled) {
      await this.prisma.pushDevice.deleteMany({ where: { userId } });
      return updated;
    }

    const rawToken = dto.expoPushToken;
    if (
      typeof rawToken === "string" &&
      rawToken.trim().length > 0 &&
      nextEnabled
    ) {
      const token = rawToken.trim();
      const platform =
        dto.pushPlatform === "ios" ||
        dto.pushPlatform === "android" ||
        dto.pushPlatform === "web"
          ? dto.pushPlatform
          : "unknown";
      await this.prisma.pushDevice.upsert({
        where: { token },
        create: { userId, token, platform },
        update: { userId, platform }
      });
    }

    return updated;
  }

  async findUserByIdOrThrow(userId: string): Promise<User> {
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  }

  async buildMeResponse(
    user: User,
    activeProfile?: Profile | null
  ) {
    user = await this.liftExpiredAccountSuspension(user);
    const profiles = await this.prisma.profile.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
    });

    let activeFarm: { id: string; name: string } | null = null;
    if (user.activeFarmId) {
      activeFarm = await this.prisma.farm.findFirst({
        where: { id: user.activeFarmId, status: "active" },
        select: { id: true, name: true }
      });
    }
    if (!activeFarm) {
      const fallback = await this.prisma.farm.findFirst({
        where: {
          OR: [
            { ownerId: user.id },
            { memberships: { some: { userId: user.id } } }
          ],
          status: "active"
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true }
      });
      if (fallback) {
        activeFarm = fallback;
        await this.prisma.user.update({
          where: { id: user.id },
          data: { activeFarmId: fallback.id }
        });
      }
    }

    const primaryFarm = activeFarm;

    const activeProfileId = activeProfile?.id;
    const ap =
      activeProfileId != null
        ? profiles.find((p) => p.id === activeProfileId) ?? activeProfile
        : activeProfile;
    const resolvedAvatar = ap?.avatarUrl ?? user.avatarUrl;

    const pushDeviceCount = await this.prisma.pushDevice.count({
      where: { userId: user.id }
    });

    const cguCurrent = await this.cgu.getCurrent();
    const cguStatus = this.cgu.buildStatusForUser(user, cguCurrent.version);

    const technicianRow = await this.prisma.technicianProfile.findUnique({
      where: { userId: user.id },
      select: { id: true, onboardingComplete: true, experienceYears: true }
    });
    const buyerRow = await this.prisma.buyerProfile.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        onboardingComplete: true,
        buyerType: true,
        preferredCategories: true
      }
    });
    const vetRow = await this.prisma.vetProfile.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        verificationStatus: true,
        rejectionReason: true,
        diplomaPhotoUrl: true
      }
    });

    return {
      cgu: cguStatus,
      technicianProfile: technicianRow
        ? {
            profileId: technicianRow.id,
            onboardingComplete: technicianRow.onboardingComplete,
            experienceYears: technicianRow.experienceYears
          }
        : null,
      buyerProfile: buyerRow
        ? {
            profileId: buyerRow.id,
            onboardingComplete: buyerRow.onboardingComplete,
            buyerType: buyerRow.buyerType,
            preferredCategories: buyerRow.preferredCategories
          }
        : null,
      vetProfessional: vetRow
        ? {
            profileId: vetRow.id,
            verificationStatus: vetRow.verificationStatus,
            rejectionReason: vetRow.rejectionReason,
            onboardingComplete: Boolean(vetRow.diplomaPhotoUrl?.trim())
          }
        : {
            profileId: null,
            verificationStatus: null,
            rejectionReason: null,
            onboardingComplete: false
          },
      user: {
        id: user.id,
        supabaseUserId: user.supabaseUserId,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: resolvedAvatar,
        producerHomeFarmName: user.producerHomeFarmName,
        homeLatitude: decimalToNumber(user.homeLatitude),
        homeLongitude: decimalToNumber(user.homeLongitude),
        homeLocationLabel: user.homeLocationLabel,
        homeLocationSource: user.homeLocationSource,
        isActive: user.isActive,
        accountStatus: user.accountStatus,
        suspendedReason: user.suspendedReason,
        suspendedUntil: user.suspendedUntil?.toISOString() ?? null,
        bannedReason: user.bannedReason,
        notificationsEnabled: user.notificationsEnabled,
        pushNotificationsRegistered: pushDeviceCount > 0,
        isOnboarded: user.isOnboarded,
        onboardingSkipped: user.onboardingSkipped,
        cguAcceptedAt: user.cguAcceptedAt?.toISOString() ?? null,
        cguVersionAccepted: user.cguVersionAccepted
      },
      primaryFarm,
      activeFarm,
      profiles: profiles.map((p) => ({
        id: p.id,
        type: p.type,
        displayName: p.displayName,
        isDefault: p.isDefault,
        avatarUrl: p.avatarUrl ?? user.avatarUrl,
        profileStatus: p.profileStatus,
        profileSuspendedReason: p.profileSuspendedReason
      })),
      activeProfile: ap
        ? {
            id: ap.id,
            type: ap.type,
            displayName: ap.displayName,
            isDefault: ap.isDefault,
            avatarUrl: ap.avatarUrl ?? user.avatarUrl,
            profileStatus: ap.profileStatus,
            profileSuspendedReason: ap.profileSuspendedReason
          }
        : null
    };
  }

  /** Met à jour lastActiveAt (max 1 fois / heure) pour le score producteur. */
  async touchLastActive(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { lastActiveAt: true }
    });
    if (!user) return;

    const now = new Date();
    if (user.lastActiveAt) {
      const hoursSince =
        (now.getTime() - user.lastActiveAt.getTime()) / 3_600_000;
      if (hoursSince < 1) {
        return;
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: now }
    });
  }
}
