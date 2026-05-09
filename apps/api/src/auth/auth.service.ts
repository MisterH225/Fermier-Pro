import {
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { User } from "@prisma/client";
import { ProfileType } from "@prisma/client";
import * as jwt from "jsonwebtoken";
import { PrismaService } from "../prisma/prisma.service";
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

    const user = await this.prisma.user.upsert({
      where: { supabaseUserId: payload.sub },
      create: {
        supabaseUserId: payload.sub,
        email,
        phone,
        fullName
      },
      update: {
        ...(email !== null ? { email } : {}),
        ...(phone !== null ? { phone } : {}),
        ...(fullName !== undefined ? { fullName } : {})
      }
    });

    await this.ensureDefaultBuyerProfile(user.id);
    return user;
  }

  /** Premier profil marketplace pour tout nouvel utilisateur. */
  private async ensureDefaultBuyerProfile(userId: string): Promise<void> {
    const existing = await this.prisma.profile.findFirst({
      where: { userId }
    });
    if (existing) {
      return;
    }
    await this.prisma.profile.create({
      data: {
        userId,
        type: "buyer",
        isDefault: true
      }
    });
  }
}