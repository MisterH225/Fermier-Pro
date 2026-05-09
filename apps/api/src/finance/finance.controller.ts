import {
  Body,
  Controller,
  Delete,
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
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { CreateRevenueDto } from "./dto/create-revenue.dto";
import { UpdateExpenseDto } from "./dto/update-expense.dto";
import { UpdateRevenueDto } from "./dto/update-revenue.dto";
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

  @Get("expenses/:expenseId")
  @RequireFarmScopes(FARM_SCOPE.financeRead)
  getExpense(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("expenseId") expenseId: string
  ) {
    return this.finance.getExpense(user, farmId, expenseId);
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

  @Patch("expenses/:expenseId")
  @RequireFarmScopes(FARM_SCOPE.financeWrite)
  updateExpense(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("expenseId") expenseId: string,
    @Body() dto: UpdateExpenseDto
  ) {
    return this.finance.updateExpense(user, farmId, expenseId, dto);
  }

  @Delete("expenses/:expenseId")
  @RequireFarmScopes(FARM_SCOPE.financeWrite)
  deleteExpense(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("expenseId") expenseId: string
  ) {
    return this.finance.deleteExpense(user, farmId, expenseId);
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

  @Get("revenues/:revenueId")
  @RequireFarmScopes(FARM_SCOPE.financeRead)
  getRevenue(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("revenueId") revenueId: string
  ) {
    return this.finance.getRevenue(user, farmId, revenueId);
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

  @Patch("revenues/:revenueId")
  @RequireFarmScopes(FARM_SCOPE.financeWrite)
  updateRevenue(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("revenueId") revenueId: string,
    @Body() dto: UpdateRevenueDto
  ) {
    return this.finance.updateRevenue(user, farmId, revenueId, dto);
  }

  @Delete("revenues/:revenueId")
  @RequireFarmScopes(FARM_SCOPE.financeWrite)
  deleteRevenue(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("revenueId") revenueId: string
  ) {
    return this.finance.deleteRevenue(user, farmId, revenueId);
  }
}
