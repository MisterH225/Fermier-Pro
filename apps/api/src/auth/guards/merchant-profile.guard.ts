import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { ProfileType } from "@prisma/client";
import type { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class MerchantProfileGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException();
    }

    const raw = req.headers["x-profile-id"];
    const profileId =
      typeof raw === "string" ? raw.trim() : Array.isArray(raw) ? raw[0] : "";

    if (!profileId) {
      throw new BadRequestException(
        "En-tete X-Profile-Id requis (profil commerçant)"
      );
    }

    const profile = await this.prisma.profile.findFirst({
      where: { id: profileId, userId: user.id }
    });
    if (!profile || profile.type !== ProfileType.merchant) {
      throw new ForbiddenException("Profil commerçant requis");
    }
    req.activeProfile = profile;
    return true;
  }
}
