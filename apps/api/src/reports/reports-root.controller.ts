import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import type { Response } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FarmAccessService } from "../common/farm-access.service";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { GenerateFarmReportDto } from "./dto/generate-farm-report.dto";
import { ReportsService } from "./reports.service";

@Controller("reports")
@UseGuards(SupabaseJwtGuard)
export class ReportsRootController {
  constructor(
    private readonly reports: ReportsService,
    private readonly farmAccess: FarmAccessService
  ) {}

  @Post("generate")
  @HttpCode(HttpStatus.CREATED)
  async generate(@CurrentUser() user: User, @Body() dto: GenerateFarmReportDto) {
    await this.farmAccess.requireFarmScopes(user.id, dto.farmId, [
      FARM_SCOPE.financeRead,
      FARM_SCOPE.livestockRead
    ]);
    return this.reports.generateReport(user, dto.farmId, dto.periodType, dto.anchor);
  }

  @Get(":reportId")
  getOne(@CurrentUser() user: User, @Param("reportId") reportId: string) {
    return this.reports.getReport(user, reportId);
  }

  @Get(":reportId/pdf")
  async pdf(
    @CurrentUser() user: User,
    @Param("reportId") reportId: string,
    @Res() res: Response
  ) {
    const { buffer, filename } = await this.reports.buildReportPdf(user, reportId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
