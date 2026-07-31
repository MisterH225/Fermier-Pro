import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { FeedIngredient, FeedIngredientCategory } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { AUDIT_ACTION } from "../common/audit.constants";
import { AuditService } from "../common/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateFeedIngredientDto,
  UpdateFeedIngredientDto
} from "./dto/feed-ingredient.dto";
import {
  ingredientNameMatches,
  normalizeIngredientName
} from "./normalize-ingredient-name";

export type FeedIngredientDto = {
  id: string;
  canonicalName: string;
  aliases: string[];
  category: FeedIngredientCategory;
  crudeProteinPct: number;
  metabolizableEnergyKcal: number;
  lysinePct: number;
  methioninePct: number;
  calciumPct: number;
  phosphorusPct: number;
  crudeFiberPct: number;
  fatPct: number;
  dryMatterPct: number;
  isActive: boolean;
  isPremix: boolean;
  notes: string | null;
  /** Photo réelle (URL) — optionnelle. */
  imageUrl: string | null;
  /** Pictogramme de catégorie (toujours renseigné via seed / défaut). */
  iconKey: string | null;
  /** Null = seed / non relu ; ISO si validé par un superadmin. */
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

function resolveIconKey(
  category: FeedIngredientCategory | string,
  iconKey?: string | null
): string {
  if (iconKey?.trim()) return iconKey.trim();
  return String(category);
}

const NUTRITION_PATCH_KEYS = [
  "crudeProteinPct",
  "metabolizableEnergyKcal",
  "lysinePct",
  "methioninePct",
  "calciumPct",
  "phosphorusPct",
  "crudeFiberPct",
  "fatPct",
  "dryMatterPct"
] as const;

@Injectable()
export class FeedIngredientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async list(opts: {
    q?: string;
    category?: FeedIngredientCategory;
    includeInactive?: boolean;
  }): Promise<FeedIngredientDto[]> {
    const rows = await this.prisma.feedIngredient.findMany({
      where: {
        ...(opts.includeInactive ? {} : { isActive: true }),
        ...(opts.category ? { category: opts.category } : {})
      },
      orderBy: [{ category: "asc" }, { canonicalName: "asc" }]
    });

    const filtered = opts.q?.trim()
      ? rows.filter((r) =>
          ingredientNameMatches(opts.q!, r.canonicalName, r.aliases) ||
          normalizeIngredientName(r.canonicalName).includes(
            normalizeIngredientName(opts.q!)
          ) ||
          r.aliases.some((a) =>
            normalizeIngredientName(a).includes(
              normalizeIngredientName(opts.q!)
            )
          )
        )
      : rows;

    return filtered.map((r) => this.toDto(r));
  }

  async getById(id: string): Promise<FeedIngredientDto> {
    const row = await this.prisma.feedIngredient.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException("Intrant introuvable");
    }
    return this.toDto(row);
  }

  async create(
    dto: CreateFeedIngredientDto,
    actorUserId: string
  ): Promise<FeedIngredientDto> {
    await this.assertNoNameConflict(dto.canonicalName, dto.aliases ?? []);

    try {
      const created = await this.prisma.feedIngredient.create({
        data: {
          canonicalName: dto.canonicalName.trim(),
          aliases: this.cleanAliases(dto.aliases),
          category: dto.category,
          crudeProteinPct: dto.crudeProteinPct,
          metabolizableEnergyKcal: dto.metabolizableEnergyKcal,
          lysinePct: dto.lysinePct,
          methioninePct: dto.methioninePct,
          calciumPct: dto.calciumPct,
          phosphorusPct: dto.phosphorusPct,
          crudeFiberPct: dto.crudeFiberPct,
          fatPct: dto.fatPct,
          dryMatterPct: dto.dryMatterPct,
          isPremix: dto.isPremix ?? false,
          notes: dto.notes?.trim() || null,
          imageUrl: dto.imageUrl?.trim() || null,
          iconKey: resolveIconKey(dto.category, dto.iconKey),
          // Création manuelle admin = déjà validée.
          reviewedAt: new Date(),
          reviewedBy: actorUserId,
          createdBy: actorUserId,
          updatedBy: actorUserId
        }
      });
      await this.audit.record({
        actorUserId,
        action: AUDIT_ACTION.feedIngredientCreated,
        resourceType: "FeedIngredient",
        resourceId: created.id,
        metadata: { canonicalName: created.canonicalName }
      });
      return this.toDto(created);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException(
          "Un intrant avec ce nom canonique existe déjà"
        );
      }
      throw e;
    }
  }

  async update(
    id: string,
    dto: UpdateFeedIngredientDto,
    actorUserId: string
  ): Promise<FeedIngredientDto> {
    const existing = await this.prisma.feedIngredient.findUnique({
      where: { id }
    });
    if (!existing) {
      throw new NotFoundException("Intrant introuvable");
    }

    if (dto.canonicalName != null || dto.aliases != null) {
      await this.assertNoNameConflict(
        dto.canonicalName ?? existing.canonicalName,
        dto.aliases ?? existing.aliases,
        id
      );
    }

    const nutritionTouched = NUTRITION_PATCH_KEYS.some(
      (key) => dto[key] != null
    );
    const shouldMarkReviewed = Boolean(dto.markReviewed) || nutritionTouched;

    try {
      const updated = await this.prisma.feedIngredient.update({
        where: { id },
        data: {
          ...(dto.canonicalName != null
            ? { canonicalName: dto.canonicalName.trim() }
            : {}),
          ...(dto.aliases != null
            ? { aliases: this.cleanAliases(dto.aliases) }
            : {}),
          ...(dto.category != null ? { category: dto.category } : {}),
          ...(dto.crudeProteinPct != null
            ? { crudeProteinPct: dto.crudeProteinPct }
            : {}),
          ...(dto.metabolizableEnergyKcal != null
            ? { metabolizableEnergyKcal: dto.metabolizableEnergyKcal }
            : {}),
          ...(dto.lysinePct != null ? { lysinePct: dto.lysinePct } : {}),
          ...(dto.methioninePct != null
            ? { methioninePct: dto.methioninePct }
            : {}),
          ...(dto.calciumPct != null ? { calciumPct: dto.calciumPct } : {}),
          ...(dto.phosphorusPct != null
            ? { phosphorusPct: dto.phosphorusPct }
            : {}),
          ...(dto.crudeFiberPct != null
            ? { crudeFiberPct: dto.crudeFiberPct }
            : {}),
          ...(dto.fatPct != null ? { fatPct: dto.fatPct } : {}),
          ...(dto.dryMatterPct != null
            ? { dryMatterPct: dto.dryMatterPct }
            : {}),
          ...(dto.isActive != null ? { isActive: dto.isActive } : {}),
          ...(dto.isPremix != null ? { isPremix: dto.isPremix } : {}),
          ...(dto.notes !== undefined
            ? { notes: dto.notes?.trim() || null }
            : {}),
          ...(dto.imageUrl !== undefined
            ? { imageUrl: dto.imageUrl?.trim() || null }
            : {}),
          ...(dto.iconKey !== undefined || dto.category != null
            ? {
                iconKey: resolveIconKey(
                  dto.category ?? existing.category,
                  dto.iconKey !== undefined ? dto.iconKey : existing.iconKey
                )
              }
            : {}),
          ...(shouldMarkReviewed
            ? { reviewedAt: new Date(), reviewedBy: actorUserId }
            : {}),
          updatedBy: actorUserId
        }
      });

      const deactivated =
        dto.isActive === false && existing.isActive === true;
      await this.audit.record({
        actorUserId,
        action: deactivated
          ? AUDIT_ACTION.feedIngredientDeactivated
          : AUDIT_ACTION.feedIngredientUpdated,
        resourceType: "FeedIngredient",
        resourceId: updated.id,
        metadata: {
          canonicalName: updated.canonicalName,
          isActive: updated.isActive,
          reviewed: shouldMarkReviewed || Boolean(updated.reviewedAt)
        }
      });
      return this.toDto(updated);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException(
          "Un intrant avec ce nom canonique existe déjà"
        );
      }
      throw e;
    }
  }

  /** Désactivation soft — conserve la ligne pour l'historique. */
  async deactivate(id: string, actorUserId: string): Promise<FeedIngredientDto> {
    return this.update(id, { isActive: false }, actorUserId);
  }

  /** Marque l'intrant comme relu sans modifier les valeurs. */
  async markReviewed(
    id: string,
    actorUserId: string
  ): Promise<FeedIngredientDto> {
    return this.update(id, { markReviewed: true }, actorUserId);
  }

  /**
   * Recherche un intrant actif par nom / alias normalisé.
   * Sert aux moulins (anti-doublon) et au moteur de formulation.
   */
  async findActiveByNameOrAlias(
    rawName: string
  ): Promise<FeedIngredientDto | null> {
    const q = normalizeIngredientName(rawName);
    if (!q) return null;
    const rows = await this.prisma.feedIngredient.findMany({
      where: { isActive: true }
    });
    const hit = rows.find((r) =>
      ingredientNameMatches(rawName, r.canonicalName, r.aliases)
    );
    return hit ? this.toDto(hit) : null;
  }

  private async assertNoNameConflict(
    canonicalName: string,
    aliases: string[],
    excludeId?: string
  ): Promise<void> {
    const names = [canonicalName, ...aliases]
      .map((n) => normalizeIngredientName(n))
      .filter(Boolean);
    if (names.length === 0) {
      throw new BadRequestException("Nom d'intrant invalide");
    }

    const rows = await this.prisma.feedIngredient.findMany({
      where: excludeId ? { id: { not: excludeId } } : undefined
    });
    for (const row of rows) {
      for (const name of names) {
        if (ingredientNameMatches(name, row.canonicalName, row.aliases)) {
          throw new ConflictException(
            `Conflit avec l'intrant « ${row.canonicalName} » (nom ou alias)`
          );
        }
      }
    }
  }

  private cleanAliases(aliases: string[] | undefined): string[] {
    if (!aliases?.length) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const a of aliases) {
      const trimmed = a.trim();
      const key = normalizeIngredientName(trimmed);
      if (!trimmed || !key || seen.has(key)) continue;
      seen.add(key);
      out.push(trimmed);
    }
    return out;
  }

  private toDto(row: FeedIngredient): FeedIngredientDto {
    return {
      id: row.id,
      canonicalName: row.canonicalName,
      aliases: row.aliases,
      category: row.category,
      crudeProteinPct: Number(row.crudeProteinPct),
      metabolizableEnergyKcal: Number(row.metabolizableEnergyKcal),
      lysinePct: Number(row.lysinePct),
      methioninePct: Number(row.methioninePct),
      calciumPct: Number(row.calciumPct),
      phosphorusPct: Number(row.phosphorusPct),
      crudeFiberPct: Number(row.crudeFiberPct),
      fatPct: Number(row.fatPct),
      dryMatterPct: Number(row.dryMatterPct),
      isActive: row.isActive,
      isPremix: row.isPremix,
      notes: row.notes,
      imageUrl: row.imageUrl ?? null,
      iconKey: resolveIconKey(row.category, row.iconKey),
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      reviewedBy: row.reviewedBy,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }
}
