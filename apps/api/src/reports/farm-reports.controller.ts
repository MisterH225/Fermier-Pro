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
  Res,
  UseGuards
} from "@nestjs/common";
import type { Response } from "express";
import type { User } from "@prisma/client";
import { ReportPeriodType } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { GenerateReportForFarmBodyDto } from "./dto/generate-report-for-farm-body.dto";
import { ReportsService } from "./reports.service";
import { RequirePlatformModule } from "../feature-flags/require-platform-module.decorator";
import { PlatformModuleEnabledGuard } from "../feature-flags/platform-module-enabled.guard";

@Controller("farms/:farmId")
@RequirePlatformModule("reports")
@UseGuards(SupabaseJwtGuard, FarmScopesGuard, PlatformModuleEnabledGuard)
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

  @Get("reports/:reportId")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  getOne(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("reportId") reportId: string
  ) {
    return this.reports.getReportForFarm(user, farmId, reportId);
  }

  @Get("reports/:reportId/download")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  download(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("reportId") reportId: string
  ) {
    return this.reports.getReportDownloadUrlForFarm(user, farmId, reportId);
  }

  @Get("reports/:reportId/pdf")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  async pdf(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("reportId") reportId: string,
    @Res() res: Response
  ) {
    const { buffer, filename } = await this.reports.buildReportPdfForFarm(
      user,
      farmId,
      reportId
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
