import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { User } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { CguService } from "../cgu/cgu.service";
import { AcceptCguDto } from "../cgu/dto/accept-cgu.dto";
import { AccountDeletionService } from "./account-deletion.service";
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
    private readonly authService: AuthService,
    private readonly accountDeletion: AccountDeletionService,
    private readonly cgu: CguService
  ) {}

  @Get("me")
  @UseGuards(SupabaseJwtGuard, OptionalActiveProfileGuard)
  async me(@CurrentUser() user: User, @Req() req: Request) {
    return this.buildMeResponse(user, req);
  }

  @Delete("me/account")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 1, ttl: 60_000 } })
  @UseGuards(SupabaseJwtGuard)
  async deleteMyAccount(@CurrentUser() user: User) {
    await this.accountDeletion.deleteAccount(user);
    return { ok: true };
  }

  @Post("me/accept-cgu")
  @UseGuards(SupabaseJwtGuard)
  async acceptCgu(
    @CurrentUser() user: User,
    @Body() dto: AcceptCguDto,
    @Req() req: Request
  ) {
    await this.cgu.acceptCgu(user.id, dto.version);
    const fresh = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id }
    });
    return this.buildMeResponse(fresh, req);
  }

  @Get("me/cgu-status")
  @UseGuards(SupabaseJwtGuard)
  async meCguStatus(@CurrentUser() user: User) {
    return this.cgu.getStatusForUser(user.id);
  }

  @Patch("me/profile")
  @UseGuards(SupabaseJwtGuard, OptionalActiveProfileGuard)
  async patchMeProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateMeProfileDto,
    @Req() req: Request
  ) {
    const updated = await this.authService.updateMeProfile(
      user.id,
      dto,
      req.activeProfile?.id
    );
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
    const resolvedAvatar = ap?.avatarUrl ?? user.avatarUrl;

    const pushDeviceCount = await this.prisma.pushDevice.count({
      where: { userId: user.id }
    });

    const cguCurrent = await this.cgu.getCurrent();
    const cguStatus = this.cgu.buildStatusForUser(user, cguCurrent.version);

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
        notificationsEnabled: user.notificationsEnabled,
        pushNotificationsRegistered: pushDeviceCount > 0,
        isOnboarded: user.isOnboarded,
        onboardingSkipped: user.onboardingSkipped,
        cguAcceptedAt: user.cguAcceptedAt?.toISOString() ?? null,
        cguVersionAccepted: user.cguVersionAccepted
      },
      primaryFarm,
      profiles: profiles.map((p) => ({
        id: p.id,
        type: p.type,
        displayName: p.displayName,
        isDefault: p.isDefault,
        avatarUrl: p.avatarUrl ?? user.avatarUrl
      })),
      activeProfile: ap
        ? {
            id: ap.id,
            type: ap.type,
            displayName: ap.displayName,
            isDefault: ap.isDefault,
            avatarUrl: ap.avatarUrl ?? user.avatarUrl
          }
        : null
    };
  }
}
