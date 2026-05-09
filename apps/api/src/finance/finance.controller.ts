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
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { CreateRevenueDto } from "./dto/create-revenue.dto";
import { FinanceService } from "./finance.service";

@Controller("farms/:farmId/finance")
@UseGuards(SupabaseJwtGuard, FarmScopesGuard)
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get("summary")
  @RequireFarmScopes(FARM_SCOPE.financeRead)
  summary(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.finance.summary(user, farmId, from, to);
  }

  @Get("expenses")
  @RequireFarmScopes(FARM_SCOPE.financeRead)
  listExpenses(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.finance.listExpenses(user, farmId, from, to);
  }

  @Post("expenses")
  @RequireFarmScopes(FARM_SCOPE.financeWrite)
  createExpense(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: CreateExpenseDto
  ) {
    return this.finance.createExpense(user, farmId, dto);
  }

  @Get("revenues")
  @RequireFarmScopes(FARM_SCOPE.financeRead)
  listRevenues(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.finance.listRevenues(user, farmId, from, to);
  }

  @Post("revenues")
  @RequireFarmScopes(FARM_SCOPE.financeWrite)
  createRevenue(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: CreateRevenueDto
  ) {
    return this.finance.createRevenue(user, farmId, dto);
  }
}
