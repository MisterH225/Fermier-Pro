import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { AccountStatus, ProfileModerationStatus } from "@prisma/client";
import type { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ActiveProfileGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException();
    }

    if (user.accountStatus === AccountStatus.banned) {
      throw new ForbiddenException({
        code: "ACCOUNT_BANNED",
        message: user.bannedReason ?? "Compte désactivé"
      });
    }
    if (user.accountStatus === AccountStatus.suspended) {
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
      throw new BadRequestException("En-tete X-Profile-Id requis");
    }

    const profile = await this.prisma.profile.findFirst({
      where: { id: profileId, userId: user.id }
    });
    if (!profile) {
      throw new ForbiddenException("Profil inconnu ou non autorise");
    }
    if (profile.profileStatus === ProfileModerationStatus.banned) {
      throw new ForbiddenException({
        code: "PROFILE_BANNED",
        message: profile.profileSuspendedReason ?? "Profil banni"
      });
    }
    if (profile.profileStatus === ProfileModerationStatus.suspended) {
      throw new ForbiddenException({
        code: "PROFILE_SUSPENDED",
        message: profile.profileSuspendedReason ?? "Profil suspendu"
      });
    }
    if (profile.profileStatus === ProfileModerationStatus.deactivated) {
      throw new ForbiddenException({
        code: "PROFILE_DEACTIVATED",
        message:
          "Ce profil est désactivé. Réactivez-le ou choisissez un autre profil."
      });
    }

    req.activeProfile = profile;
    return true;
  }
}
