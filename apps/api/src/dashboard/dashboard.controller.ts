import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { FeatureEnabledGuard } from "../config-client/feature-enabled.guard";
import { RequireFeature } from "../config-client/require-feature.decorator";
import { DashboardService } from "./dashboard.service";

@Controller("farms/:farmId/dashboard")
@UseGuards(SupabaseJwtGuard, FeatureEnabledGuard, FarmScopesGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("finance-timeseries")
  @RequireFeature("finance")
  @RequireFarmScopes(FARM_SCOPE.financeRead)
  financeTimeseries(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string
  ) {
    return this.dashboard.financeTimeseries(user, farmId);
  }

  @Get("gestations")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  gestations(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.dashboard.criticalGestations(user, farmId);
  }

  @Get("health")
  @RequireFarmScopes(FARM_SCOPE.healthRead)
  health(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.dashboard.healthSummary(user, farmId);
  }

  @Get("feed-stock")
  @RequireFeature("feedStock")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  feedStock(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.dashboard.feedStockSummary(user, farmId);
  }
}
