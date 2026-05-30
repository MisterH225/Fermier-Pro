import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { User } from "@prisma/client";
import { FeedMovementKind, Prisma } from "@prisma/client";
import { AiGeminiService } from "../ai/ai-gemini.service";
import { ensureFarmFinanceBootstrap } from "../finance/finance-bootstrap";
import { PrismaService } from "../prisma/prisma.service";
import { SmartAlertsService } from "../smart-alerts/smart-alerts.service";
import {
  daysBetweenDates,
  isDismissedRecently,
  movementHasCost,
  movementQuantityKg,
  reconciliationDateWindow,
  resolveMovementTotalCost,
  unitPricePerKgFromTotal
} from "./feed-movement-cost.helper";
import { PumpCalculator } from "./pump-calculator";
import { recalculateFeedTypeStock } from "./feed-stock-recalculate.helper";
import type {
  ReconciliationCandidateDto,
  ReconciliationOfferDto,
  MergeReconciliationResultDto
} from "./reconciliation.types";

const FEED_LABEL_TERMS = [
  "%aliment%",
  "%nourriture%",
  "%nutrition%",
  "%feed%",
  "%provende%",
  "%granul%",
  "%alim %"
];

@Injectable()
export class ReconciliationEngine {
  private readonly log = new Logger(ReconciliationEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pump: PumpCalculator,
    private readonly gemini: AiGeminiService,
    private readonly smartAlerts: SmartAlertsService
  ) {}

  private async feedCategoryIds(farmId: string): Promise<string[]> {
    await ensureFarmFinanceBootstrap(this.prisma, farmId);
    const cats = await this.prisma.financeCategory.findMany({
      where: {
        farmId,
        type: "expense",
        OR: [
          { key: "feed" },
          ...FEED_LABEL_TERMS.map((pattern) => ({
            name: { contains: pattern.replace(/%/g, ""), mode: "insensitive" as const }
          }))
        ]
      },
      select: { id: true }
    });
    return cats.map((c) => c.id);
  }

  private async rejectedPairs(
    farmId: string,
    movementId?: string,
    expenseId?: string
  ): Promise<Set<string>> {
    const rows = await this.prisma.feedReconciliationRejection.findMany({
      where: {
        farmId,
        ...(movementId ? { movementId } : {}),
        ...(expenseId ? { expenseId } : {})
      },
      select: { movementId: true, expenseId: true }
    });
    return new Set(rows.map((r) => `${r.movementId}:${r.expenseId}`));
  }

  private async expenseMatchesFeedLabel(
    farmId: string,
    expense: { label: string; financeCategoryId: string | null }
  ): Promise<boolean> {
    const feedIds = await this.feedCategoryIds(farmId);
    if (
      expense.financeCategoryId &&
      feedIds.includes(expense.financeCategoryId)
    ) {
      return true;
    }
    const lower = expense.label.toLowerCase();
    const hints = ["aliment", "nourrit", "feed", "provende", "granul", "nutrition"];
    if (!hints.some((h) => lower.includes(h))) {
      return false;
    }
    if (!this.gemini.isConfigured()) {
      return false;
    }
    try {
      const raw = await this.gemini.generateText(
        `Cette dépense est-elle probablement liée à l'achat d'aliment pour animaux ? Libellé: "${expense.label.replace(/"/g, "'")}". Répondre JSON: {"is_feed_related":boolean,"confidence":number}`
      );
      if (!raw) {
        return false;
      }
      const parsed = JSON.parse(raw) as {
        is_feed_related?: boolean;
        confidence?: number;
      };
      return (
        parsed.is_feed_related === true &&
        (parsed.confidence ?? 0) > 0.7
      );
    } catch {
      return false;
    }
  }

