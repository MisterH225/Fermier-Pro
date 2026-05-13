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
import { FarmHealthRecordKind } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { CreateFarmHealthRecordDto } from "./dto/create-farm-health-record.dto";
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
}
