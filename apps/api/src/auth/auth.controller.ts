import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { CurrentUser } from "./decorators/current-user.decorator";
import { OptionalActiveProfileGuard } from "./guards/optional-active-profile.guard";
import { SupabaseJwtGuard } from "./guards/supabase-jwt.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("me")
  @UseGuards(SupabaseJwtGuard, OptionalActiveProfileGuard)
  async me(@CurrentUser() user: User, @Req() req: Request) {
    const profiles = await this.prisma.profile.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
    });

    const ap = req.activeProfile;

    return {
      user: {
        id: user.id,
        supabaseUserId: user.supabaseUserId,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        isActive: user.isActive
      },
      profiles: profiles.map((p) => ({
        id: p.id,
        type: p.type,
        displayName: p.displayName,
        isDefault: p.isDefault
      })),
      activeProfile: ap
        ? {
            id: ap.id,
            type: ap.type,
            displayName: ap.displayName,
            isDefault: ap.isDefault
          }
        : null
    };
  }
}
