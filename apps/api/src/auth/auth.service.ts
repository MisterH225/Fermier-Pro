import {
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import type { User } from "@prisma/client";
import * as jwt from "jsonwebtoken";
import { PrismaService } from "../prisma/prisma.service";
import type { UpdateMeProfileDto } from "./dto/update-me-profile.dto";
import type { SupabaseJwtPayload } from "./types/supabase-jwt.payload";

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  verifySupabaseAccessToken(token: string): SupabaseJwtPayload {
    const secret = this.config.get<string>("SUPABASE_JWT_SECRET");
    if (!secret) {
      throw new UnauthorizedException("SUPABASE_JWT_SECRET manquant");
    }

    try {
      const decoded = jwt.verify(token, secret, {
        algorithms: ["HS256"]
      }) as SupabaseJwtPayload;

      if (!decoded?.sub) {
        throw new UnauthorizedException("Jeton invalide");
      }

      return decoded;
    } catch {
      throw new UnauthorizedException("Jeton invalide ou expire");
    }
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
    const payload = this.verifySupabaseAccessToken(accessToken);
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
    return user;
  }

  async updateMeProfile(userId: string, dto: UpdateMeProfileDto): Promise<User> {
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
      data.avatarUrl = dto.avatarUrl;
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
}
