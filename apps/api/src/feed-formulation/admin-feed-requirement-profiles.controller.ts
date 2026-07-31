import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { SuperAdminGuard } from "../admin-platform/super-admin.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import {
  CreateFeedRequirementProfileDto,
  ListFeedRequirementProfilesQueryDto,
  UpdateFeedRequirementProfileDto
} from "./dto/feed-requirement-profile.dto";
import { FeedRequirementProfilesService } from "./feed-requirement-profiles.service";

/**
 * CRUD superadmin des profils de besoins (comme FeedIngredient).
 * Non exposé au mobile — console admin uniquement.
 */
@Controller("admin/feed-requirement-profiles")
@UseGuards(SupabaseJwtGuard, SuperAdminGuard)
export class AdminFeedRequirementProfilesController {
  constructor(private readonly profiles: FeedRequirementProfilesService) {}

  @Get()
  list(@Query() query: ListFeedRequirementProfilesQueryDto) {
    return this.profiles.list({
      stage: query.stage,
      includeInactive: query.includeInactive ?? true
    });
  }

  @Get(":id")
  getOne(@Param("id") id: string) {
    return this.profiles.getById(id);
  }

  @Post()
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateFeedRequirementProfileDto
  ) {
    return this.profiles.create(dto, user.id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateFeedRequirementProfileDto
  ) {
    return this.profiles.update(id, dto, user.id);
  }

  @Delete(":id")
  deactivate(@Param("id") id: string, @CurrentUser() user: User) {
    return this.profiles.deactivate(id, user.id);
  }
}
