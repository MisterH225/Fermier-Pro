import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  HistoricalCategory,
  HistoricalEntryMode,
  HistoricalMovementType,
  Prisma
} from "@prisma/client";
import { FarmAccessService } from "../common/farm-access.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProfitabilityEngine } from "../profitability/profitability.engine";
import {
  HISTORICAL_EXPENSE_CATEGORIES,
  HISTORICAL_INCOME_CATEGORIES
} from "./historical-records.constants";
import { CreateQuickTotalDto } from "./dto/create-quick-total.dto";
import { getHistoricalSummary } from "./historical-summary.util";

@Injectable()
export class HistoricalRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly profitability: ProfitabilityEngine
  ) {}

  private assertCategoryMatchesType(
    movementType: HistoricalMovementType,
    category: HistoricalCategory
  ) {
    const allowed =
      movementType === HistoricalMovementType.income
        ? HISTORICAL_INCOME_CATEGORIES
        : HISTORICAL_EXPENSE_CATEGORIES;
    if (!allowed.includes(category)) {
      throw new BadRequestException(
        "La catégorie ne correspond pas au type de mouvement"
      );
    }
  }

  async createQuickTotal(
    user: User,
    farmId: string,
    dto: CreateQuickTotalDto
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    this.assertCategoryMatchesType(dto.movementType, dto.category);

    const record = await this.prisma.historicalRecord.create({
      data: {
        farmId,
        movementType: dto.movementType,
        category: dto.category,
        amount: new Prisma.Decimal(dto.amount),
        entryMode: HistoricalEntryMode.quick_total,
        periodStart: dto.periodStart ? new Date(dto.periodStart) : null,
        periodEnd: new Date(dto.periodEnd),
        notes: dto.notes?.trim() || null
      }
    });

    this.profitability.scheduleRecalculate(farmId);
    return this.serializeRecord(record);
  }

  async getSummary(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const summary = await getHistoricalSummary(this.prisma, farmId);
    return {
      total_income: summary.totalIncome,
      total_expense: summary.totalExpense,
      net_result: summary.netResult,
      by_category: summary.byCategory,
      records_count: summary.recordsCount
    };
  }

  async listRecords(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const rows = await this.prisma.historicalRecord.findMany({
      where: { farmId },
      orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }]
    });
    return rows.map((row) => this.serializeRecord(row));
  }

  async deleteRecord(user: User, farmId: string, id: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const row = await this.prisma.historicalRecord.findFirst({
      where: { id, farmId }
    });
    if (!row) {
      throw new NotFoundException("Enregistrement historique introuvable");
    }
    await this.prisma.historicalRecord.delete({ where: { id } });
    this.profitability.scheduleRecalculate(farmId);
    return { message: "Supprimé" };
  }

  async deleteImportBatch(user: User, farmId: string, batchId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const count = await this.prisma.historicalRecord.count({
      where: { farmId, importBatchId: batchId }
    });
    if (count === 0) {
      throw new NotFoundException("Import introuvable");
    }
    await this.prisma.historicalRecord.deleteMany({
      where: { farmId, importBatchId: batchId }
    });
    this.profitability.scheduleRecalculate(farmId);
    return { message: "Import annulé", deleted: count };
  }

  private serializeRecord(row: {
    id: string;
    farmId: string;
    movementType: HistoricalMovementType;
    category: HistoricalCategory;
    amount: Prisma.Decimal;
    entryMode: HistoricalEntryMode;
    periodStart: Date | null;
    periodEnd: Date;
    transactionDate: Date | null;
    description: string | null;
    importBatchId: string | null;
    sourceFilename: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      farm_id: row.farmId,
      movement_type: row.movementType,
      category: row.category,
      amount: row.amount.toString(),
      entry_mode: row.entryMode,
      period_start: row.periodStart?.toISOString().slice(0, 10) ?? null,
      period_end: row.periodEnd.toISOString().slice(0, 10),
      transaction_date:
        row.transactionDate?.toISOString().slice(0, 10) ?? null,
      description: row.description,
      import_batch_id: row.importBatchId,
      source_filename: row.sourceFilename,
      notes: row.notes,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString()
    };
  }
}
