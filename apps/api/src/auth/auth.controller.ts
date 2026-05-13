import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./decorators/current-user.decorator";
import { UpdateMeProfileDto } from "./dto/update-me-profile.dto";
import { OptionalActiveProfileGuard } from "./guards/optional-active-profile.guard";
import { SupabaseJwtGuard } from "./guards/supabase-jwt.guard";

function decimalToNumber(value: Decimal | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return value.toNumber();
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService
  ) {}

  @Get("me")
  @UseGuards(SupabaseJwtGuard, OptionalActiveProfileGuard)
  async me(@CurrentUser() user: User, @Req() req: Request) {
    return this.buildMeResponse(user, req);
  }

  @Patch("me/profile")
  @UseGuards(SupabaseJwtGuard, OptionalActiveProfileGuard)
  async patchMeProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateMeProfileDto,
    @Req() req: Request
  ) {
    const updated = await this.authService.updateMeProfile(user.id, dto);
    return this.buildMeResponse(updated, req);
  }

  private async buildMeResponse(user: User, req: Request) {
    const profiles = await this.prisma.profile.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
    });

    const primaryFarm = await this.prisma.farm.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true }
    });

    const ap = req.activeProfile;

    const pushDeviceCount = await this.prisma.pushDevice.count({
      where: { userId: user.id }
    });

    return {
      user: {
        id: user.id,
        supabaseUserId: user.supabaseUserId,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        producerHomeFarmName: user.producerHomeFarmName,
        homeLatitude: decimalToNumber(user.homeLatitude),
        homeLongitude: decimalToNumber(user.homeLongitude),
        homeLocationLabel: user.homeLocationLabel,
        homeLocationSource: user.homeLocationSource,
        isActive: user.isActive,
        notificationsEnabled: user.notificationsEnabled,
        pushNotificationsRegistered: pushDeviceCount > 0
      },
      primaryFarm,
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
