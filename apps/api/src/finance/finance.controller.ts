import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import type { Response } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FeatureEnabledGuard } from "../config-client/feature-enabled.guard";
import { RequireFeature } from "../config-client/require-feature.decorator";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { CreateFinanceCategoryDto } from "./dto/create-finance-category.dto";
import { CreateFinanceTransactionDto } from "./dto/create-finance-transaction.dto";
import { CreateRevenueDto } from "./dto/create-revenue.dto";
import { UpdateExpenseDto } from "./dto/update-expense.dto";
import { UpdateFinanceSettingsDto } from "./dto/update-finance-settings.dto";
import { UpdateRevenueDto } from "./dto/update-revenue.dto";
import { FinanceService } from "./finance.service";

@Controller("farms/:farmId/finance")
@RequireFeature("finance")
@UseGuards(SupabaseJwtGuard, FeatureEnabledGuard, FarmScopesGuard)
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get("overview")
  @RequireFarmScopes(FARM_SCOPE.financeRead)
  overview(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.finance.financeOverview(user, farmId);
  }

  @Get("settings")
  @RequireFarmScopes(FARM_SCOPE.financeRead)
  getSettings(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.finance.getFinanceSettings(user, farmId);
  }

  @Patch("settings")
  @Put("settings")
  @RequireFarmScopes(FARM_SCOPE.financeWrite)
  updateSettings(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: UpdateFinanceSettingsDto
  ) {
    return this.finance.updateFinanceSettings(user, farmId, dto);
  }

  @Get("categories")
  @RequireFarmScopes(FARM_SCOPE.financeRead)
  listCategories(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.finance.listFinanceCategories(user, farmId);
  }

  @Post("categories")
  @RequireFarmScopes(FARM_SCOPE.financeWrite)
  createCategory(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: CreateFinanceCategoryDto
  ) {
    return this.finance.createCustomFinanceCategory(user, farmId, {
      type: dto.type,
      key: dto.key,
      name: dto.name,
      icon: dto.icon
    });
  }

  @Delete("categories/:categoryId")
  @RequireFarmScopes(FARM_SCOPE.financeWrite)
  deleteCategory(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("categoryId") categoryId: string
  ) {
    return this.finance.deleteFinanceCategory(user, farmId, categoryId);
  }

  @Get("transactions")
  @RequireFarmScopes(FARM_SCOPE.financeRead)
  listTransactions(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("type") type?: "income" | "expense",
    @Query("financeCategoryId") financeCategoryId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.finance.listMergedTransactions(user, farmId, {
      type,
      financeCategoryId,
      from,
      to
    });
  }

  @Post("transactions")
  @RequireFarmScopes(FARM_SCOPE.financeWrite)
  createTransaction(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: CreateFinanceTransactionDto
  ) {
    return this.finance.createMergedTransaction(user, farmId, {
      type: dto.type,
      financeCategoryId: dto.financeCategoryId,
      amount: dto.amount,
      currency: dto.currency,
      label: dto.label,
      occurredAt: dto.occurredAt,
      linkedEntityType: dto.linkedEntityType,
      linkedEntityId: dto.linkedEntityId,
      attachmentUrl: dto.attachmentUrl,
      note: dto.note
    });
  }

  @Get("report")
  @RequireFarmScopes(FARM_SCOPE.financeRead)
  report(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("period") period: "month" | "year" = "month",
    @Query("month") month?: string,
    @Query("year") year?: string
  ) {
    return this.finance.financeReport(user, farmId, period, month, year);
  }

  @Get("margin-by-batch")
  @RequireFarmScopes(FARM_SCOPE.financeRead)
  marginByBatch(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("batchId") batchId?: string
  ) {
    if (!batchId?.trim()) {
      throw new BadRequestException("batchId requis");
    }
    return this.finance.financeMarginByBatch(user, farmId, batchId.trim());
  }

  @Get("projection")
  @RequireFarmScopes(FARM_SCOPE.financeRead)
  projection(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.finance.financeProjection(user, farmId);
  }

  @Get("simulation")
  @RequireFarmScopes(FARM_SCOPE.financeRead)
  simulation(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("saleHeadcount") saleHeadcount: string,
    @Query("pricePerHead") pricePerHead: string
  ) {
    return this.finance.financeSimulation(
      user,
      farmId,
      Number(saleHeadcount),
      Number(pricePerHead)
    );
  }

  @Get("export")
  @RequireFarmScopes(FARM_SCOPE.financeRead)
  async export(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Res() res: Response,
    @Query("format") format = "csv",
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("period") period: "month" | "year" = "month",
    @Query("month") month?: string,
    @Query("year") year?: string
  ) {
    const fmt = (format || "csv").toLowerCase();
    if (fmt === "pdf") {
      const buf = await this.finance.financeExportPdf(
        user,
        farmId,
        period,
        month,
        year
      );
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="rapport-finance.pdf"'
      );
      res.send(buf);
      return;
    }
    const csv = await this.finance.financeExportCsv(user, farmId, from, to);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="finance-transactions.csv"'
    );
    res.send(`\ufeff${csv}`);
  }

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
