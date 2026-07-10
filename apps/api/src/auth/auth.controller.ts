import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { User } from "@prisma/client";
import type { Request } from "express";
import { AdminUserModerationService } from "../admin-platform/admin-user-moderation.service";
import { CguService } from "../cgu/cgu.service";
import { AcceptCguDto } from "../cgu/dto/accept-cgu.dto";
import { UserNotificationsService } from "../user-notifications/user-notifications.service";
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
    private readonly cgu: CguService,
    private readonly adminModeration: AdminUserModerationService,
    private readonly userNotifications: UserNotificationsService
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

  @Get("me/admin-messages/unread-count")
  @UseGuards(SupabaseJwtGuard, OptionalActiveProfileGuard)
  async myAdminMessagesUnreadCount(@CurrentUser() user: User) {
    return this.adminModeration.countUnreadMessages(user.id);
  }

  @Get("me/admin-messages")
  @UseGuards(SupabaseJwtGuard, OptionalActiveProfileGuard)
  async myAdminMessages(
    @CurrentUser() user: User,
    @Query("skip") skip?: string,
    @Query("take") take?: string
  ) {
    return this.adminModeration.listMessagesForRecipient(
      user,
      skip ? Number.parseInt(skip, 10) : undefined,
      take ? Number.parseInt(take, 10) : undefined
    );
  }

  @Patch("me/admin-messages/:id/read")
  @UseGuards(SupabaseJwtGuard, OptionalActiveProfileGuard)
  async markMyAdminMessageRead(
    @CurrentUser() user: User,
    @Param("id") messageId: string
  ) {
    return this.adminModeration.markMessageRead(user.id, messageId);
  }

  @Delete("me/admin-messages/:id")
  @UseGuards(SupabaseJwtGuard, OptionalActiveProfileGuard)
  async deleteMyAdminMessage(
    @CurrentUser() user: User,
    @Param("id") messageId: string
  ) {
    return this.adminModeration.deleteMessageForRecipient(user.id, messageId);
  }

  @Get("me/notifications/unread-count")
  @UseGuards(SupabaseJwtGuard, OptionalActiveProfileGuard)
  async myNotificationsUnreadCount(@CurrentUser() user: User) {
    return this.userNotifications.countUnread(user.id);
  }

  @Get("me/notifications")
  @UseGuards(SupabaseJwtGuard, OptionalActiveProfileGuard)
  async myNotifications(
    @CurrentUser() user: User,
    @Query("skip") skip?: string,
    @Query("take") take?: string
  ) {
    return this.userNotifications.listForUser(
      user,
      skip ? Number.parseInt(skip, 10) : undefined,
      take ? Number.parseInt(take, 10) : undefined
    );
  }

  @Patch("me/notifications/:id/read")
  @UseGuards(SupabaseJwtGuard, OptionalActiveProfileGuard)
  async markMyNotificationRead(
    @CurrentUser() user: User,
    @Param("id") notificationId: string
  ) {
    return this.userNotifications.markRead(user.id, notificationId);
  }

  @Delete("me/notifications/:id")
  @UseGuards(SupabaseJwtGuard, OptionalActiveProfileGuard)
  async deleteMyNotification(
    @CurrentUser() user: User,
    @Param("id") notificationId: string
  ) {
    return this.userNotifications.deleteForUser(user.id, notificationId);
  }
}
