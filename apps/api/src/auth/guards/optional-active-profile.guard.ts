import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { AccountStatus, ProfileModerationStatus } from "@prisma/client";
import type { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class OptionalActiveProfileGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user;
    if (!user) {
      return true;
    }

    const url = (req.originalUrl ?? req.url ?? "").split("?")[0];
    const isAuthMeRoute =
      url.endsWith("/auth/me") || url.includes("/auth/me/admin-messages");

    if (!isAuthMeRoute && user.accountStatus === AccountStatus.banned) {
      throw new ForbiddenException({
        code: "ACCOUNT_BANNED",
        message: user.bannedReason ?? "Compte désactivé"
      });
    }
    if (!isAuthMeRoute && user.accountStatus === AccountStatus.suspended) {
      const until = user.suspendedUntil;
      if (!until || until > new Date()) {
        throw new ForbiddenException({
          code: "ACCOUNT_SUSPENDED",
          message: user.suspendedReason ?? "Compte suspendu",
          suspendedUntil: until?.toISOString() ?? null
        });
      }
    }

    const raw = req.headers["x-profile-id"];
    const profileId =
      typeof raw === "string" ? raw.trim() : Array.isArray(raw) ? raw[0] : "";

    if (!profileId) {
      req.activeProfile = undefined;
      return true;
    }

    const profile = await this.prisma.profile.findFirst({
      where: { id: profileId, userId: user.id }
    });
    if (!profile) {
      throw new ForbiddenException("Profil inconnu ou non autorise");
    }
    if (!isAuthMeRoute && profile.profileStatus === ProfileModerationStatus.banned) {
      throw new ForbiddenException({
        code: "PROFILE_BANNED",
        message: profile.profileSuspendedReason ?? "Profil désactivé"
      });
    }
    if (!isAuthMeRoute && profile.profileStatus === ProfileModerationStatus.suspended) {
      throw new ForbiddenException({
        code: "PROFILE_SUSPENDED",
        message: profile.profileSuspendedReason ?? "Profil suspendu"
      });
    }
    req.activeProfile = profile;
    return true;
  }
}
