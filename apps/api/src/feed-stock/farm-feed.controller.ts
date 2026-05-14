import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FeatureEnabledGuard } from "../config-client/feature-enabled.guard";
import { RequireFeature } from "../config-client/require-feature.decorator";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { CreateFeedMovementDto } from "./dto/create-feed-movement.dto";
import { CreateFeedTypeDto } from "./dto/create-feed-type.dto";
import { ListFeedMovementsQueryDto } from "./dto/list-feed-movements-query.dto";
import { FarmFeedService } from "./farm-feed.service";

@Controller("farms/:farmId/feed")
@RequireFeature("feedStock")
@UseGuards(SupabaseJwtGuard, FeatureEnabledGuard, FarmScopesGuard)
export class FarmFeedController {
  constructor(private readonly farmFeed: FarmFeedService) {}

  @Get("types")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  listTypes(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.farmFeed.listTypes(user, farmId);
  }

  @Post("types")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  createType(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: CreateFeedTypeDto
  ) {
    return this.farmFeed.createType(user, farmId, dto);
  }

  @Get("overview")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  overview(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.farmFeed.overview(user, farmId);
  }

  @Get("chart")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  chart(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("period") period?: string
  ) {
    return this.farmFeed.chart(user, farmId, period);
  }

  @Get("stats")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  stats(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.farmFeed.stats(user, farmId);
  }

  @Get("movements")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  movements(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query() q: ListFeedMovementsQueryDto
  ) {
    return this.farmFeed.listMovements(user, farmId, q);
  }

  @Post("movements")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  createMovement(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: CreateFeedMovementDto
  ) {
    return this.farmFeed.createMovement(user, farmId, dto);
  }
}
