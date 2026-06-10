import {
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
import { ProfitabilityService } from "./profitability.service";
import type { ProfitabilityPeriodKey } from "./profitability.types";

@Controller("farms/:farmId/profitability")
@RequireFeature("finance")
@UseGuards(SupabaseJwtGuard, FeatureEnabledGuard, FarmScopesGuard)
export class ProfitabilityController {
  constructor(private readonly profitability: ProfitabilityService) {}

  @Get()
  @RequireFarmScopes(FARM_SCOPE.financeRead)
  getFarmProfitability(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("period") period?: ProfitabilityPeriodKey,
    @Query("start") start?: string,
    @Query("end") end?: string
  ) {
    return this.profitability.getFarmProfitability(
      user,
      farmId,
      period ?? "current_month",
      period === "custom" && start && end ? { start, end } : undefined
    );
  }

  @Get("dashboard")
  @RequireFarmScopes(FARM_SCOPE.financeRead)
  getDashboard(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("period") period?: ProfitabilityPeriodKey
  ) {
    return this.profitability.getDashboard(
      user,
      farmId,
      period ?? "current_month"
    );
  }

  @Get("batches")
  @RequireFarmScopes(FARM_SCOPE.financeRead)
  getAllBatches(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.profitability.getAllBatches(user, farmId);
  }

  @Get("batches/:batchId")
  @RequireFarmScopes(FARM_SCOPE.financeRead)
  getBatch(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("batchId") batchId: string
  ) {
    return this.profitability.getBatch(user, farmId, batchId);
  }

  @Get("insights")
  @RequireFarmScopes(FARM_SCOPE.financeRead)
  getInsights(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("period") period?: ProfitabilityPeriodKey
  ) {
    return this.profitability.getInsights(
      user,
      farmId,
      period ?? "current_month"
    );
  }

  @Post("recalculate")
  @RequireFarmScopes(FARM_SCOPE.financeWrite)
  recalculate(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.profitability.recalculate(user, farmId);
  }
}