  async searchFinanceForStock(
    movementId: string
  ): Promise<ReconciliationCandidateDto[]> {
    const movement = await this.prisma.feedStockMovement.findUnique({
      where: { id: movementId },
      include: { feedType: { select: { name: true } } }
    });
    if (!movement || movement.kind !== FeedMovementKind.in) {
      return [];
    }
    if (movement.linkedExpenseId || movementHasCost(movement)) {
      return [];
    }
    if (isDismissedRecently(movement.reconciliationDismissedAt)) {
      return [];
    }

    const { gte, lte } = reconciliationDateWindow(movement.occurredAt);
    const feedCatIds = await this.feedCategoryIds(movement.farmId);
    const rejected = await this.rejectedPairs(movement.farmId, movementId);

    const expenses = await this.prisma.farmExpense.findMany({
      where: {
        farmId: movement.farmId,
        occurredAt: { gte, lte },
        financeCategoryId: { in: feedCatIds },
        linkedStockMovementIds: { isEmpty: true }
      },
      orderBy: { occurredAt: "asc" },
      take: 30
    });

    const extra: typeof expenses = [];
    const ambiguous = await this.prisma.farmExpense.findMany({
      where: {
        farmId: movement.farmId,
        occurredAt: { gte, lte },
        NOT: { financeCategoryId: { in: feedCatIds } },
        linkedStockMovementIds: { isEmpty: true }
      },
      take: 20
    });
    for (const e of ambiguous) {
      if (await this.expenseMatchesFeedLabel(movement.farmId, e)) {
        extra.push(e);
      }
    }

    const merged = [...expenses, ...extra];
    const seen = new Set<string>();
    const out: ReconciliationCandidateDto[] = [];
    for (const e of merged) {
      if (seen.has(e.id) || rejected.has(`${movementId}:${e.id}`)) {
        continue;
      }
      if (e.linkedStockMovementIds.length > 0) {
        continue;
      }
      seen.add(e.id);
      out.push({
        expenseId: e.id,
        amount: e.amount.toString(),
        currency: e.currency,
        label: e.label,
        occurredAt: e.occurredAt.toISOString(),
        daysDelta: daysBetweenDates(e.occurredAt, movement.occurredAt)
      });
    }

    out.sort((a, b) => a.daysDelta - b.daysDelta);
    return out.slice(0, 10);
  }

  async searchStockForFinance(
    expenseId: string
  ): Promise<ReconciliationCandidateDto[]> {
    const expense = await this.prisma.farmExpense.findUnique({
      where: { id: expenseId }
    });
    if (!expense || expense.linkedStockMovementIds.length > 0) {
      return [];
    }

    const feedCatIds = await this.feedCategoryIds(expense.farmId);
    const isFeed =
      (expense.financeCategoryId &&
        feedCatIds.includes(expense.financeCategoryId)) ||
      (await this.expenseMatchesFeedLabel(expense.farmId, expense));
    if (!isFeed) {
      return [];
    }

    const { gte, lte } = reconciliationDateWindow(expense.occurredAt);
    const rejected = await this.rejectedPairs(expense.farmId, undefined, expenseId);

    const movements = await this.prisma.feedStockMovement.findMany({
      where: {
        farmId: expense.farmId,
        kind: FeedMovementKind.in,
        linkedExpenseId: null,
        occurredAt: { gte, lte },
        OR: [{ totalCost: null }, { unitPrice: null }]
      },
      include: { feedType: { select: { name: true } } },
      orderBy: { occurredAt: "asc" },
      take: 20
    });

    const out: ReconciliationCandidateDto[] = [];
    for (const m of movements) {
      if (movementHasCost(m) || rejected.has(`${m.id}:${expenseId}`)) {
        continue;
      }
      if (isDismissedRecently(m.reconciliationDismissedAt)) {
        continue;
      }
      out.push({
        expenseId: expense.id,
        amount: expense.amount.toString(),
        currency: expense.currency,
        label: expense.label,
        occurredAt: expense.occurredAt.toISOString(),
        daysDelta: daysBetweenDates(m.occurredAt, expense.occurredAt)
      });
    }
    out.sort((a, b) => a.daysDelta - b.daysDelta);
    return out;
  }

  private stockCard(
    m: {
      id: string;
      occurredAt: Date;
      supplier: string | null;
      quantityKg: Prisma.Decimal | null;
      feedType: { name: string };
    }
  ) {
    return {
      movementId: m.id,
      feedTypeName: m.feedType.name,
      quantityKg: m.quantityKg?.toString() ?? "0",
      occurredAt: m.occurredAt.toISOString(),
      supplier: m.supplier
    };
  }

