import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  MembershipRole,
  type Prisma,
  type SavedComposition,
  type User
} from "@prisma/client";
import { FarmAccessService } from "../../common/farm-access.service";
import { PrismaService } from "../../prisma/prisma.service";
import { UserNotificationsService } from "../../user-notifications/user-notifications.service";
import type {
  RequestVetReviewDto,
  SaveCompositionDto,
  VetReviewCompositionDto
} from "./dto/feed-composition.dto";

@Injectable()
export class SavedCompositionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly notifications: UserNotificationsService
  ) {}

  async save(user: User, dto: SaveCompositionDto) {
    await this.farmAccess.requireFarmAccess(user.id, dto.farmId);
    const created = await this.prisma.savedComposition.create({
      data: {
        farmId: dto.farmId,
        createdByUserId: user.id,
        stage: dto.stage,
        inputParams: dto.inputParams as Prisma.InputJsonValue,
        ration: dto.ration as Prisma.InputJsonValue,
        nutritionResult: (dto.nutritionResult ?? null) as Prisma.InputJsonValue,
        totalCostXof: dto.totalCostXof,
        source: dto.source,
        status: "draft",
        millProfileId: dto.millProfileId ?? null,
        isTheoretical: dto.isTheoretical ?? false
      }
    });
    return this.toDto(created);
  }

  async listForFarm(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const rows = await this.prisma.savedComposition.findMany({
      where: { farmId },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    return rows.map((r) => this.toDto(r));
  }

  async getOne(user: User, id: string) {
    const row = await this.requireReadable(user, id);
    return this.toDto(row);
  }

  /** Véto associés à la ferme (membres role veterinarian). */
  async listAssociatedVeterinarians(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const members = await this.prisma.farmMembership.findMany({
      where: {
        farmId,
        role: MembershipRole.veterinarian,
        archived: false
      },
      include: {
        user: {
          select: { id: true, fullName: true, phone: true, email: true }
        }
      }
    });
    return members.map((m) => ({
      userId: m.userId,
      fullName: m.user.fullName,
      phone: m.user.phone,
      email: m.user.email
    }));
  }

  async requestVetReview(
    user: User,
    compositionId: string,
    dto: RequestVetReviewDto
  ) {
    const row = await this.requireOwnedOrMember(user, compositionId);
    if (row.status === "validated") {
      throw new BadRequestException("Composition déjà validée");
    }

    const vets = await this.prisma.farmMembership.findMany({
      where: {
        farmId: row.farmId,
        role: MembershipRole.veterinarian,
        archived: false
      },
      select: { userId: true }
    });
    if (vets.length === 0) {
      throw new BadRequestException(
        "Aucun vétérinaire associé à cette ferme — option indisponible"
      );
    }

    const targetUserId =
      dto.veterinarianUserId?.trim() || vets[0]!.userId;
    if (!vets.some((v) => v.userId === targetUserId)) {
      throw new BadRequestException(
        "Ce vétérinaire n'est pas associé à la ferme"
      );
    }

    const updated = await this.prisma.savedComposition.update({
      where: { id: row.id },
      data: {
        status: "vet_review",
        vetComment: null,
        vetReviewedBy: null,
        vetReviewedAt: null
      }
    });

    const farm = await this.prisma.farm.findUnique({
      where: { id: row.farmId },
      select: { name: true }
    });

    await this.notifications.notify(
      targetUserId,
      "Composition à valider",
      `Une ration (${row.stage}) de « ${farm?.name ?? "ferme"} » attend votre avis.`,
      {
        type: "feed_composition_vet_review",
        farmId: row.farmId,
        compositionId: row.id,
        stage: row.stage
      }
    );

    return this.toDto(updated);
  }

  async vetReview(
    user: User,
    compositionId: string,
    dto: VetReviewCompositionDto
  ) {
    const row = await this.prisma.savedComposition.findUnique({
      where: { id: compositionId }
    });
    if (!row) {
      throw new NotFoundException("Composition introuvable");
    }

    const membership = await this.prisma.farmMembership.findFirst({
      where: {
        farmId: row.farmId,
        userId: user.id,
        role: MembershipRole.veterinarian,
        archived: false
      }
    });
    if (!membership) {
      throw new ForbiddenException(
        "Seuls les vétérinaires associés à la ferme peuvent valider"
      );
    }
    if (row.status !== "vet_review") {
      throw new BadRequestException(
        "Cette composition n'est pas en attente de revue vétérinaire"
      );
    }

    const approved = dto.decision === "approve";
    const updated = await this.prisma.savedComposition.update({
      where: { id: row.id },
      data: {
        status: approved ? "validated" : "draft",
        vetComment: dto.comment?.trim() || null,
        vetReviewedBy: user.id,
        vetReviewedAt: new Date()
      }
    });

    await this.notifications.notify(
      row.createdByUserId,
      approved ? "Composition validée" : "Retour vétérinaire sur la ration",
      approved
        ? "Votre vétérinaire a validé la composition d'aliment."
        : dto.comment?.trim() ||
          "Votre vétérinaire demande des modifications sur la composition.",
      {
        type: "feed_composition_vet_reviewed",
        farmId: row.farmId,
        compositionId: row.id,
        decision: dto.decision
      }
    );

    return this.toDto(updated);
  }

  private async requireReadable(user: User, id: string) {
    const row = await this.prisma.savedComposition.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Composition introuvable");
    await this.farmAccess.requireFarmAccess(user.id, row.farmId);
    return row;
  }

  private async requireOwnedOrMember(user: User, id: string) {
    return this.requireReadable(user, id);
  }

  private toDto(row: SavedComposition) {
    return {
      id: row.id,
      farmId: row.farmId,
      createdByUserId: row.createdByUserId,
      stage: row.stage,
      inputParams: row.inputParams,
      ration: row.ration,
      nutritionResult: row.nutritionResult,
      totalCostXof: Number(row.totalCostXof),
      source: row.source,
      status: row.status,
      vetComment: row.vetComment,
      vetReviewedBy: row.vetReviewedBy,
      vetReviewedAt: row.vetReviewedAt?.toISOString() ?? null,
      millProfileId: row.millProfileId,
      isTheoretical: row.isTheoretical,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }
}
