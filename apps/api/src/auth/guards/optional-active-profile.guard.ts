import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
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
    req.activeProfile = profile;
    return true;
  }
}
