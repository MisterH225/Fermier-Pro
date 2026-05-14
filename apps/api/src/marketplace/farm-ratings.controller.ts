import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FeatureEnabledGuard } from "../config-client/feature-enabled.guard";
import { RequireFeature } from "../config-client/require-feature.decorator";
import { CreateFarmRatingDto } from "./dto/create-farm-rating.dto";
import { FarmRatingsService } from "./farm-ratings.service";

@Controller("marketplace/farm-ratings")
@RequireFeature("marketplace")
@UseGuards(SupabaseJwtGuard, FeatureEnabledGuard)
export class FarmRatingsController {
  constructor(private readonly ratings: FarmRatingsService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateFarmRatingDto) {
    return this.ratings.createOrUpdate(user, dto);
  }

  @Get("farm/:farmId/summary")
  summary(@Param("farmId") farmId: string) {
    return this.ratings.averageForFarm(farmId);
  }
}
