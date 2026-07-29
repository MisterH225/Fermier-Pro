import {
  Body,
  Controller,
  Delete,
  Param,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { SuperAdminGuard } from "../admin-platform/super-admin.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { AdminDeleteRatingDto } from "./dto/admin-delete-rating.dto";
import { CrossRatingsService } from "./cross-ratings.service";

@Controller("admin/cross-ratings")
@UseGuards(SupabaseJwtGuard, SuperAdminGuard)
export class CrossRatingsAdminController {
  constructor(private readonly ratings: CrossRatingsService) {}

  @Delete(":type/:id")
  remove(
    @CurrentUser() admin: User,
    @Param("type") type: string,
    @Param("id") id: string,
    @Body() dto: AdminDeleteRatingDto
  ) {
    return this.ratings.adminDelete(admin, type, id, dto);
  }
}
