import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { FeedRequirementProfile, ProductionStage } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { AUDIT_ACTION } from "../common/audit.constants";
import { AuditService } from "../common/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateFeedRequirementProfileDto,
  UpdateFeedRequirementProfileDto
} from "./dto/feed-requirement-profile.dto";
import {
  parseFixedInclusions,
  sumFixedInclusionPct,
  FIXED_INCLUSIONS_WARN_THRESHOLD_PCT,
  type FixedInclusion
} from "./engine/fixed-inclusions";
import type { RequirementProfileSnapshot } from "./engine/feed-formulation.types";

export type FeedRequirementProfileDto = {
  id: string;
  stage: ProductionStage;
  minCrudeProteinPct: number;
  maxCrudeProteinPct: number | null;
  minMetabolizableEnergyKcal: number;
  maxMetabolizableEnergyKcal: number | null;
  minLysinePct: number;
  minMethioninePct: number;
  minCalciumPct: number;
  maxCalciumPct: number | null;
  minPhosphorusPct: number;
  maxFiberPct: number | null;
  minLysinePerMcal: number | null;
  targetDailyIntakeKg: number | null;
  fixedInclusions: FixedInclusion[];
  notes: string | null;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class FeedRequirementProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async list(opts: {
    stage?: ProductionStage;
    includeInactive?: boolean;
  }): Promise<FeedRequirementProfileDto[]> {
    const rows = await this.prisma.feedRequirementProfile.findMany({
      where: {
        ...(opts.includeInactive ? {} : { isActive: true }),
        ...(opts.stage ? { stage: opts.stage } : {})
      },
      orderBy: { stage: "asc" }
    });
    return rows.map((r) => this.toDto(r));
  }

  async getById(id: string): Promise<FeedRequirementProfileDto> {
    const row = await this.prisma.feedRequirementProfile.findUnique({
      where: { id }
    });
    if (!row) {
      throw new NotFoundException("Profil de besoins introuvable");
    }
    return this.toDto(row);
  }

  async getActiveByStage(
    stage: ProductionStage
  ): Promise<RequirementProfileSnapshot> {
    const row = await this.prisma.feedRequirementProfile.findFirst({
      where: { stage, isActive: true }
    });
    if (!row) {
      throw new NotFoundException(
        `Aucun profil de besoins actif pour le stade « ${stage} »`
      );
    }
    return this.toSnapshot(row);
  }

  async create(
    dto: CreateFeedRequirementProfileDto,
    actorUserId: string
  ): Promise<FeedRequirementProfileDto> {
    this.assertBounds(dto);
    const fixedInclusions = this.normalizeFixedInclusions(
      dto.fixedInclusions ?? []
    );
    try {
      const created = await this.prisma.feedRequirementProfile.create({
        data: {
          stage: dto.stage,
          minCrudeProteinPct: dto.minCrudeProteinPct,
          maxCrudeProteinPct: dto.maxCrudeProteinPct ?? null,
          minMetabolizableEnergyKcal: dto.minMetabolizableEnergyKcal,
          maxMetabolizableEnergyKcal: dto.maxMetabolizableEnergyKcal ?? null,
          minLysinePct: dto.minLysinePct,
          minMethioninePct: dto.minMethioninePct,
          minCalciumPct: dto.minCalciumPct,
          maxCalciumPct: dto.maxCalciumPct ?? null,
          minPhosphorusPct: dto.minPhosphorusPct,
          maxFiberPct: dto.maxFiberPct ?? null,
          minLysinePerMcal: dto.minLysinePerMcal ?? null,
          targetDailyIntakeKg: dto.targetDailyIntakeKg ?? null,
          fixedInclusions,
          notes: dto.notes?.trim() || null,
          isActive: dto.isActive ?? true,
          createdBy: actorUserId,
          updatedBy: actorUserId
        }
      });
      await this.audit.record({
        actorUserId,
        action: AUDIT_ACTION.feedRequirementProfileCreated,
        resourceType: "FeedRequirementProfile",
        resourceId: created.id,
        metadata: { stage: created.stage }
      });
      return this.toDto(created);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException(
          `Un profil existe déjà pour le stade « ${dto.stage} »`
        );
      }
      throw e;
    }
  }

  async update(
    id: string,
    dto: UpdateFeedRequirementProfileDto,
    actorUserId: string
  ): Promise<FeedRequirementProfileDto> {
    const existing = await this.prisma.feedRequirementProfile.findUnique({
      where: { id }
    });
    if (!existing) {
      throw new NotFoundException("Profil de besoins introuvable");
    }

    const merged = {
      minCrudeProteinPct:
        dto.minCrudeProteinPct ?? Number(existing.minCrudeProteinPct),
      maxCrudeProteinPct:
        dto.maxCrudeProteinPct !== undefined
          ? dto.maxCrudeProteinPct
          : existing.maxCrudeProteinPct == null
            ? null
            : Number(existing.maxCrudeProteinPct),
      minMetabolizableEnergyKcal:
        dto.minMetabolizableEnergyKcal ??
        Number(existing.minMetabolizableEnergyKcal),
      maxMetabolizableEnergyKcal:
        dto.maxMetabolizableEnergyKcal !== undefined
          ? dto.maxMetabolizableEnergyKcal
          : existing.maxMetabolizableEnergyKcal == null
            ? null
            : Number(existing.maxMetabolizableEnergyKcal),
      minCalciumPct: dto.minCalciumPct ?? Number(existing.minCalciumPct),
      maxCalciumPct:
        dto.maxCalciumPct !== undefined
          ? dto.maxCalciumPct
          : existing.maxCalciumPct == null
            ? null
            : Number(existing.maxCalciumPct)
    };
    this.assertBounds(merged);
    const fixedInclusions =
      dto.fixedInclusions !== undefined
        ? this.normalizeFixedInclusions(dto.fixedInclusions)
        : undefined;

    const updated = await this.prisma.feedRequirementProfile.update({
      where: { id },
      data: {
        ...(dto.minCrudeProteinPct != null
          ? { minCrudeProteinPct: dto.minCrudeProteinPct }
          : {}),
        ...(dto.maxCrudeProteinPct !== undefined
          ? { maxCrudeProteinPct: dto.maxCrudeProteinPct }
          : {}),
        ...(dto.minMetabolizableEnergyKcal != null
          ? { minMetabolizableEnergyKcal: dto.minMetabolizableEnergyKcal }
          : {}),
        ...(dto.maxMetabolizableEnergyKcal !== undefined
          ? { maxMetabolizableEnergyKcal: dto.maxMetabolizableEnergyKcal }
          : {}),
        ...(dto.minLysinePct != null ? { minLysinePct: dto.minLysinePct } : {}),
        ...(dto.minMethioninePct != null
          ? { minMethioninePct: dto.minMethioninePct }
          : {}),
        ...(dto.minCalciumPct != null
          ? { minCalciumPct: dto.minCalciumPct }
          : {}),
        ...(dto.maxCalciumPct !== undefined
          ? { maxCalciumPct: dto.maxCalciumPct }
          : {}),
        ...(dto.minPhosphorusPct != null
          ? { minPhosphorusPct: dto.minPhosphorusPct }
          : {}),
        ...(dto.maxFiberPct !== undefined
          ? { maxFiberPct: dto.maxFiberPct }
          : {}),
        ...(dto.minLysinePerMcal !== undefined
          ? { minLysinePerMcal: dto.minLysinePerMcal }
          : {}),
        ...(dto.targetDailyIntakeKg !== undefined
          ? { targetDailyIntakeKg: dto.targetDailyIntakeKg }
          : {}),
        ...(fixedInclusions !== undefined ? { fixedInclusions } : {}),
        ...(dto.notes !== undefined
          ? { notes: dto.notes?.trim() || null }
          : {}),
        ...(dto.isActive != null ? { isActive: dto.isActive } : {}),
        updatedBy: actorUserId
      }
    });

    const deactivated = dto.isActive === false && existing.isActive === true;
    await this.audit.record({
      actorUserId,
      action: deactivated
        ? AUDIT_ACTION.feedRequirementProfileDeactivated
        : AUDIT_ACTION.feedRequirementProfileUpdated,
      resourceType: "FeedRequirementProfile",
      resourceId: updated.id,
      metadata: { stage: updated.stage, isActive: updated.isActive }
    });
    return this.toDto(updated);
  }

  async deactivate(
    id: string,
    actorUserId: string
  ): Promise<FeedRequirementProfileDto> {
    return this.update(id, { isActive: false }, actorUserId);
  }

  toSnapshot(row: FeedRequirementProfile): RequirementProfileSnapshot {
    return {
      stage: row.stage,
      minCrudeProteinPct: Number(row.minCrudeProteinPct),
      maxCrudeProteinPct:
        row.maxCrudeProteinPct == null
          ? null
          : Number(row.maxCrudeProteinPct),
      minMetabolizableEnergyKcal: Number(row.minMetabolizableEnergyKcal),
      maxMetabolizableEnergyKcal:
        row.maxMetabolizableEnergyKcal == null
          ? null
          : Number(row.maxMetabolizableEnergyKcal),
      minLysinePct: Number(row.minLysinePct),
      minMethioninePct: Number(row.minMethioninePct),
      minCalciumPct: Number(row.minCalciumPct),
      maxCalciumPct:
        row.maxCalciumPct == null ? null : Number(row.maxCalciumPct),
      minPhosphorusPct: Number(row.minPhosphorusPct),
      maxFiberPct:
        row.maxFiberPct == null ? null : Number(row.maxFiberPct),
      minLysinePerMcal:
        row.minLysinePerMcal == null
          ? null
          : Number(row.minLysinePerMcal),
      targetDailyIntakeKg:
        row.targetDailyIntakeKg == null
          ? null
          : Number(row.targetDailyIntakeKg),
      fixedInclusions: parseFixedInclusions(row.fixedInclusions)
    };
  }

  private normalizeFixedInclusions(
    raw: { feedIngredientId: string; inclusionPct: number }[]
  ): FixedInclusion[] {
    const parsed = parseFixedInclusions(raw);
    const sum = sumFixedInclusionPct(parsed);
    if (sum >= 100) {
      throw new BadRequestException(
        `Somme des taux fixes (${sum} %) doit être < 100 %`
      );
    }
    if (sum > FIXED_INCLUSIONS_WARN_THRESHOLD_PCT) {
      // Pas de blocage — l'avertissement runtime du moteur suffit ;
      // on journalise via BadRequest uniquement si ≥ 100.
    }
    return parsed;
  }

  private assertBounds(p: {
    minCrudeProteinPct: number;
    maxCrudeProteinPct?: number | null;
    minMetabolizableEnergyKcal: number;
    maxMetabolizableEnergyKcal?: number | null;
    minCalciumPct: number;
    maxCalciumPct?: number | null;
  }): void {
    if (
      p.maxCrudeProteinPct != null &&
      p.maxCrudeProteinPct < p.minCrudeProteinPct
    ) {
      throw new BadRequestException(
        "maxCrudeProteinPct doit être ≥ minCrudeProteinPct"
      );
    }
    if (
      p.maxMetabolizableEnergyKcal != null &&
      p.maxMetabolizableEnergyKcal < p.minMetabolizableEnergyKcal
    ) {
      throw new BadRequestException(
        "maxMetabolizableEnergyKcal doit être ≥ minMetabolizableEnergyKcal"
      );
    }
    if (p.maxCalciumPct != null && p.maxCalciumPct < p.minCalciumPct) {
      throw new BadRequestException(
        "maxCalciumPct doit être ≥ minCalciumPct"
      );
    }
  }

  private toDto(row: FeedRequirementProfile): FeedRequirementProfileDto {
    return {
      id: row.id,
      stage: row.stage,
      minCrudeProteinPct: Number(row.minCrudeProteinPct),
      maxCrudeProteinPct:
        row.maxCrudeProteinPct == null
          ? null
          : Number(row.maxCrudeProteinPct),
      minMetabolizableEnergyKcal: Number(row.minMetabolizableEnergyKcal),
      maxMetabolizableEnergyKcal:
        row.maxMetabolizableEnergyKcal == null
          ? null
          : Number(row.maxMetabolizableEnergyKcal),
      minLysinePct: Number(row.minLysinePct),
      minMethioninePct: Number(row.minMethioninePct),
      minCalciumPct: Number(row.minCalciumPct),
      maxCalciumPct:
        row.maxCalciumPct == null ? null : Number(row.maxCalciumPct),
      minPhosphorusPct: Number(row.minPhosphorusPct),
      maxFiberPct:
        row.maxFiberPct == null ? null : Number(row.maxFiberPct),
      minLysinePerMcal:
        row.minLysinePerMcal == null
          ? null
          : Number(row.minLysinePerMcal),
      targetDailyIntakeKg:
        row.targetDailyIntakeKg == null
          ? null
          : Number(row.targetDailyIntakeKg),
      fixedInclusions: parseFixedInclusions(row.fixedInclusions),
      notes: row.notes,
      isActive: row.isActive,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }
}
