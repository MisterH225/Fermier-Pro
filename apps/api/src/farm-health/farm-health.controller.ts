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
import { FarmHealthRecordKind } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { CreateFarmHealthRecordDto } from "./dto/create-farm-health-record.dto";
import { CreateDiseaseCaseDto } from "./dto/create-disease-case.dto";
import { AddDiseaseTreatmentDto } from "./dto/add-disease-treatment.dto";
import { UpdateDiseaseCaseDto } from "./dto/update-disease-case.dto";
import { LinkHealthFinanceDto } from "./dto/link-health-finance.dto";
import { FarmHealthService } from "./farm-health.service";

@Controller("farms/:farmId/health")
@UseGuards(SupabaseJwtGuard, FarmScopesGuard)
export class FarmHealthController {
  constructor(private readonly farmHealth: FarmHealthService) {}

  @Get("overview")
  @RequireFarmScopes(FARM_SCOPE.healthRead)
  overview(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.farmHealth.getOverview(user, farmId);
  }

  @Get("upcoming")
  @RequireFarmScopes(FARM_SCOPE.healthRead)
  upcoming(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.farmHealth.getUpcoming(user, farmId);
  }

  @Get("mortality-rate")
  @RequireFarmScopes(FARM_SCOPE.healthRead)
  mortalityRate(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("period") period?: string
  ) {
    return this.farmHealth.getMortalityRate(user, farmId, period);
  }

  @Get("events")
  @RequireFarmScopes(FARM_SCOPE.healthRead)
  listEvents(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("kind") kind?: FarmHealthRecordKind,
    @Query("status") status?: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.farmHealth.listEvents(user, farmId, {
      kind,
      status,
      from,
      to
    });
  }

  @Post("events")
  @RequireFarmScopes(FARM_SCOPE.healthWrite)
  createEvent(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: CreateFarmHealthRecordDto
  ) {
    return this.farmHealth.createRecord(user, farmId, dto);
  }

  @Post("events/:recordId/link-transaction")
  @RequireFarmScopes(FARM_SCOPE.healthWrite)
  linkTransaction(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("recordId") recordId: string,
    @Body() dto: LinkHealthFinanceDto
  ) {
    return this.farmHealth.linkExpense(user, farmId, recordId, dto.expenseId);
  }

  @Get("diseases/overview")
  @RequireFarmScopes(FARM_SCOPE.healthRead)
  diseasesOverview(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string
  ) {
    return this.farmHealth.getDiseasesOverview(user, farmId);
  }

  @Get("diseases/active")
  @RequireFarmScopes(FARM_SCOPE.healthRead)
  activeDiseases(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("severity") severity?: string,
    @Query("isolation") isolation?: string
  ) {
    return this.farmHealth.getActiveDiseaseCases(user, farmId, {
      severity,
      isolation
    });
  }

  @Get("diseases/history")
  @RequireFarmScopes(FARM_SCOPE.healthRead)
  diseaseHistory(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("period") period?: string
  ) {
    return this.farmHealth.getDiseaseHistory(user, farmId, { period });
  }

  @Post("diseases")
  @RequireFarmScopes(FARM_SCOPE.healthWrite)
  createDisease(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: CreateDiseaseCaseDto
  ) {
    return this.farmHealth.createDiseaseCase(user, farmId, dto);
  }

  @Patch("events/:recordId/resolve")
  @RequireFarmScopes(FARM_SCOPE.healthWrite)
  resolveDisease(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("recordId") recordId: string
  ) {
    return this.farmHealth.resolveDiseaseCase(user, farmId, recordId);
  }

  @Patch("events/:recordId/disease")
  @RequireFarmScopes(FARM_SCOPE.healthWrite)
  updateDisease(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("recordId") recordId: string,
    @Body() dto: UpdateDiseaseCaseDto
  ) {
    return this.farmHealth.updateDiseaseCase(user, farmId, recordId, dto);
  }

  @Post("events/:recordId/treatment")
  @RequireFarmScopes(FARM_SCOPE.healthWrite)
  addTreatment(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("recordId") recordId: string,
    @Body() dto: AddDiseaseTreatmentDto
  ) {
    return this.farmHealth.addTreatmentToDiseaseCase(user, farmId, recordId, dto);
  }

  @Post("events/:recordId/death")
  @RequireFarmScopes(FARM_SCOPE.healthWrite)
  declareDeath(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("recordId") recordId: string
  ) {
    return this.farmHealth.declareDiseaseDeath(user, farmId, recordId);
  }
}
