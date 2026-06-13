import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { PlatformFeatureFlag } from "@prisma/client";
import { FeatureFlagHistoryAction } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { FeatureFlagArchiveService } from "./feature-flag-archive.service";
import {
  CLIENT_FEATURE_TO_PLATFORM,
  CORE_PRODUCER_MODULE,
  MODULE_ENABLE_PREREQUISITES,
  PLATFORM_MODULE_IDS,
  collectCascadeTargets,
  type PlatformModuleId
} from "./platform-modules.constants";
import type { ClientFeatureKey } from "../config-client/feature-flags.service";

const CACHE_TTL_MS = 5 * 60 * 1000;

export type PlatformModulePublicDto = {
  moduleId: PlatformModuleId;
  moduleName: string;
  icon: string | null;
  isActive: boolean;
  canDisable: boolean;
  userMessageFr: string | null;
  userMessageEn: string | null;
  scheduledReactivation: string | null;
};

@Injectable()
export class PlatformFeatureFlagsService {
  private cache: PlatformFeatureFlag[] | null = null;
  private cacheExpiresAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly archive: FeatureFlagArchiveService
  ) {}

  invalidateCache(): void {
    this.cache = null;
    this.cacheExpiresAt = 0;
  }

  async listPublicModules(): Promise<PlatformModulePublicDto[]> {
    const rows = await this.loadAll();
    return rows.map((row) => this.toPublicDto(row));
  }

  async getModuleMap(): Promise<Record<PlatformModuleId, boolean>> {
    const rows = await this.loadAll();
    const map = {} as Record<PlatformModuleId, boolean>;
    for (const id of PLATFORM_MODULE_IDS) {
      const row = rows.find((r) => r.moduleId === id);
      map[id] = row?.isActive ?? id === CORE_PRODUCER_MODULE;
    }
    return map;
  }

  isModuleActiveFromRows(
    moduleId: PlatformModuleId,
    rows: PlatformFeatureFlag[]
  ): boolean {
    if (moduleId === CORE_PRODUCER_MODULE) return true;
    const row = rows.find((r) => r.moduleId === moduleId);
    return row?.isActive ?? true;
  }

  async isModuleActive(moduleId: PlatformModuleId): Promise<boolean> {
    const rows = await this.loadAll();
    return this.isModuleActiveFromRows(moduleId, rows);
  }

  async isClientFeatureActive(
    key: ClientFeatureKey,
    rows?: PlatformFeatureFlag[]
  ): Promise<boolean> {
    const platformId = CLIENT_FEATURE_TO_PLATFORM[key];
    const all = rows ?? (await this.loadAll());
    return this.isModuleActiveFromRows(platformId, all);
  }

  async getInactiveMessage(
    moduleId: PlatformModuleId,
    locale: "fr" | "en" = "fr"
  ): Promise<string | null> {
    const row = await this.findModule(moduleId);
    if (!row || row.isActive) return null;
    if (locale === "en" && row.userMessageEn) return row.userMessageEn;
    return row.userMessageFr ?? row.userMessageEn ?? null;
  }

  async previewDisable(moduleId: PlatformModuleId) {
    await this.findModuleOrThrow(moduleId);
    const cascade = collectCascadeTargets(moduleId);
    const targets = [moduleId, ...cascade];
    const previews = await Promise.all(
      targets.map(async (id) => ({
        moduleId: id,
        tables: await this.archive.previewArchive(id)
      }))
    );
    return { moduleId, cascade, previews };
  }

  async disableModule(
    moduleId: PlatformModuleId,
    performedById: string,
    input: {
      reason: string;
      userMessageFr?: string;
      userMessageEn?: string;
      scheduledReactivation?: Date;
    }
  ) {
    const row = await this.findModuleOrThrow(moduleId);
    if (!row.canDisable) {
      throw new BadRequestException("Ce module ne peut pas être désactivé");
    }
    if (!row.isActive) {
      throw new BadRequestException("Module déjà inactif");
    }

    const targets = [moduleId, ...collectCascadeTargets(moduleId)];
    const summaries: Record<string, Record<string, number>> = {};

    for (const target of targets) {
      const targetRow = await this.findModuleOrThrow(target);
      if (!targetRow.isActive) continue;
      summaries[target] = await this.archive.archiveModuleData(target);
      await this.prisma.platformFeatureFlag.update({
        where: { moduleId: target },
        data: {
          isActive: false,
          disabledAt: new Date(),
          disabledById: performedById,
          disableReason: input.reason,
          reactivatedAt: null,
          reactivatedById: null,
          userMessageFr: target === moduleId ? input.userMessageFr ?? null : targetRow.userMessageFr,
          userMessageEn: target === moduleId ? input.userMessageEn ?? null : targetRow.userMessageEn,
          scheduledReactivation:
            target === moduleId ? input.scheduledReactivation ?? null : null
        }
      });
      await this.prisma.featureFlagHistory.create({
        data: {
          moduleId: target,
          action: FeatureFlagHistoryAction.disabled,
          performedById,
          reason: input.reason,
          affectedDataSummary: summaries[target]
        }
      });
    }

    this.invalidateCache();
    return this.listAdminModules();
  }

  async reactivateModule(
    moduleId: PlatformModuleId,
    performedById: string,
    reason?: string
  ) {
    const row = await this.findModuleOrThrow(moduleId);
    if (row.isActive) {
      throw new BadRequestException("Module déjà actif");
    }

    const prereqs = MODULE_ENABLE_PREREQUISITES[moduleId] ?? [];
    for (const prereq of prereqs) {
      const active = await this.isModuleActive(prereq);
      if (!active) {
        throw new BadRequestException(
          `Réactivez d'abord le module « ${prereq} »`
        );
      }
    }

    const restored = await this.archive.restoreModuleData(moduleId);
    await this.prisma.platformFeatureFlag.update({
      where: { moduleId },
      data: {
        isActive: true,
        reactivatedAt: new Date(),
        reactivatedById: performedById,
        scheduledReactivation: null,
        disabledAt: null,
        disabledById: null,
        disableReason: null
      }
    });
    await this.prisma.featureFlagHistory.create({
      data: {
        moduleId,
        action: FeatureFlagHistoryAction.reactivated,
        performedById,
        reason: reason ?? null,
        affectedDataSummary: restored
      }
    });

    this.invalidateCache();
    return this.listAdminModules();
  }

  async listAdminModules() {
    const rows = await this.loadAll();
    return rows.map((row) => ({
      ...this.toPublicDto(row),
      disabledAt: row.disabledAt?.toISOString() ?? null,
      disableReason: row.disableReason,
      reactivatedAt: row.reactivatedAt?.toISOString() ?? null,
      waitlistCount: 0 as number
    }));
  }

  async listHistory(moduleId: PlatformModuleId, limit = 50) {
    await this.findModuleOrThrow(moduleId);
    return this.prisma.featureFlagHistory.findMany({
      where: { moduleId },
      orderBy: { createdAt: "desc" },
      take: limit
    });
  }

  async joinWaitlist(moduleId: PlatformModuleId, userId: string) {
    await this.findModuleOrThrow(moduleId);
    await this.prisma.reactivationWaitlist.upsert({
      where: { moduleId_userId: { moduleId, userId } },
      create: { moduleId, userId },
      update: {}
    });
    return { ok: true as const };
  }

  private async loadAll(): Promise<PlatformFeatureFlag[]> {
    const now = Date.now();
    if (this.cache && now < this.cacheExpiresAt) {
      await this.applyScheduledReactivations(this.cache);
      return this.cache;
    }
    const rows = await this.prisma.platformFeatureFlag.findMany({
      orderBy: { moduleName: "asc" }
    });
    if (rows.length === 0) {
      return this.bootstrapDefaults();
    }
    await this.applyScheduledReactivations(rows);
    this.cache = rows;
    this.cacheExpiresAt = now + CACHE_TTL_MS;
    return rows;
  }

  private async bootstrapDefaults(): Promise<PlatformFeatureFlag[]> {
    const seed = PLATFORM_MODULE_IDS.map((moduleId) => ({
      moduleId,
      moduleName: moduleId,
      canDisable: moduleId !== CORE_PRODUCER_MODULE,
      isActive: true
    }));
    await this.prisma.platformFeatureFlag.createMany({
      data: seed,
      skipDuplicates: true
    });
    return this.prisma.platformFeatureFlag.findMany({
      orderBy: { moduleName: "asc" }
    });
  }

  private async applyScheduledReactivations(
    rows: PlatformFeatureFlag[]
  ): Promise<void> {
    const now = new Date();
    const due = rows.filter(
      (r) =>
        !r.isActive &&
        r.scheduledReactivation &&
        r.scheduledReactivation <= now
    );
    if (due.length === 0) return;

    for (const row of due) {
      await this.archive.restoreModuleData(row.moduleId as PlatformModuleId);
      await this.prisma.platformFeatureFlag.update({
        where: { moduleId: row.moduleId },
        data: {
          isActive: true,
          reactivatedAt: now,
          scheduledReactivation: null,
          disabledAt: null,
          disabledById: null,
          disableReason: null
        }
      });
      await this.prisma.featureFlagHistory.create({
        data: {
          moduleId: row.moduleId,
          action: FeatureFlagHistoryAction.reactivated,
          reason: "Réactivation planifiée automatique"
        }
      });
      row.isActive = true;
      row.scheduledReactivation = null;
    }
    this.invalidateCache();
  }

  private toPublicDto(row: PlatformFeatureFlag): PlatformModulePublicDto {
    return {
      moduleId: row.moduleId as PlatformModuleId,
      moduleName: row.moduleName,
      icon: row.icon,
      isActive: row.moduleId === CORE_PRODUCER_MODULE ? true : row.isActive,
      canDisable: row.canDisable,
      userMessageFr: row.userMessageFr,
      userMessageEn: row.userMessageEn,
      scheduledReactivation: row.scheduledReactivation?.toISOString() ?? null
    };
  }

  private async findModule(moduleId: PlatformModuleId) {
    return this.prisma.platformFeatureFlag.findUnique({
      where: { moduleId }
    });
  }

  private async findModuleOrThrow(moduleId: PlatformModuleId) {
    const row = await this.findModule(moduleId);
    if (!row) {
      throw new NotFoundException(`Module inconnu : ${moduleId}`);
    }
    return row;
  }
}
