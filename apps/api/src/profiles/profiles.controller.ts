import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { CreateProfileDto } from "./dto/create-profile.dto";
import { DeactivateProfileDto } from "./dto/deactivate-profile.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ProfileDeactivationService } from "./profile-deactivation.service";
import { ProfilesService } from "./profiles.service";

@Controller("profiles")
@UseGuards(SupabaseJwtGuard)
export class ProfilesController {
  constructor(
    private readonly profiles: ProfilesService,
    private readonly deactivation: ProfileDeactivationService
  ) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateProfileDto) {
    return this.profiles.create(user, dto);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: UpdateProfileDto
  ) {
    return this.profiles.update(user, id, dto);
  }

  @Get(":id/deactivation-preview")
  deactivationPreview(
    @CurrentUser() user: User,
    @Param("id") id: string
  ) {
    return this.deactivation.preview(user, id);
  }

  @Post(":id/deactivate")
  deactivate(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: DeactivateProfileDto
  ) {
    return this.deactivation.deactivate(user, id, {
      reason: dto.reason
    });
  }

  @Post(":id/reactivate")
  reactivate(@CurrentUser() user: User, @Param("id") id: string) {
    return this.deactivation.reactivate(user, id);
  }

  /**
   * Ancien hard delete — délègue à la désactivation (jamais destructif).
   */
  @Delete(":id")
  remove(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: DeactivateProfileDto
  ) {
    return this.deactivation.deactivate(user, id, {
      reason: dto?.reason
    });
  }
}