  async buildOfferForMovement(
    movementId: string
  ): Promise<ReconciliationOfferDto> {
    const movement = await this.prisma.feedStockMovement.findUnique({
      where: { id: movementId },
      include: { feedType: { select: { name: true } } }
    });
    if (!movement) {
      return { status: "none" };
    }
    const candidates = await this.searchFinanceForStock(movementId);
    if (candidates.length === 0) {
      return { status: "none", movementId };
    }
    const stock = this.stockCard(movement);
    if (candidates.length === 1) {
      const c = candidates[0]!;
      const kg = movementQuantityKg(movement);
      const amount = Number.parseFloat(c.amount);
      const unitPrice = unitPricePerKgFromTotal(amount, kg);
      return {
        status: "single",
        movementId,
        expenseId: c.expenseId,
        stock,
        finance: {
          expenseId: c.expenseId,
          amount: c.amount,
          currency: c.currency,
          label: c.label,
          occurredAt: c.occurredAt
        },
        calculatedUnitPricePerKg: unitPrice ?? undefined,
        currency: c.currency
      };
    }
    return {
      status: "multiple",
      movementId,
      stock,
      candidates
    };
  }

  async buildOfferForExpense(
    expenseId: string
  ): Promise<ReconciliationOfferDto> {
    const expense = await this.prisma.farmExpense.findUnique({
      where: { id: expenseId }
    });
    if (!expense) {
      return { status: "none" };
    }
    const { gte, lte } = reconciliationDateWindow(expense.occurredAt);
    const movements = await this.prisma.feedStockMovement.findMany({
      where: {
        farmId: expense.farmId,
        kind: FeedMovementKind.in,
        linkedExpenseId: null,
        occurredAt: { gte, lte }
      },
      include: { feedType: { select: { name: true } } },
      take: 10
    });
    const rejected = await this.rejectedPairs(expense.farmId, undefined, expenseId);
    const eligible = movements.filter(
      (m) =>
        !movementHasCost(m) &&
        !rejected.has(`${m.id}:${expenseId}`) &&
        !isDismissedRecently(m.reconciliationDismissedAt)
    );
    if (eligible.length === 0) {
      return { status: "none" };
    }
    if (eligible.length === 1) {
      const m = eligible[0]!;
      const kg = movementQuantityKg(m);
      const amount = expense.amount.toNumber();
      return {
        status: "single",
        movementId: m.id,
        expenseId,
        stock: this.stockCard(m),
        finance: {
          expenseId,
          amount: expense.amount.toString(),
          currency: expense.currency,
          label: expense.label,
          occurredAt: expense.occurredAt.toISOString()
        },
        calculatedUnitPricePerKg:
          unitPricePerKgFromTotal(amount, kg) ?? undefined,
        currency: expense.currency
      };
    }
    return {
      status: "multiple",
      expenseId,
      finance: {
        expenseId,
        amount: expense.amount.toString(),
        currency: expense.currency,
        label: expense.label,
        occurredAt: expense.occurredAt.toISOString()
      },
      candidates: eligible.map((m) => ({
        expenseId,
        amount: expense.amount.toString(),
        currency: expense.currency,
        label: `${m.feedType.name} — ${m.quantityKg?.toString() ?? "0"} kg`,
        occurredAt: m.occurredAt.toISOString(),
        daysDelta: daysBetweenDates(m.occurredAt, expense.occurredAt)
      }))
    };
  }

  async mergeStockAndFinance(
    user: User,
    farmId: string,
    movementId: string,
    expenseId: string
  ): Promise<MergeReconciliationResultDto> {
    const movement = await this.prisma.feedStockMovement.findFirst({
      where: { id: movementId, farmId, kind: FeedMovementKind.in }
    });
    const expense = await this.prisma.farmExpense.findFirst({
      where: { id: expenseId, farmId }
    });
    if (!movement || !expense) {
      throw new NotFoundException("Mouvement ou dépense introuvable");
    }

    const kg = movementQuantityKg(movement);
    const amount = expense.amount.toNumber();
    const unitPrice = unitPricePerKgFromTotal(amount, kg);

    await this.prisma.$transaction(async (tx) => {
      await tx.feedStockMovement.update({
        where: { id: movementId },
        data: {
          linkedExpenseId: expenseId,
          totalCost: expense.amount,
          unitPrice:
            unitPrice != null ? new Prisma.Decimal(unitPrice) : null,
          isCostMissing: false,
          reconciliationDismissedAt: null
        }
      });
      const linked = new Set(expense.linkedStockMovementIds);
      linked.add(movementId);
      await tx.farmExpense.update({
        where: { id: expenseId },
        data: { linkedStockMovementIds: [...linked] }
      });
      await this.pump.recalculateForFeedType(tx, farmId, movement.feedTypeId);
    });

    void this.smartAlerts.refreshInternal(farmId).catch(() => undefined);

    return {
      movementId,
      expenseId,
      unitPricePerKg: unitPrice ?? 0,
      currency: expense.currency
    };
  }

