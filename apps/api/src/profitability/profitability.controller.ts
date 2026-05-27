import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import {
  ProfitabilityHistoryQueryDto,
  ProfitabilityIcQueryDto,
  ProfitabilityMonthQueryDto,
  ProfitabilitySimulateQueryDto
} from "./dto/profitability-query.dto";
import { UpdateProfitabilitySettingsDto } from "./dto/update-profitability-settings.dto";
import { ProfitabilityService } from "./profitability.service";

@Controller("farms/:farmId/profitability")
@RequireFeature("finance")
@UseGuards(SupabaseJwtGuard, FeatureEnabledGuard, FarmScopesGuard)
export class ProfitabilityController {
  constructor(private readonly profitability: ProfitabilityService) {}

  @Get("settings")
  @RequireFarmScopes(FARM_SCOPE.financeRead)
  getSettings(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.profitability.getSettings(user, farmId);
  }

  @Patch("settings")
  @RequireFarmScopes(FARM_SCOPE.financeWrite)
  updateSettings(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: UpdateProfitabilitySettingsDto
  ) {
    return this.profitability.updateSettings(user, farmId, dto);
  }

  @Get()
  @RequireFarmScopes(FARM_SCOPE.financeRead)
  getPeriod(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query() q: ProfitabilityMonthQueryDto
  ) {
    return this.profitability.getPeriod(user, farmId, q.month, q.year);
  }

  @Get("history")
  @RequireFarmScopes(FARM_SCOPE.financeRead)
  history(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query() q: ProfitabilityHistoryQueryDto
  ) {
    return this.profitability.getHistory(user, farmId, q.months ?? 6);
  }

  @Post("calculate")
  @RequireFarmScopes(FARM_SCOPE.financeWrite)
  calculate(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query() q: ProfitabilityMonthQueryDto
  ) {
    return this.profitability.forceCalculate(user, farmId, q.month, q.year);
  }

  @Get("ic")
  @RequireFarmScopes(FARM_SCOPE.financeRead)
  ic(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query() q: ProfitabilityIcQueryDto & ProfitabilityMonthQueryDto
  ) {
    return this.profitability.getIcByPhase(
      user,
      farmId,
      q.phase,
      q.month,
      q.year
    );
  }

  @Get("simulate")
  @RequireFarmScopes(FARM_SCOPE.financeRead)
  simulate(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query() q: ProfitabilitySimulateQueryDto & ProfitabilityMonthQueryDto
  ) {
    return this.profitability.simulate(
      user,
      farmId,
      q.param,
      q.value,
      q.month,
      q.year
    );
  }
}
