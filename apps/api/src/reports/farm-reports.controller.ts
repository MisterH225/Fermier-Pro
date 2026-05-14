import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { ReportPeriodType } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { GenerateReportForFarmBodyDto } from "./dto/generate-report-for-farm-body.dto";
import { ReportsService } from "./reports.service";

@Controller("farms/:farmId")
@UseGuards(SupabaseJwtGuard, FarmScopesGuard)
export class FarmReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("reports/preview")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  preview(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("periodType") periodType: ReportPeriodType,
    @Query("year") year: string,
    @Query("month") month?: string,
    @Query("quarter") quarter?: string
  ) {
    const y = Number(year);
    if (!Number.isFinite(y)) {
      throw new BadRequestException("year invalide");
    }
    return this.reports.preview(user, farmId, periodType, {
      year: y,
      month: month ? Number(month) : undefined,
      quarter: quarter ? Number(quarter) : undefined
    });
  }

  @Get("score")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  score(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("year") year?: string,
    @Query("month") month?: string
  ) {
    const y = year ? Number(year) : new Date().getUTCFullYear();
    const m = month ? Number(month) : new Date().getUTCMonth() + 1;
    return this.reports.currentScore(user, farmId, {
      year: Number.isFinite(y) ? y : new Date().getUTCFullYear(),
      month: Number.isFinite(m) ? m : new Date().getUTCMonth() + 1
    });
  }

  @Get("reports")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  list(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.reports.listReports(user, farmId);
  }

  @Post("reports/generate")
  @HttpCode(HttpStatus.CREATED)
  @RequireFarmScopes(FARM_SCOPE.financeRead, FARM_SCOPE.livestockRead)
  generate(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() body: GenerateReportForFarmBodyDto
  ) {
    return this.reports.generateReport(user, farmId, body.periodType, body.anchor);
  }
}