  async rejectReconciliation(
    user: User,
    farmId: string,
    movementId: string,
    expenseId: string
  ): Promise<void> {
    await this.prisma.feedReconciliationRejection.upsert({
      where: {
        movementId_expenseId: { movementId, expenseId }
      },
      create: {
        farmId,
        movementId,
        expenseId,
        rejectedByUserId: user.id
      },
      update: {
        rejectedAt: new Date(),
        rejectedByUserId: user.id
      }
    });
  }

  async dismissTemporarily(movementId: string): Promise<void> {
    await this.prisma.feedStockMovement.update({
      where: { id: movementId },
      data: {
        reconciliationDismissedAt: new Date(),
        isCostMissing: true
      }
    });
  }

  async flagCostMissing(movementId: string): Promise<void> {
    await this.prisma.feedStockMovement.update({
      where: { id: movementId },
      data: { isCostMissing: true }
    });
  }

  async addCostFromFollowUp(
    user: User,
    farmId: string,
    movementId: string,
    totalCost: number,
    supplier?: string
  ) {
    const movement = await this.prisma.feedStockMovement.findFirst({
      where: { id: movementId, farmId, kind: FeedMovementKind.in },
      include: { feedType: true }
    });
    if (!movement) {
      throw new NotFoundException("Mouvement introuvable");
    }
    const settings = await this.prisma.farmFinanceSettings.findUnique({
      where: { farmId }
    });
    const catId = (await this.feedCategoryIds(farmId))[0] ?? null;
    const kg = movementQuantityKg(movement);
    const unitPrice = unitPricePerKgFromTotal(totalCost, kg);

    const result = await this.prisma.$transaction(async (tx) => {
      const expense = await tx.farmExpense.create({
        data: {
          farmId,
          amount: new Prisma.Decimal(totalCost),
          currency: settings?.currencyCode ?? "XOF",
          label: `Aliment : ${movement.feedType.name}`,
          note: movement.notes?.slice(0, 500) ?? null,
          occurredAt: movement.occurredAt,
          financeCategoryId: catId,
          linkedStockMovementIds: [movementId],
          createdByUserId: user.id
        }
      });
      await tx.feedStockMovement.update({
        where: { id: movementId },
        data: {
          linkedExpenseId: expense.id,
          totalCost: new Prisma.Decimal(totalCost),
          unitPrice:
            unitPrice != null ? new Prisma.Decimal(unitPrice) : null,
          supplier: supplier?.trim() || movement.supplier,
          isCostMissing: false,
          reconciliationDismissedAt: null
        }
      });
      await this.pump.recalculateForFeedType(
        tx,
        farmId,
        movement.feedTypeId
      );
      return expense;
    });

    void this.smartAlerts.refreshInternal(farmId).catch(() => undefined);
    return result;
  }

  async scanUnlinkedMovements(farmId: string): Promise<number> {
    const movements = await this.prisma.feedStockMovement.findMany({
      where: {
        farmId,
        kind: FeedMovementKind.in,
        linkedExpenseId: null,
        isCostMissing: false,
        OR: [{ totalCost: null }, { unitPrice: null }]
      },
      select: { id: true }
    });
    let flagged = 0;
    for (const m of movements) {
      const offer = await this.buildOfferForMovement(m.id);
      if (offer.status === "none") {
        await this.flagCostMissing(m.id);
        flagged += 1;
      }
    }
    if (flagged > 0) {
      void this.smartAlerts.refreshInternal(farmId).catch(() => undefined);
    }
    return flagged;
  }
}
