import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { IsBoolean, IsNumber, IsOptional, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { SmartAlertsService } from "./smart-alerts.service";

export class UpdateFarmAlertSettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  mortalityRateThresholdPct?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lowBalanceThreshold?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(120)
  stockWarningDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(60)
  stockCriticalDays?: number;

  @IsOptional()
  @IsBoolean()
  pushStock?: boolean;

  @IsOptional()
  @IsBoolean()
  pushHealth?: boolean;

  @IsOptional()
  @IsBoolean()
  pushFinance?: boolean;

  @IsOptional()
  @IsBoolean()
  pushGestation?: boolean;

  @IsOptional()
  @IsBoolean()
  pushCheptel?: boolean;
}

@Controller("farms/:farmId")
@UseGuards(SupabaseJwtGuard, FarmScopesGuard)
export class FarmSmartAlertsController {
  constructor(private readonly smartAlerts: SmartAlertsService) {}

  @Get("alerts")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  listAlerts(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("priority") priority?: string,
    @Query("module") module?: string,
    @Query("unread") unread?: string
  ) {
    return this.smartAlerts.listForFarm(user, farmId, {
      priority,
      module,
      unread
    });
  }

  @Get("alerts/count")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  alertsCount(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.smartAlerts.countUnreadCritical(user, farmId);
  }

  @Post("alerts/refresh")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  refreshAlerts(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.smartAlerts.refreshForFarm(user, farmId);
  }

  @Patch("alerts/:alertId/read")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  markAlertRead(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("alertId") alertId: string
  ) {
    return this.smartAlerts.markRead(user, farmId, alertId);
  }

  @Get("alert-settings")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  getAlertSettings(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.smartAlerts.getOrCreateSettings(user, farmId);
  }

  @Put("alert-settings")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  putAlertSettings(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: UpdateFarmAlertSettingsDto
  ) {
    return this.smartAlerts.updateSettings(user, farmId, dto);
  }
}
