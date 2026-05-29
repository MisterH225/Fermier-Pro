import { Injectable, NotFoundException } from "@nestjs/common";
import type { User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { FarmAccessService } from "../common/farm-access.service";
import { PushNotificationsService } from "../push-notifications/push-notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import type {
  ComputedSmartAlert,
  FarmAlertThresholds,
  SmartAlertI18nDto
} from "./smart-alerts.types";
import { evaluateCheptelRules } from "./rules/cheptel.rules";
import { evaluateMarketRules } from "./rules/market.rules";
import { evaluateFinanceRules } from "./rules/finance.rules";
import { evaluateGestationRules } from "./rules/gestation.rules";
import { evaluateHealthRules } from "./rules/health.rules";
import { evaluateStockRules } from "./rules/stock.rules";

const READ_VISIBLE_HOURS = 24;

@Injectable()
export class SmartAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly push: PushNotificationsService
  ) {}

  private async resolveThresholds(farmId: string): Promise<FarmAlertThresholds> {
    const [st, fin] = await Promise.all([
      this.prisma.farmAlertSettings.findUnique({ where: { farmId } }),
      this.prisma.farmFinanceSettings.findUnique({ where: { farmId } })
    ]);
    return {
      stockCriticalDays: st?.stockCriticalDays ?? 15,
      stockWarningDays: st?.stockWarningDays ?? 30,
      mortalityRateThresholdPct:
        st?.mortalityRateThresholdPct?.toNumber() ?? 5,
      lowBalanceThreshold:
        st?.lowBalanceThreshold?.toNumber() ??
        fin?.lowBalanceThreshold?.toNumber() ??
        null
    };
  }

  private enrichActions(
    items: ComputedSmartAlert[],
    farmId: string,
    farmName: string
  ): ComputedSmartAlert[] {
    return items.map((a) => {
      if (!a.action?.params || typeof a.action.params !== "object") {
        return a;
      }
      return {
        ...a,
        action: {
          ...a.action,
          params: { farmName, ...a.action.params, farmId }
        }
      };
    });
  }


  private buildActionParams(
    draft: ComputedSmartAlert,
    farmId: string,
    farmName: string
  ): Record<string, unknown> | undefined {
    const base =
      draft.action?.params && typeof draft.action.params === "object"
        ? { ...draft.action.params }
        : {};
    const merged: Record<string, unknown> = { farmName, farmId, ...base };
    if (draft.i18n) {
      merged._i18n = draft.i18n;
    }
    return Object.keys(merged).length ? merged : undefined;
  }

  private extractI18n(
    actionParams: unknown
  ): SmartAlertI18nDto | undefined {
    if (!actionParams || typeof actionParams !== "object") {
      return undefined;
    }
    const raw = (actionParams as Record<string, unknown>)._i18n;
    if (!raw || typeof raw !== "object") {
      return undefined;
    }
    const i18n = raw as SmartAlertI18nDto;
    if (typeof i18n.titleKey !== "string" || typeof i18n.messageKey !== "string") {
      return undefined;
    }
    return i18n;
  }

  private sanitizeActionParams(
    actionParams: unknown
  ): Record<string, unknown> | undefined {
    if (!actionParams || typeof actionParams !== "object") {
      return undefined;
    }
    const copy = { ...(actionParams as Record<string, unknown>) };
    delete copy._i18n;
    return Object.keys(copy).length ? copy : undefined;
  }

  private async resolveFarmNotifyUserIds(farm: {
    ownerId: string;
    memberships: { userId: string }[];
  }): Promise<string[]> {
    const ids = new Set<string>([farm.ownerId]);
    for (const m of farm.memberships) {
      ids.add(m.userId);
    }
    return [...ids];
  }

  private async notifyMarketAlertPush(
    farm: {
      id: string;
      name: string;
      ownerId: string;
      memberships: { userId: string }[];
    },
    draft: ComputedSmartAlert
  ): Promise<void> {
    const settings = await this.prisma.farmAlertSettings.findUnique({
      where: { farmId: farm.id }
    });
    if (settings?.pushMarket === false) {
      return;
    }
    const userIds = await this.resolveFarmNotifyUserIds(farm);
    const params = this.buildActionParams(draft, farm.id, farm.name);
    const payload = {
      type: "smart_alert",
      route: draft.action?.route ?? "BuyerDashboard",
      farmId: farm.id,
      params: JSON.stringify(this.sanitizeActionParams(params) ?? {})
    };
    for (const userId of userIds) {
      void this.push
        .sendToUser(userId, draft.title, draft.message, payload)
        .catch(() => undefined);
    }
  }

  async evaluateDrafts(farmId: string): Promise<ComputedSmartAlert[]> {
    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      select: { id: true, name: true }
    });
    if (!farm) {
      return [];
    }
    const th = await this.resolveThresholds(farmId);
    const [stock, health, finance, gestation, cheptel, market] = await Promise.all([
      evaluateStockRules(this.prisma, farmId, th),
      evaluateHealthRules(this.prisma, farmId, th),
      evaluateFinanceRules(this.prisma, farmId, th),
      evaluateGestationRules(this.prisma, farmId),
      evaluateCheptelRules(this.prisma, farmId),
      evaluateMarketRules(this.prisma)
    ]);
    const merged = [...stock, ...health, ...finance, ...gestation, ...cheptel, ...market];
    return this.enrichActions(merged, farmId, farm.name);
  }

  /** Recalcul complet et synchronisation base (préserve isRead / readAt par ruleKey). */
  async refreshForFarm(user: User, farmId: string): Promise<{ synced: number }> {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const n = await this.refreshInternal(farmId);
    return { synced: n };
  }

  /** Appel interne après mutations (sans user) — ferme supposée valide. */
  async refreshInternal(farmId: string): Promise<number> {
    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      select: { id: true, name: true }
    });
    if (!farm) {
      return 0;
    }
    const drafts = await this.evaluateDrafts(farmId);
    const keys = new Set(drafts.map((d) => d.ruleKey));

    await this.prisma.$transaction(async (tx) => {
      for (const d of drafts) {
        const ap = this.buildActionParams(d, farmId, farm.name);
        await tx.smartAlert.upsert({
          where: { farmId_ruleKey: { farmId, ruleKey: d.ruleKey } },
          create: {
            farmId,
            ruleKey: d.ruleKey,
            module: d.module,
            priority: d.priority,
            title: d.title,
            message: d.message,
            actionRoute: d.action?.route ?? null,
            actionParams:
              ap != null ? (ap as Prisma.InputJsonValue) : undefined,
            isRead: false
          },
          update: {
            module: d.module,
            priority: d.priority,
            title: d.title,
            message: d.message,
            actionRoute: d.action?.route ?? null,
            actionParams:
              ap != null ? (ap as Prisma.InputJsonValue) : undefined
          }
        });
      }
      if (keys.size === 0) {
        await tx.smartAlert.deleteMany({ where: { farmId } });
      } else {
        await tx.smartAlert.deleteMany({
          where: {
            farmId,
            ruleKey: { notIn: [...keys] }
          }
        });
      }
    });

    return drafts.length;
  }


  /** Propagation des alertes marché (indice PigPrice) sur toutes les fermes. */
  async syncMarketAlertsGlobally(): Promise<void> {
    const marketDrafts = await evaluateMarketRules(this.prisma);
    const activeKeys = marketDrafts.map((d) => d.ruleKey);
    const farms = await this.prisma.farm.findMany({
      select: {
        id: true,
        name: true,
        ownerId: true,
        memberships: { select: { userId: true } }
      }
    });

    for (const farm of farms) {
      const drafts = this.enrichActions(marketDrafts, farm.id, farm.name);
      const created: ComputedSmartAlert[] = [];

      await this.prisma.$transaction(async (tx) => {
        for (const d of drafts) {
          const existing = await tx.smartAlert.findUnique({
            where: {
              farmId_ruleKey: { farmId: farm.id, ruleKey: d.ruleKey }
            }
          });
          const ap = this.buildActionParams(d, farm.id, farm.name);
          await tx.smartAlert.upsert({
            where: {
              farmId_ruleKey: { farmId: farm.id, ruleKey: d.ruleKey }
            },
            create: {
              farmId: farm.id,
              ruleKey: d.ruleKey,
              module: d.module,
              priority: d.priority,
              title: d.title,
              message: d.message,
              actionRoute: d.action?.route ?? null,
              actionParams:
                ap != null ? (ap as Prisma.InputJsonValue) : undefined,
              isRead: false
            },
            update: {
              module: d.module,
              priority: d.priority,
              title: d.title,
              message: d.message,
              actionRoute: d.action?.route ?? null,
              actionParams:
                ap != null ? (ap as Prisma.InputJsonValue) : undefined
            }
          });
          if (!existing) {
            created.push(d);
          }
        }
        await tx.smartAlert.deleteMany({
          where: {
            farmId: farm.id,
            ruleKey: { startsWith: "market-price-variation:" },
            ...(activeKeys.length > 0 ? { ruleKey: { notIn: activeKeys } } : {})
          }
        });
      });

      for (const draft of created) {
        await this.notifyMarketAlertPush(farm, draft);
      }
    }
  }

  private readVisibilityCutoff(): Date {
    return new Date(Date.now() - READ_VISIBLE_HOURS * 60 * 60 * 1000);
  }

  async listForFarm(
    user: User,
    farmId: string,
    q: {
      priority?: string;
      module?: string;
      unread?: string;
    }
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const cutoff = this.readVisibilityCutoff();
    const where: Prisma.SmartAlertWhereInput = {
      farmId,
      OR: [
        { isRead: false },
        { readAt: null },
        { readAt: { gte: cutoff } }
      ]
    };
    if (q.priority === "critical" || q.priority === "warning" || q.priority === "info") {
      where.priority = q.priority;
    }
    if (
      q.module === "stock" ||
      q.module === "health" ||
      q.module === "finance" ||
      q.module === "gestation" ||
      q.module === "cheptel" ||
      q.module === "market"
    ) {
      where.module = q.module;
    }
    if (q.unread === "1" || q.unread === "true") {
      where.isRead = false;
    }

    const rows = await this.prisma.smartAlert.findMany({
      where,
      orderBy: { createdAt: "desc" }
    });

    const priorityRank: Record<string, number> = {
      critical: 0,
      warning: 1,
      info: 2
    };
    rows.sort(
      (a, b) =>
        (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9)
    );

    const actionLabel: Record<string, string> = {
      stock: "Stock aliment",
      health: "Santé",
      finance: "Finance",
      gestation: "Gestation",
      cheptel: "Cheptel",
      market: "Marché"
    };

    return {
      farmId,
      items: rows.map((r) => {
        const i18n = this.extractI18n(r.actionParams);
        const params = this.sanitizeActionParams(r.actionParams);
        return {
          id: r.id,
          module: r.module,
          priority: r.priority,
          title: r.title,
          message: r.message,
          i18n,
          action:
            r.actionRoute != null
              ? {
                  label: `Voir (${actionLabel[r.module] ?? r.module})`,
                  route: r.actionRoute,
                  params
                }
              : undefined,
          createdAt: r.createdAt.toISOString(),
          isRead: r.isRead
        };
      })
    };
  }

  async countUnreadCritical(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const n = await this.prisma.smartAlert.count({
      where: {
        farmId,
        priority: "critical",
        isRead: false
      }
    });
    return { farmId, criticalUnread: n };
  }

  async markRead(user: User, farmId: string, alertId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const row = await this.prisma.smartAlert.findFirst({
      where: { id: alertId, farmId }
    });
    if (!row) {
      throw new NotFoundException("Alerte introuvable");
    }
    await this.prisma.smartAlert.update({
      where: { id: alertId },
      data: { isRead: true, readAt: new Date() }
    });
    return { ok: true };
  }

  async getOrCreateSettings(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    let row = await this.prisma.farmAlertSettings.findUnique({
      where: { farmId }
    });
    if (!row) {
      row = await this.prisma.farmAlertSettings.create({
        data: { farmId }
      });
    }
    return row;
  }

  async updateSettings(
    user: User,
    farmId: string,
    dto: {
      mortalityRateThresholdPct?: number | null;
      lowBalanceThreshold?: number | null;
      stockWarningDays?: number;
      stockCriticalDays?: number;
      pushStock?: boolean;
      pushHealth?: boolean;
      pushFinance?: boolean;
      pushGestation?: boolean;
      pushCheptel?: boolean;
      pushMarket?: boolean;
    }
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const data: Prisma.FarmAlertSettingsUpdateInput = {};
    if (dto.mortalityRateThresholdPct !== undefined) {
      data.mortalityRateThresholdPct =
        dto.mortalityRateThresholdPct == null
          ? null
          : new Prisma.Decimal(dto.mortalityRateThresholdPct);
    }
    if (dto.lowBalanceThreshold !== undefined) {
      data.lowBalanceThreshold =
        dto.lowBalanceThreshold == null
          ? null
          : new Prisma.Decimal(dto.lowBalanceThreshold);
    }
    if (dto.stockWarningDays != null) {
      data.stockWarningDays = dto.stockWarningDays;
    }
    if (dto.stockCriticalDays != null) {
      data.stockCriticalDays = dto.stockCriticalDays;
    }
    if (dto.pushStock != null) data.pushStock = dto.pushStock;
    if (dto.pushHealth != null) data.pushHealth = dto.pushHealth;
    if (dto.pushFinance != null) data.pushFinance = dto.pushFinance;
    if (dto.pushGestation != null) data.pushGestation = dto.pushGestation;
    if (dto.pushCheptel != null) data.pushCheptel = dto.pushCheptel;
    if (dto.pushMarket != null) data.pushMarket = dto.pushMarket;

    const row = await this.prisma.farmAlertSettings.upsert({
      where: { farmId },
      create: {
        farmId,
        ...(dto.mortalityRateThresholdPct != null
          ? {
              mortalityRateThresholdPct: new Prisma.Decimal(
                dto.mortalityRateThresholdPct
              )
            }
          : {}),
        ...(dto.lowBalanceThreshold != null
          ? { lowBalanceThreshold: new Prisma.Decimal(dto.lowBalanceThreshold) }
          : {}),
        ...(dto.stockWarningDays != null
          ? { stockWarningDays: dto.stockWarningDays }
          : {}),
        ...(dto.stockCriticalDays != null
          ? { stockCriticalDays: dto.stockCriticalDays }
          : {}),
        ...(dto.pushStock != null ? { pushStock: dto.pushStock } : {}),
        ...(dto.pushHealth != null ? { pushHealth: dto.pushHealth } : {}),
        ...(dto.pushFinance != null ? { pushFinance: dto.pushFinance } : {}),
        ...(dto.pushGestation != null ? { pushGestation: dto.pushGestation } : {}),
        ...(dto.pushCheptel != null ? { pushCheptel: dto.pushCheptel } : {}),
        ...(dto.pushMarket != null ? { pushMarket: dto.pushMarket } : {})
      },
      update: data
    });
    return row;
  }
}
