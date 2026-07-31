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
  PLATFORM_MODULE_META,
  collectCascadeTargets,
  isModuleDefaultOff,
  type PlatformModuleId
} from "./platform-modules.constants";
import type { ClientFeatureKey } from "../config-client/feature-flags.service";
import {
  detectIdentifierKind,
  normalizeEmail,
  normalizePhone
} from "../invitations/identifier-utils";

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

export type FeatureFlagTestAccountDto = {
  id: string;
  moduleId: string;
  userId: string;
  email: string | null;
  phone: string | null;
  label: string;
  addedBy: string | null;
  createdAt: string;
};

/**
 * Résolution « module actif pour un user » :
 *   actif global
 *   OU (user dans FeatureFlagTestAccount ET prérequis actifs pour ce user).
 *
 * L'allow-list contourne uniquement l'activation globale — pas les prérequis.
 * Ex. un compte de test de feed_composition doit aussi avoir marketplace+mills
 * actifs pour lui (globalement ou via allow-list). Documenté ici et sur le modèle Prisma.
 */
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

  /** État global (sans allow-list ni prérequis runtime). */
  isModuleActiveFromRows(
    moduleId: PlatformModuleId,
    rows: PlatformFeatureFlag[]
  ): boolean {
    if (moduleId === CORE_PRODUCER_MODULE) return true;
    const row = rows.find((r) => r.moduleId === moduleId);
    if (!row) {
      return !isModuleDefaultOff(moduleId);
    }
    return row.isActive;
  }

  async isModuleActive(moduleId: PlatformModuleId): Promise<boolean> {
    const rows = await this.loadAll();
    return this.isModuleActiveFromRows(moduleId, rows);
  }

  /**
   * Résolution effective pour un utilisateur.
   * - Actif global → true (comportement historique inchangé).
   * - Sinon, allow-list de test + prérequis récursifs pour ce user.
   */
  async isModuleActiveForUser(
    moduleId: PlatformModuleId,
    userId?: string | null,
    visiting: Set<PlatformModuleId> = new Set()
  ): Promise<boolean> {
    if (moduleId === CORE_PRODUCER_MODULE) return true;
    if (visiting.has(moduleId)) return false;
    visiting.add(moduleId);

    const rows = await this.loadAll();
    if (this.isModuleActiveFromRows(moduleId, rows)) {
      return true;
    }
    if (!userId) return false;
    if (!(await this.isUserOnTestAllowList(moduleId, userId))) {
      return false;
    }

    const prereqs = MODULE_ENABLE_PREREQUISITES[moduleId] ?? [];
    for (const prereq of prereqs) {
      const ok = await this.isModuleActiveForUser(prereq, userId, visiting);
      if (!ok) return false;
    }
    return true;
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
          userMessageFr:
            target === moduleId
              ? input.userMessageFr ?? null
              : targetRow.userMessageFr,
          userMessageEn:
            target === moduleId
              ? input.userMessageEn ?? null
              : targetRow.userMessageEn,
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
    const counts = await this.prisma.featureFlagTestAccount.groupBy({
      by: ["moduleId"],
      _count: { _all: true }
    });
    const countMap = new Map(
      counts.map((c) => [c.moduleId, c._count._all] as const)
    );
    return rows.map((row) => {
      const meta = PLATFORM_MODULE_META[row.moduleId as PlatformModuleId];
      return {
        ...this.toPublicDto(row),
        moduleName: meta?.moduleName ?? row.moduleName,
        description: meta?.description ?? null,
        disabledAt: row.disabledAt?.toISOString() ?? null,
        disableReason: row.disableReason,
        reactivatedAt: row.reactivatedAt?.toISOString() ?? null,
        waitlistCount: 0 as number,
        testAccountCount: countMap.get(row.moduleId) ?? 0
      };
    });
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

  async listTestAccounts(
    moduleId: PlatformModuleId
  ): Promise<FeatureFlagTestAccountDto[]> {
    await this.findModuleOrThrow(moduleId);
    const rows = await this.prisma.featureFlagTestAccount.findMany({
      where: { moduleId },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { email: true, phone: true } }
      }
    });
    return rows.map((r) => this.toTestAccountDto(r));
  }

  /**
   * Ajoute un compte de test via email ou téléphone (pas l'id interne).
   */
  async addTestAccount(
    moduleId: PlatformModuleId,
    identifier: string,
    addedBy: string
  ) {
    await this.findModuleOrThrow(moduleId);
    const user = await this.resolveUserByIdentifier(identifier);
    const userId = user.id;

    const existing = await this.prisma.featureFlagTestAccount.findUnique({
      where: { moduleId_userId: { moduleId, userId } }
    });
    if (existing) {
      throw new BadRequestException(
        "Ce compte est déjà dans l'allow-list de test de ce module"
      );
    }

    const created = await this.prisma.featureFlagTestAccount.create({
      data: { moduleId, userId, addedBy },
      include: {
        user: { select: { email: true, phone: true } }
      }
    });
    const label = this.testAccountLabel(user.email, user.phone);
    await this.prisma.featureFlagHistory.create({
      data: {
        moduleId,
        action: FeatureFlagHistoryAction.test_account_added,
        performedById: addedBy,
        reason: `Compte de test ajouté : ${label}`,
        affectedDataSummary: {
          userId,
          email: user.email,
          phone: user.phone,
          identifier: identifier.trim()
        }
      }
    });

    return this.toTestAccountDto(created);
  }

  async removeTestAccount(
    moduleId: PlatformModuleId,
    userId: string,
    performedById: string
  ) {
    await this.findModuleOrThrow(moduleId);
    const existing = await this.prisma.featureFlagTestAccount.findUnique({
      where: { moduleId_userId: { moduleId, userId } },
      include: { user: { select: { email: true, phone: true } } }
    });
    if (!existing) {
      throw new NotFoundException(
        "Compte de test introuvable pour ce module"
      );
    }

    const label = this.testAccountLabel(
      existing.user?.email,
      existing.user?.phone
    );
    await this.prisma.featureFlagTestAccount.delete({
      where: { id: existing.id }
    });
    await this.prisma.featureFlagHistory.create({
      data: {
        moduleId,
        action: FeatureFlagHistoryAction.test_account_removed,
        performedById,
        reason: `Compte de test retiré : ${label}`,
        affectedDataSummary: {
          userId,
          email: existing.user?.email ?? null,
          phone: existing.user?.phone ?? null
        }
      }
    });

    return { ok: true as const };
  }

  private async isUserOnTestAllowList(
    moduleId: PlatformModuleId,
    userId: string
  ): Promise<boolean> {
    const row = await this.prisma.featureFlagTestAccount.findUnique({
      where: { moduleId_userId: { moduleId, userId } },
      select: { id: true }
    });
    return row != null;
  }

  private async resolveUserByIdentifier(raw: string) {
    const trimmed = raw.trim();
    const kind = detectIdentifierKind(trimmed);
    if (!kind) {
      throw new BadRequestException(
        "Indiquez un email ou un numéro de téléphone"
      );
    }

    let normalized: string | null = null;
    if (kind === "email") {
      normalized = normalizeEmail(trimmed);
    } else {
      normalized = normalizePhone(trimmed);
    }
    if (!normalized) {
      throw new BadRequestException(
        kind === "email"
          ? "Email invalide"
          : "Numéro de téléphone invalide"
      );
    }

    const user = await this.prisma.user.findFirst({
      where: kind === "email" ? { email: normalized } : { phone: normalized },
      select: { id: true, email: true, phone: true }
    });
    if (!user) {
      throw new NotFoundException(
        kind === "email"
          ? `Aucun compte trouvé pour l'email « ${normalized} »`
          : `Aucun compte trouvé pour le numéro « ${normalized} »`
      );
    }
    return user;
  }

  private testAccountLabel(
    email: string | null | undefined,
    phone: string | null | undefined
  ): string {
    return email || phone || "compte inconnu";
  }

  private toTestAccountDto(row: {
    id: string;
    moduleId: string;
    userId: string;
    addedBy: string | null;
    createdAt: Date;
    user?: { email: string | null; phone: string | null } | null;
  }): FeatureFlagTestAccountDto {
    const email = row.user?.email ?? null;
    const phone = row.user?.phone ?? null;
    return {
      id: row.id,
      moduleId: row.moduleId,
      userId: row.userId,
      email,
      phone,
      label: this.testAccountLabel(email, phone),
      addedBy: row.addedBy,
      createdAt: row.createdAt.toISOString()
    };
  }

  private async loadAll(): Promise<PlatformFeatureFlag[]> {
    const now = Date.now();
    if (this.cache && now < this.cacheExpiresAt) {
      await this.applyScheduledReactivations(this.cache);
      return this.cache;
    }
    let rows = await this.prisma.platformFeatureFlag.findMany({
      orderBy: { moduleName: "asc" }
    });
    if (rows.length === 0) {
      rows = await this.bootstrapDefaults();
    } else {
      rows = await this.ensureMissingModules(rows);
    }
    await this.applyScheduledReactivations(rows);
    this.cache = rows;
    this.cacheExpiresAt = now + CACHE_TTL_MS;
    return rows;
  }

  private async bootstrapDefaults(): Promise<PlatformFeatureFlag[]> {
    const seed = PLATFORM_MODULE_IDS.map((moduleId) => {
      const meta = PLATFORM_MODULE_META[moduleId];
      return {
        moduleId,
        moduleName: meta?.moduleName ?? moduleId,
        icon: meta?.icon ?? null,
        canDisable: moduleId !== CORE_PRODUCER_MODULE,
        isActive: !isModuleDefaultOff(moduleId)
      };
    });
    await this.prisma.platformFeatureFlag.createMany({
      data: seed,
      skipDuplicates: true
    });
    return this.prisma.platformFeatureFlag.findMany({
      orderBy: { moduleName: "asc" }
    });
  }

  /** Insère les modules déclarés absents de la table (ex. nouveaux IDs). */
  private async ensureMissingModules(
    rows: PlatformFeatureFlag[]
  ): Promise<PlatformFeatureFlag[]> {
    const present = new Set(rows.map((r) => r.moduleId));
    const missing = PLATFORM_MODULE_IDS.filter((id) => !present.has(id));
    if (missing.length === 0) return rows;

    await this.prisma.platformFeatureFlag.createMany({
      data: missing.map((moduleId) => {
        const meta = PLATFORM_MODULE_META[moduleId];
        return {
          moduleId,
          moduleName: meta?.moduleName ?? moduleId,
          icon: meta?.icon ?? null,
          canDisable: moduleId !== CORE_PRODUCER_MODULE,
          isActive:
            moduleId === CORE_PRODUCER_MODULE || !isModuleDefaultOff(moduleId)
        };
      }),
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
    const meta = PLATFORM_MODULE_META[row.moduleId as PlatformModuleId];
    return {
      moduleId: row.moduleId as PlatformModuleId,
      moduleName: meta?.moduleName ?? row.moduleName,
      icon: row.icon ?? meta?.icon ?? null,
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
    await this.loadAll();
    const row = await this.findModule(moduleId);
    if (!row) {
      throw new NotFoundException(`Module inconnu : ${moduleId}`);
    }
    return row;
  }
}
