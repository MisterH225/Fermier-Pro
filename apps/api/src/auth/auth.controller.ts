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
import type { Request } from "express";
import { CguService } from "../cgu/cgu.service";
import { AcceptCguDto } from "../cgu/dto/accept-cgu.dto";
import { AccountDeletionService } from "./account-deletion.service";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./decorators/current-user.decorator";
import { UpdateMeProfileDto } from "./dto/update-me-profile.dto";
import { OptionalActiveProfileGuard } from "./guards/optional-active-profile.guard";
import { SupabaseJwtGuard } from "./guards/supabase-jwt.guard";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly accountDeletion: AccountDeletionService,
    private readonly cgu: CguService
  ) {}

  @Get("me")
  @UseGuards(SupabaseJwtGuard, OptionalActiveProfileGuard)
  async me(@CurrentUser() user: User, @Req() req: Request) {
    return this.authService.buildMeResponse(user, req.activeProfile);
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
    const fresh = await this.authService.findUserByIdOrThrow(user.id);
    return this.authService.buildMeResponse(fresh, req.activeProfile);
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
    return this.authService.buildMeResponse(updated, req.activeProfile);
  }
}
